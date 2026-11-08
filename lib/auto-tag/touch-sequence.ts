/**
 * The run-up to a touch: the seconds before the lamp, where the phrase (who attacked, who
 * parried, who renewed) is visible. The agent reads it to pick an action code.
 */
export const TOUCH_SEQUENCE_DEFAULTS = {
  secondsBefore: 3,
  secondsAfter: 0.5,
  fps: 6,
} as const;

export const TOUCH_SEQUENCE_LIMITS = {
  maxSecondsBefore: 6,
  maxSecondsAfter: 2,
  maxFps: 15,
} as const;

/** Frames per sheet: 3 columns keeps tiles wide enough to read blade contact. */
export const TOUCH_SEQUENCE_SHEET_COLUMNS = 3;
export const TOUCH_SEQUENCE_FRAMES_PER_SHEET = 12;

export interface TouchSequenceRequest {
  time: number;
  secondsBefore?: number;
  secondsAfter?: number;
  fps?: number;
}

export interface TouchSequenceWindow {
  start: number;
  end: number;
  frameCount: number;
}

export interface TouchSequencePlan {
  start: number;
  end: number;
  fps: number;
  frameCount: number;
  /** Consecutive windows, each small enough for one sheet. */
  windows: TouchSequenceWindow[];
}

/**
 * Splits the sampling instants around `time` into sheet-sized windows. Instants are
 * `start + k / fps`; each window spans its own instants plus half a step so the last one is kept.
 */
export function planTouchSequence(
  request: TouchSequenceRequest,
  videoDuration: number,
  framesPerSheet: number = TOUCH_SEQUENCE_FRAMES_PER_SHEET,
): TouchSequencePlan {
  const fps = request.fps ?? TOUCH_SEQUENCE_DEFAULTS.fps;
  const before = request.secondsBefore ?? TOUCH_SEQUENCE_DEFAULTS.secondsBefore;
  const after = request.secondsAfter ?? TOUCH_SEQUENCE_DEFAULTS.secondsAfter;
  const start = Math.max(0, request.time - before);
  const end = Math.min(videoDuration, request.time + after);
  if (!(end > start)) {
    throw new Error(`No video around ${request.time.toFixed(3)}s: the video is ${videoDuration.toFixed(3)}s long.`);
  }
  const step = 1 / fps;
  const frameCount = Math.max(1, Math.ceil((end - start) * fps - 1e-9));
  const windows: TouchSequenceWindow[] = [];
  for (let first = 0; first < frameCount; first += framesPerSheet) {
    const count = Math.min(framesPerSheet, frameCount - first);
    const windowStart = start + first * step;
    const windowEnd = Math.min(end, windowStart + (count - 0.5) * step);
    windows.push({ start: windowStart, end: windowEnd, frameCount: count });
  }
  return { start, end, fps, frameCount, windows };
}
