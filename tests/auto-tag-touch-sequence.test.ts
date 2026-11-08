import assert from "node:assert/strict";
import test from "node:test";
import { buildJobBrief } from "../lib/auto-tag/prompt";
import { planTouchSequence, TOUCH_SEQUENCE_DEFAULTS } from "../lib/auto-tag/touch-sequence";

test("a touch sequence covers the run-up and splits into sheet-sized windows", () => {
  const plan = planTouchSequence({ time: 100 }, 600);
  assert.equal(plan.start, 97);
  assert.equal(plan.end, 100.5);
  assert.equal(plan.fps, TOUCH_SEQUENCE_DEFAULTS.fps);
  assert.equal(plan.frameCount, 21);
  assert.equal(plan.windows.length, 2);
  assert.deepEqual(plan.windows.map((window) => window.frameCount), [12, 9]);
  // Windows are consecutive: the second starts one step after the first's last instant.
  const step = 1 / plan.fps;
  assert.ok(Math.abs(plan.windows[1].start - (plan.start + 12 * step)) < 1e-9);
  assert.ok(plan.windows[0].end < plan.windows[1].start);
  assert.ok(plan.windows[1].end <= plan.end);
});

test("a touch sequence is clamped to the video", () => {
  const atStart = planTouchSequence({ time: 1, secondsBefore: 3, secondsAfter: 1 }, 600);
  assert.equal(atStart.start, 0);
  assert.equal(atStart.end, 2);
  const atEnd = planTouchSequence({ time: 599.8 }, 600);
  assert.equal(atEnd.end, 600);
  assert.throws(() => planTouchSequence({ time: 700 }, 600), /No video around/);
});

test("custom fps and window change the frame count", () => {
  const plan = planTouchSequence({ time: 50, secondsBefore: 2, secondsAfter: 0, fps: 10 }, 600, 12);
  assert.equal(plan.frameCount, 20);
  assert.deepEqual(plan.windows.map((window) => window.frameCount), [12, 8]);
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
