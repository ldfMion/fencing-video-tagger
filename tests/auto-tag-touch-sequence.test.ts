import assert from "node:assert/strict";
import test from "node:test";
import { buildJobBrief } from "../lib/auto-tag/prompt";
import { planTouchSequence, TOUCH_SEQUENCE_DEFAULTS } from "../lib/auto-tag/touch-sequence";

test("a touch sequence has sparse context, a dense exchange, and full-frame lamp shots", () => {
  const plan = planTouchSequence({ time: 100 }, 600);
  assert.equal(plan.start, 96.5);
  assert.deepEqual(plan.windows.map((window) => [window.kind, window.frameCount, window.fps, window.cropped]), [
    ["context", 6, 3, true],
    ["exchange", 12, 12, true],
    ["exchange", 12, 12, true],
    ["lamps", 3, 2, false],
  ]);
  assert.equal(plan.frameCount, 33);
  const [context, exchange1, exchange2, lamps] = plan.windows;
  assert.equal(exchange1.start, 98.5);
  assert.ok(Math.abs(exchange2.start - 99.5) < 1e-9);
  assert.ok(context.end < exchange1.start && exchange1.end < exchange2.start);
  assert.ok(exchange2.end <= 100.5 + 1e-9, "the exchange runs to half a second after the lamp");
  assert.ok(Math.abs(lamps.start - 100.5) < 1e-9);
  // The window ends half a step past the last instant (101.5) so ffmpeg keeps that frame.
  assert.ok(lamps.end > 101.5 && lamps.end < 102);
  assert.equal(TOUCH_SEQUENCE_DEFAULTS.lampOffsets.length, 3);
});

test("a touch sequence is clamped to the video", () => {
  const atStart = planTouchSequence({ time: 1 }, 600);
  assert.equal(atStart.start, 0);
  assert.equal(atStart.windows[0].kind, "exchange", "no context when the exchange already starts at 0");
  const atEnd = planTouchSequence({ time: 599.9 }, 600);
  assert.ok(atEnd.windows.every((window) => window.kind !== "lamps"), "no lamp shots past the end of the video");
  assert.ok(atEnd.end <= 600);
  assert.throws(() => planTouchSequence({ time: 700 }, 600), /No video around/);
});

test("a longer or denser exchange changes the frame count", () => {
  const plan = planTouchSequence({ time: 50, exchangeSeconds: 3, exchangeFps: 6 }, 600);
  const exchange = plan.windows.filter((window) => window.kind === "exchange");
  assert.deepEqual(exchange.map((window) => window.frameCount), [12, 9]);
  assert.equal(exchange[0].start, 47);
});

test("the job brief tells the agent to inspect the run-up before choosing an action", () => {
  const brief = buildJobBrief({
    videoDuration: 100,
    matchClockEnabled: false,
    stripZoneEnabled: true,
    overviewSheetCount: 10,
    overviewFps: 2,
    secondsPerSheet: 10,
    framesPerCallLimit: 60,
    framesRemaining: 4000,
    tags: [],
  });
  assert.ok(brief.includes("`get_touch_sequence`"));
  assert.ok(brief.includes("never invent one to make the score add up"));
});
