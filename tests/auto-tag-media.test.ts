import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  buildFrameSheetArgs,
  buildSingleFrameArgs,
  computeOverviewWindows,
  computeSheetGrid,
  computeTileSize,
  convertCropToPixels,
  estimateTileCount,
  formatOverviewSheetFileName,
  isEmptyOutputFailure,
  parseShowinfoPtsTimes,
  parseVideoStreamInfo,
} from "@/lib/server/auto-tag/ffmpeg-helpers";

const execFileAsync = promisify(execFile);

const SHOWINFO_STDERR = [
  "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'clip.mp4':",
  "[Parsed_showinfo_1 @ 0x600] config in time_base: 1/15360, frame_rate: 60/1",
  "[Parsed_showinfo_1 @ 0x600] n:   0 pts: 153600 pts_time:10      duration: 256 fmt:yuv420p",
  "[Parsed_showinfo_1 @ 0x600] n:   1 pts: 161536 pts_time:10.516667 duration: 256 fmt:yuv420p",
  "[Parsed_showinfo_1 @ 0x600] color_range:tv color_space:bt709",
  "frame=    1 fps=0.0 q=-0.0 Lsize=N/A time=00:00:10.51",
].join("\n");

test("parses source PTS from showinfo lines only", () => {
  assert.deepEqual(parseShowinfoPtsTimes(SHOWINFO_STDERR), [10, 10.516667]);
});

test("treats ffmpeg's empty-output error as zero frames", () => {
  assert.equal(isEmptyOutputFailure("[out#0/image2 @ 0x1] Nothing was written into output file, because ..."), true);
  assert.equal(isEmptyOutputFailure("Invalid data found when processing input"), false);
});

test("sizes grids to stay near square", () => {
  assert.deepEqual(computeSheetGrid(20), { columns: 5, rows: 4 });
  assert.deepEqual(computeSheetGrid(1), { columns: 1, rows: 1 });
  assert.deepEqual(computeSheetGrid(0), { columns: 1, rows: 1 });
  assert.deepEqual(computeSheetGrid(150), { columns: 13, rows: 12 });
});

test("caps the tile count by the video's own frame rate", () => {
  assert.equal(estimateTileCount(0, 10, 2, 60), 20);
  assert.equal(estimateTileCount(0, 2, 30, 10), 21);
  assert.equal(estimateTileCount(3, 3.1, 2, 30), 1);
});

test("converts normalized crops to even pixel rectangles inside the frame", () => {
  const frame = { width: 1920, height: 1080 };
  assert.deepEqual(convertCropToPixels(undefined, frame), { x: 0, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(
    convertCropToPixels({ x: 0.4, y: 0, width: 0.2, height: 0.15 }, frame),
    { x: 768, y: 0, width: 384, height: 162 },
  );
  assert.deepEqual(
    convertCropToPixels({ x: 0.9, y: 0.9, width: 0.1001, height: 0.1001 }, frame),
    { x: 1728, y: 972, width: 192, height: 108 },
  );
});

test("fits tiles into the sheet width without upscaling", () => {
  assert.deepEqual(computeTileSize({ x: 0, y: 0, width: 1920, height: 1080 }, 5, 2048), { width: 408, height: 228 });
  assert.deepEqual(computeTileSize({ x: 0, y: 0, width: 200, height: 100 }, 2, 2048), { width: 200, height: 100 });
});

test("swaps dimensions for quarter-turn display rotation", () => {
  const info = parseVideoStreamInfo({
    format: { duration: "12.5" },
    streams: [{ width: 1920, height: 1080, avg_frame_rate: "30000/1001", side_data_list: [{ rotation: -90 }] }],
  });
  assert.equal(info.width, 1080);
  assert.equal(info.height, 1920);
  assert.equal(info.duration, 12.5);
  assert.ok(Math.abs(info.frameRate - 29.97) < 0.01);
});

test("splits the overview into fixed windows and drops a frameless sliver", () => {
  assert.deepEqual(computeOverviewWindows(25, 10, 2), [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
    { start: 20, end: 25 },
  ]);
  assert.equal(computeOverviewWindows(30.1, 10, 2).length, 3);
  assert.equal(formatOverviewSheetFileName(7), "sheet-0007.jpg");
});

async function isFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function readFramePtsTimes(videoPath: string): Promise<number[]> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", videoPath,
  ]);
  return stdout.trim().split("\n").map((line) => Number(line.replace(/,$/, "")));
}

function firstFramesPerSamplingInstant(framePtsTimes: number[], start: number, end: number, fps: number): number[] {
  const chosen = new Set<number>();
  for (let instantIndex = 0; start + instantIndex / fps < end; instantIndex++) {
    const instant = start + instantIndex / fps;
    const frameTime = framePtsTimes.find((time) => time >= instant - 0.0005);
    if (frameTime !== undefined && frameTime < end) chosen.add(frameTime);
  }
  return [...chosen];
}

test("real ffmpeg run reports absolute PTS of variable-frame-rate frames", { timeout: 60_000 }, async (context) => {
  if (!(await isFfmpegAvailable())) {
    context.skip("ffmpeg is not installed");
    return;
  }
  const workDir = await mkdtemp(path.join(os.tmpdir(), "auto-tag-media-"));
  try {
    const videoPath = path.join(workDir, "vfr.mp4");
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc=size=320x180:rate=60:duration=8",
      "-vf", "select='not(eq(mod(n\\,7)\\,3))*not(between(mod(n\\,97)\\,40\\,55))'",
      "-fps_mode", "vfr", "-c:v", "libx264", "-g", "120", "-pix_fmt", "yuv420p", videoPath,
    ]);
    const framePtsTimes = await readFramePtsTimes(videoPath);

    const sheetWindow = { start: 3.2, end: 5.2, fps: 8 };
    const sheetResult = await execFileAsync("ffmpeg", buildFrameSheetArgs({
      videoPath,
      ...sheetWindow,
      grid: computeSheetGrid(16),
      tileSize: { width: 80, height: 44 },
      cropPixels: { x: 80, y: 0, width: 160, height: 90 },
      outputPath: path.join(workDir, "sheet.jpg"),
    }));
    assert.deepEqual(
      parseShowinfoPtsTimes(sheetResult.stderr),
      firstFramesPerSamplingInstant(framePtsTimes, sheetWindow.start, sheetWindow.end, sheetWindow.fps),
    );

    const singleResult = await execFileAsync("ffmpeg", buildSingleFrameArgs({
      videoPath,
      time: 1.01,
      outputWidth: 320,
      outputPath: path.join(workDir, "single.jpg"),
    }));
    assert.deepEqual(parseShowinfoPtsTimes(singleResult.stderr), [framePtsTimes.find((time) => time >= 1.01)]);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});
