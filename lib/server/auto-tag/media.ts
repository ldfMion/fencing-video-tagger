import "server-only";

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { CropRect, FrameSheet, VideoStreamInfo } from "@/lib/auto-tag/frame-sheet";
import {
  buildFrameSheetArgs,
  buildFrameTiles,
  buildLastFrameBeforeArgs,
  buildProbeArgs,
  buildSingleFrameArgs,
  computeOverviewWindows,
  computeSheetGrid,
  computeSingleFrameWidth,
  computeTileSize,
  convertCropToPixels,
  estimateTileCount,
  formatOverviewSheetFileName,
  isEmptyOutputFailure,
  parseShowinfoPtsTimes,
  parseVideoStreamInfo,
  type FfprobeStreamOutput,
  type OverviewWindow,
  type SingleFrameCommandOptions,
} from "@/lib/server/auto-tag/ffmpeg-helpers";

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_SHEET_WIDTH = 2048;
const DEFAULT_MAX_SINGLE_FRAME_WIDTH = 1920;
const OVERVIEW_CONCURRENCY = 4;
const FFMPEG_TIMEOUT_MS = 150_000;
const FFMPEG_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const MANIFEST_FILE_NAME = "manifest.json";

export interface ExtractFrameSheetOptions {
  videoPath: string;
  start: number;
  end: number;
  fps: number;
  crop?: CropRect;
  outputPath: string;
  maxSheetWidth?: number;
  /** Skips the ffprobe call when the caller already probed the video. */
  streamInfo?: VideoStreamInfo;
}

export interface ExtractSingleFrameOptions {
  videoPath: string;
  time: number;
  crop?: CropRect;
  outputPath: string;
  maxWidth?: number;
}

export interface GenerateOverviewSheetsOptions {
  videoPath: string;
  duration: number;
  outputDir: string;
  fps: number;
  secondsPerSheet: number;
  maxSheetWidth?: number;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function probeVideoStream(videoPath: string): Promise<VideoStreamInfo> {
  try {
    const { stdout } = await execFileAsync("ffprobe", buildProbeArgs(videoPath), {
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
    });
    return parseVideoStreamInfo(JSON.parse(stdout) as FfprobeStreamOutput);
  } catch (error) {
    throw new Error(`Could not probe the video stream: ${describeError(error)}`);
  }
}

/** Runs ffmpeg and returns the source PTS of every frame that reached the showinfo filter. */
async function runFfmpegAndCollectFrameTimes(args: string[]): Promise<number[]> {
  try {
    const { stderr } = await execFileAsync("ffmpeg", args, {
      maxBuffer: FFMPEG_MAX_BUFFER_BYTES,
      timeout: FFMPEG_TIMEOUT_MS,
    });
    return parseShowinfoPtsTimes(stderr);
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";
    if (isEmptyOutputFailure(stderr)) return [];
    const stderrTail = stderr.trim().split("\n").slice(-5).join("\n");
    throw new Error(`ffmpeg failed: ${stderrTail || describeError(error)}`);
  }
}

function assertPositiveFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number, received ${value}.`);
  }
}

function normalizeSamplingWindow(start: number, end: number, duration: number): OverviewWindow {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("Frame sheet start and end must be finite numbers.");
  }
  const clampedStart = Math.max(0, start);
  const clampedEnd = Math.min(end, duration);
  if (clampedStart >= clampedEnd) {
    throw new Error(
      `Frame sheet window is empty: start ${start}s must be before end ${end}s within the ${duration.toFixed(3)}s video.`,
    );
  }
  return { start: clampedStart, end: clampedEnd };
}

export async function extractFrameSheet(options: ExtractFrameSheetOptions): Promise<FrameSheet> {
  assertPositiveFiniteNumber(options.fps, "fps");
  const streamInfo = options.streamInfo ?? await probeVideoStream(options.videoPath);
  const { start, end } = normalizeSamplingWindow(options.start, options.end, streamInfo.duration);

  const cropPixels = convertCropToPixels(options.crop, streamInfo);
  const grid = computeSheetGrid(estimateTileCount(start, end, options.fps, streamInfo.frameRate));
  const tileSize = computeTileSize(cropPixels, grid.columns, options.maxSheetWidth ?? DEFAULT_MAX_SHEET_WIDTH);

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const frameTimes = await runFfmpegAndCollectFrameTimes(buildFrameSheetArgs({
    videoPath: options.videoPath,
    start,
    end,
    fps: options.fps,
    grid,
    tileSize,
    cropPixels: options.crop ? cropPixels : undefined,
    outputPath: options.outputPath,
  }));

  if (frameTimes.length === 0) {
    throw new Error(`No video frames found between ${start.toFixed(3)}s and ${end.toFixed(3)}s.`);
  }

  return {
    imagePath: options.outputPath,
    columns: grid.columns,
    rows: grid.rows,
    tiles: buildFrameTiles(frameTimes.slice(0, grid.columns * grid.rows)),
    start,
    end,
  };
}

export async function extractSingleFrame(
  options: ExtractSingleFrameOptions,
): Promise<{ imagePath: string; time: number }> {
  if (!Number.isFinite(options.time)) {
    throw new Error("Frame time must be a finite number.");
  }
  const streamInfo = await probeVideoStream(options.videoPath);
  const time = Math.min(Math.max(0, options.time), streamInfo.duration);
  const cropPixels = convertCropToPixels(options.crop, streamInfo);

  const commandOptions: SingleFrameCommandOptions = {
    videoPath: options.videoPath,
    time,
    outputWidth: computeSingleFrameWidth(cropPixels, options.maxWidth ?? DEFAULT_MAX_SINGLE_FRAME_WIDTH),
    cropPixels: options.crop ? cropPixels : undefined,
    outputPath: options.outputPath,
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const frameTimesAtOrAfter = await runFfmpegAndCollectFrameTimes(buildSingleFrameArgs(commandOptions));
  if (frameTimesAtOrAfter.length > 0) {
    return { imagePath: options.outputPath, time: frameTimesAtOrAfter[0] };
  }

  const frameTimesBefore = await runFfmpegAndCollectFrameTimes(buildLastFrameBeforeArgs(commandOptions));
  if (frameTimesBefore.length === 0) {
    throw new Error(`No video frame found near ${time.toFixed(3)}s.`);
  }
  return { imagePath: options.outputPath, time: frameTimesBefore[frameTimesBefore.length - 1] };
}

async function mapWithConcurrency<Input, Output>(
  inputs: Input[],
  concurrency: number,
  mapInput: (input: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  const outputs = new Array<Output>(inputs.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex++;
      outputs[index] = await mapInput(inputs[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, runWorker));
  return outputs;
}

function overviewManifestPath(outputDir: string): string {
  return path.join(outputDir, MANIFEST_FILE_NAME);
}

/** Each sheet is an independent seek + decode of its own window, run a few at a time. */
export async function generateOverviewSheets(options: GenerateOverviewSheetsOptions): Promise<FrameSheet[]> {
  assertPositiveFiniteNumber(options.duration, "duration");
  assertPositiveFiniteNumber(options.secondsPerSheet, "secondsPerSheet");
  assertPositiveFiniteNumber(options.fps, "fps");
  const streamInfo = await probeVideoStream(options.videoPath);
  const duration = Math.min(options.duration, streamInfo.duration);
  await mkdir(options.outputDir, { recursive: true });

  const sheets = await mapWithConcurrency(
    computeOverviewWindows(duration, options.secondsPerSheet, options.fps),
    OVERVIEW_CONCURRENCY,
    (window, sheetIndex) => extractFrameSheet({
      videoPath: options.videoPath,
      start: window.start,
      end: window.end,
      fps: options.fps,
      outputPath: path.join(options.outputDir, formatOverviewSheetFileName(sheetIndex)),
      maxSheetWidth: options.maxSheetWidth,
      streamInfo,
    }),
  );

  await writeFile(overviewManifestPath(options.outputDir), JSON.stringify(sheets, null, 2));
  return sheets;
}

export async function readOverviewManifest(outputDir: string): Promise<FrameSheet[]> {
  const manifestText = await readFile(overviewManifestPath(outputDir), "utf8");
  return JSON.parse(manifestText) as FrameSheet[];
}
