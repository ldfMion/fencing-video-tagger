import type { CropRect, FrameTile, VideoStreamInfo } from "@/lib/auto-tag/frame-sheet";

/** Seek this far before the requested time so the select filter, not the demuxer, decides the first frame. */
const SEEK_LEAD_SECONDS = 0.5;
/** Tolerance for frames whose rational PTS rounds to just below the requested instant. */
const PTS_EPSILON_SECONDS = 0.0005;
/** How far past the requested time a single-frame lookup decodes before giving up. */
const SINGLE_FRAME_SEARCH_SECONDS = 2;
const JPEG_QUALITY = "3";

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetGrid {
  columns: number;
  rows: number;
}

export interface TileSize {
  width: number;
  height: number;
}

export interface FfprobeStream {
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
  tags?: { rotate?: string };
  side_data_list?: Array<{ rotation?: number | string }>;
}

export interface FfprobeStreamOutput {
  format?: { duration?: string };
  streams?: FfprobeStream[];
}

export interface FrameSheetCommandOptions {
  videoPath: string;
  start: number;
  end: number;
  fps: number;
  grid: SheetGrid;
  tileSize: TileSize;
  cropPixels?: PixelRect;
  outputPath: string;
}

export interface SingleFrameCommandOptions {
  videoPath: string;
  time: number;
  outputWidth: number;
  cropPixels?: PixelRect;
  outputPath: string;
}

export function buildProbeArgs(videoPath: string): string[] {
  return [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries",
    "format=duration:stream=width,height,avg_frame_rate,r_frame_rate,duration:stream_tags=rotate:stream_side_data=rotation",
    "-of", "json",
    videoPath,
  ];
}

export function parseFrameRate(rate: string | undefined): number {
  if (!rate) return Number.NaN;
  const [numerator, denominator = "1"] = rate.split("/");
  const value = Number(numerator) / Number(denominator);
  return Number.isFinite(value) && value > 0 ? value : Number.NaN;
}

export function readStreamRotationDegrees(stream: FfprobeStream): number {
  const sideDataRotation = stream.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation;
  const rawRotation = Number(sideDataRotation ?? stream.tags?.rotate ?? 0);
  if (!Number.isFinite(rawRotation)) return 0;
  return ((Math.round(rawRotation) % 360) + 360) % 360;
}

/** ffmpeg autorotates decoded frames, so crops and sizes must use the displayed orientation. */
export function isQuarterTurn(rotationDegrees: number): boolean {
  return rotationDegrees === 90 || rotationDegrees === 270;
}

export function parseVideoStreamInfo(output: FfprobeStreamOutput): VideoStreamInfo {
  const stream = output.streams?.[0];
  if (!stream?.width || !stream.height) {
    throw new Error("The video does not contain a readable video stream.");
  }

  const duration = Number(output.format?.duration ?? stream.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("The video does not contain a readable duration.");
  }

  const averageFrameRate = parseFrameRate(stream.avg_frame_rate);
  const frameRate = Number.isFinite(averageFrameRate) ? averageFrameRate : parseFrameRate(stream.r_frame_rate);
  const rotated = isQuarterTurn(readStreamRotationDegrees(stream));

  return {
    duration,
    width: rotated ? stream.height : stream.width,
    height: rotated ? stream.width : stream.height,
    frameRate: Number.isFinite(frameRate) ? frameRate : 0,
  };
}

function floorToEven(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}

export function convertCropToPixels(
  crop: CropRect | undefined,
  frame: Pick<VideoStreamInfo, "width" | "height">,
): PixelRect {
  if (!crop) return { x: 0, y: 0, width: frame.width, height: frame.height };

  const x = Math.min(Math.floor(crop.x * frame.width), frame.width - 2);
  const y = Math.min(Math.floor(crop.y * frame.height), frame.height - 2);
  return {
    x,
    y,
    width: floorToEven(Math.min(crop.width * frame.width, frame.width - x)),
    height: floorToEven(Math.min(crop.height * frame.height, frame.height - y)),
  };
}

export function computeSheetGrid(tileCount: number): SheetGrid {
  const safeCount = Math.max(1, Math.floor(tileCount));
  const columns = Math.ceil(Math.sqrt(safeCount));
  return { columns, rows: Math.ceil(safeCount / columns) };
}

/** Never upscales: a tile is at most the cropped source width. */
export function computeTileSize(source: PixelRect, columns: number, maxSheetWidth: number): TileSize {
  const width = floorToEven(Math.min(source.width, maxSheetWidth / columns));
  return { width, height: floorToEven((width * source.height) / source.width) };
}

export function computeSingleFrameWidth(source: PixelRect, maxWidth: number): number {
  return floorToEven(Math.min(source.width, maxWidth));
}

export function countSamplingInstants(start: number, end: number, fps: number): number {
  return Math.max(1, Math.ceil((end - start) * fps - 1e-9));
}

/** Upper bound on tiles: one per sampling bucket, but never more than the video actually has frames. */
export function estimateTileCount(start: number, end: number, fps: number, videoFrameRate: number): number {
  const bucketCount = countSamplingInstants(start, end, fps);
  if (!(videoFrameRate > 0)) return bucketCount;
  return Math.min(bucketCount, Math.ceil((end - start) * videoFrameRate) + 1);
}

function formatSeconds(seconds: number): string {
  return seconds.toFixed(6);
}

/**
 * Keeps the first frame in each 1/fps bucket of [start, end), i.e. the first frame at or after
 * each sampling instant. Commas are escaped because the expression lives inside a filtergraph.
 */
export function buildSamplingSelectExpression(start: number, end: number, fps: number): string {
  const lower = formatSeconds(start - PTS_EPSILON_SECONDS);
  const startText = formatSeconds(start);
  const endText = formatSeconds(end - PTS_EPSILON_SECONDS);
  const fpsText = String(fps);
  const bucketOf = (timeVariable: string) => `floor((${timeVariable}-${startText})*${fpsText}+${PTS_EPSILON_SECONDS * fps})`;
  const isNewBucket = `gt(${bucketOf("t")}\\,${bucketOf("prev_selected_t")})`;
  return `gte(t\\,${lower})*lt(t\\,${endText})*(isnan(prev_selected_t)+${isNewBucket})`;
}

function buildCropFilter(cropPixels: PixelRect | undefined): string[] {
  if (!cropPixels) return [];
  return [`crop=${cropPixels.width}:${cropPixels.height}:${cropPixels.x}:${cropPixels.y}:exact=1`];
}

export function buildFrameSheetFilterGraph(options: Omit<FrameSheetCommandOptions, "videoPath" | "outputPath">): string {
  const { start, end, fps, grid, tileSize, cropPixels } = options;
  return [
    `select='${buildSamplingSelectExpression(start, end, fps)}'`,
    "showinfo",
    ...buildCropFilter(cropPixels),
    `scale=${tileSize.width}:${tileSize.height}:flags=lanczos`,
    `tile=${grid.columns}x${grid.rows}`,
  ].join(",");
}

function buildSeekInputArgs(videoPath: string, start: number, end: number): string[] {
  const seekStart = Math.max(0, start - SEEK_LEAD_SECONDS);
  return [
    "-hide_banner", "-nostats", "-nostdin", "-y",
    "-copyts",
    "-ss", formatSeconds(seekStart),
    "-t", formatSeconds(end - seekStart + SEEK_LEAD_SECONDS),
    "-i", videoPath,
    "-an", "-sn", "-dn",
  ];
}

function buildSingleImageOutputArgs(outputPath: string): string[] {
  return ["-fps_mode", "passthrough", "-frames:v", "1", "-update", "1", "-q:v", JPEG_QUALITY, outputPath];
}

export function buildFrameSheetArgs(options: FrameSheetCommandOptions): string[] {
  return [
    ...buildSeekInputArgs(options.videoPath, options.start, options.end),
    "-vf", buildFrameSheetFilterGraph(options),
    ...buildSingleImageOutputArgs(options.outputPath),
  ];
}

function buildSingleFrameFilterGraph(selectExpression: string, options: SingleFrameCommandOptions): string {
  return [
    `select='${selectExpression}'`,
    "showinfo",
    ...buildCropFilter(options.cropPixels),
    `scale=${options.outputWidth}:-2:flags=lanczos`,
  ].join(",");
}

export function buildSingleFrameArgs(options: SingleFrameCommandOptions): string[] {
  const { time } = options;
  return [
    ...buildSeekInputArgs(options.videoPath, time, time + SINGLE_FRAME_SEARCH_SECONDS),
    "-vf", buildSingleFrameFilterGraph(
      `gte(t\\,${formatSeconds(time - PTS_EPSILON_SECONDS)})*isnan(prev_selected_t)`,
      options,
    ),
    ...buildSingleImageOutputArgs(options.outputPath),
  ];
}

/** Fallback for times past the final frame: every frame overwrites the image, so the last one remains. */
export function buildLastFrameBeforeArgs(options: SingleFrameCommandOptions): string[] {
  const { time } = options;
  const searchStart = Math.max(0, time - SINGLE_FRAME_SEARCH_SECONDS);
  return [
    ...buildSeekInputArgs(options.videoPath, searchStart, time + SINGLE_FRAME_SEARCH_SECONDS),
    "-vf", buildSingleFrameFilterGraph(`gte(t\\,${formatSeconds(searchStart - PTS_EPSILON_SECONDS)})`, options),
    "-fps_mode", "passthrough", "-update", "1", "-q:v", JPEG_QUALITY, options.outputPath,
  ];
}

const EMPTY_OUTPUT_PATTERN = /Nothing was written into output file|Output file is empty/;

export function isEmptyOutputFailure(stderr: string): boolean {
  return EMPTY_OUTPUT_PATTERN.test(stderr) && parseShowinfoPtsTimes(stderr).length === 0;
}

const SHOWINFO_PTS_TIME_PATTERN = /\[Parsed_showinfo[^\]]*\].*?\bpts_time:\s*(-?\d+(?:\.\d+)?)/;

export function parseShowinfoPtsTimes(stderr: string): number[] {
  return stderr
    .split(/\r?\n/)
    .map((line) => SHOWINFO_PTS_TIME_PATTERN.exec(line)?.[1])
    .filter((match): match is string => match !== undefined)
    .map(Number);
}

export function buildFrameTiles(ptsTimes: number[]): FrameTile[] {
  return ptsTimes.map((time, index) => ({ index, time }));
}

export interface OverviewWindow {
  start: number;
  end: number;
}

/** A trailing window shorter than one sampling interval may hold no frames, so it is dropped. */
export function computeOverviewWindows(duration: number, secondsPerSheet: number, fps: number): OverviewWindow[] {
  const sheetCount = Math.max(1, Math.ceil(duration / secondsPerSheet - 1e-9));
  const windows = Array.from({ length: sheetCount }, (_, sheetIndex) => ({
    start: sheetIndex * secondsPerSheet,
    end: Math.min((sheetIndex + 1) * secondsPerSheet, duration),
  }));
  const isSliver = (window: OverviewWindow) => window.end - window.start < 1 / fps;
  return windows.length > 1 && isSliver(windows[windows.length - 1]) ? windows.slice(0, -1) : windows;
}

export function formatOverviewSheetFileName(sheetIndex: number): string {
  return `sheet-${String(sheetIndex).padStart(4, "0")}.jpg`;
}
