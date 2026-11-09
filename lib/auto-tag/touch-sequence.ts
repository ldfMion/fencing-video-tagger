/**
 * The run-up to a touch and its outcome, in three parts the agent reads to pick an action code:
 * a sparse context sheet (footwork and distance), a dense exchange around the lamp (blade work),
 * and an uncropped lamp sheet after the hit so the lights and the box are always visible.
 */
export const TOUCH_SEQUENCE_DEFAULTS = {
  /** Seconds of sparse context before the exchange. */
  contextSeconds: 2,
  contextFps: 3,
  /** Seconds before the lamp covered densely. */
  exchangeSeconds: 1.5,
  /** Seconds after the lamp still covered densely (the hit itself and the first lamp frames). */
  exchangeAfterSeconds: 0.5,
  exchangeFps: 12,
  /** Uncropped frames after the lamp: the lights on the box, then the delayed broadcast score overlay. */
  lampOffsets: [0.5, 1, 1.5],
} as const;

export const TOUCH_SEQUENCE_LIMITS = {
  minExchangeSeconds: 1,
  maxExchangeSeconds: 3,
  minExchangeFps: 6,
  maxExchangeFps: 15,
} as const;

/** 3 columns keeps tiles wide enough to read blade contact. */
export const TOUCH_SEQUENCE_SHEET_COLUMNS = 3;
export const TOUCH_SEQUENCE_FRAMES_PER_SHEET = 12;

export interface TouchSequenceRequest {
  time: number;
  /** Length of the dense exchange before the lamp. */
  exchangeSeconds?: number;
  exchangeFps?: number;
}

export type TouchSequenceSegmentKind = "context" | "exchange" | "lamps";

export interface TouchSequenceWindow {
  kind: TouchSequenceSegmentKind;
  start: number;
  end: number;
  fps: number;
  frameCount: number;
  /** Whether the caller's crop applies; the lamp sheet is always the full frame. */
  cropped: boolean;
}

export interface TouchSequencePlan {
  start: number;
  end: number;
  frameCount: number;
  /** Consecutive windows, oldest first, each small enough for one sheet. */
  windows: TouchSequenceWindow[];
}

export function planTouchSequence(
  request: TouchSequenceRequest,
  videoDuration: number,
  framesPerSheet: number = TOUCH_SEQUENCE_FRAMES_PER_SHEET,
): TouchSequencePlan {
  const d = TOUCH_SEQUENCE_DEFAULTS;
  const exchangeSeconds = request.exchangeSeconds ?? d.exchangeSeconds;
  const exchangeFps = request.exchangeFps ?? d.exchangeFps;
  const time = request.time;
  if (!(time >= 0 && time <= videoDuration)) {
    throw new Error(`No video around ${time.toFixed(3)}s: the video is ${videoDuration.toFixed(3)}s long.`);
  }

  const windows: TouchSequenceWindow[] = [];
  const exchangeStart = Math.max(0, time - exchangeSeconds);
  const contextStart = Math.max(0, exchangeStart - d.contextSeconds);
  if (exchangeStart > contextStart) {
    windows.push(...splitWindow("context", contextStart, exchangeStart, d.contextFps, true, framesPerSheet));
  }
  const exchangeEnd = Math.min(videoDuration, time + d.exchangeAfterSeconds);
  windows.push(...splitWindow("exchange", exchangeStart, exchangeEnd, exchangeFps, true, framesPerSheet));

  const lampOffsets = d.lampOffsets.filter((offset) => time + offset <= videoDuration);
  if (lampOffsets.length > 0) {
    const step = lampOffsets.length > 1 ? lampOffsets[1] - lampOffsets[0] : 0.5;
    const lampStart = time + lampOffsets[0];
    windows.push({
      kind: "lamps",
      start: lampStart,
      end: Math.min(videoDuration, lampStart + (lampOffsets.length - 0.5) * step),
      fps: 1 / step,
      frameCount: lampOffsets.length,
      cropped: false,
    });
  }

  return {
    start: windows[0].start,
    end: windows[windows.length - 1].end,
    frameCount: windows.reduce((sum, window) => sum + window.frameCount, 0),
    windows,
  };
}

/**
 * Splits [start, end) sampled at `fps` into sheet-sized windows. Instants are `start + k / fps`;
 * each window spans its own instants plus half a step so the last one is kept.
 */
function splitWindow(
  kind: TouchSequenceSegmentKind,
  start: number,
  end: number,
  fps: number,
  cropped: boolean,
  framesPerSheet: number,
): TouchSequenceWindow[] {
  const step = 1 / fps;
  const frameCount = Math.max(1, Math.ceil((end - start) * fps - 1e-9));
  const windows: TouchSequenceWindow[] = [];
  for (let first = 0; first < frameCount; first += framesPerSheet) {
    const count = Math.min(framesPerSheet, frameCount - first);
    const windowStart = start + first * step;
    windows.push({
      kind,
      start: windowStart,
      end: Math.min(end, windowStart + (count - 0.5) * step),
      fps,
      frameCount: count,
      cropped,
    });
  }
  return windows;
}
