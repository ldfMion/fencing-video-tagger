import assert from "node:assert/strict";
import test from "node:test";
import type { AgentTagFields } from "@/lib/auto-tag/agent-tag-fields";
import {
  evaluateAutoTagJob,
  type AutoTagEvaluationInput,
} from "@/lib/auto-tag/evaluation";
import type { Tag } from "@/lib/types";

function referenceTag(
  id: string,
  timestamp: number | undefined,
  overrides: Partial<Tag> = {},
): Tag {
  return {
    id,
    timestamp,
    createdAt: 0,
    comment: "",
    side: "L",
    action: "A-P",
    ...overrides,
  };
}

function agentFields(
  timestamp: number,
  overrides: Partial<AgentTagFields> = {},
): AgentTagFields {
  return { timestamp, side: "L", action: "A-P", ...overrides };
}

function evaluate(overrides: Partial<AutoTagEvaluationInput>) {
  return evaluateAutoTagJob({
    agentTags: new Map(),
    referenceTags: [],
    mode: "review",
    matchClockEnabled: false,
    stripZoneEnabled: false,
    ...overrides,
  });
}

test("perfect agreement scores every metric at 1", () => {
  const result = evaluate({
    agentTags: new Map([
      ["a", agentFields(10)],
      ["b", agentFields(20, { side: "R", action: "R-R" })],
    ]),
    referenceTags: [
      referenceTag("a", 10),
      referenceTag("b", 20, { side: "R", action: "R-R" }),
    ],
  });

  assert.deepEqual(result.counts, {
    agentTouches: 2,
    referenceTouches: 2,
    matched: 2,
    replacements: 0,
    extras: 0,
    misses: 0,
  });
  assert.equal(result.precision, 1);
  assert.equal(result.recall, 1);
  assert.equal(result.timing.medianAbsoluteErrorSeconds, 0);
  assert.equal(result.timing.shareWithinHalfSecond, 1);
  assert.equal(result.side.share, 1);
  assert.deepEqual(result.action, { exactShare: 1, intentShare: 1 });
  assert.equal(result.matchClock, null);
  assert.equal(result.stripZone, null);
  assert.deepEqual(result.score, {
    agent: { left: 1, right: 1 },
    reference: { left: 1, right: 1 },
  });
  assert.ok(result.pairs.every((pair) => pair.differingFields.length === 0));
});

test("review mode pairs edited tags by id even when the time moved far", () => {
  const result = evaluate({
    agentTags: new Map([
      ["a", agentFields(10, { action: "A-P" })],
      ["b", agentFields(20, { action: "A-A" })],
    ]),
    referenceTags: [
      referenceTag("a", 40, { side: "R", action: "R-R" }),
      referenceTag("b", 20.3, { action: "A,R" }),
    ],
  });

  assert.equal(result.counts.matched, 2);
  assert.equal(result.counts.replacements, 0);
  assert.equal(result.side.share, 0.5);
  assert.equal(result.action.exactShare, 0);
  assert.equal(result.action.intentShare, 0.5);
  assert.ok(Math.abs(result.timing.medianAbsoluteErrorSeconds! - 15.15) < 1e-9);
  assert.equal(result.timing.shareWithinHalfSecond, 0.5);

  const movedPair = result.pairs.find((pair) => pair.agentTagId === "a");
  assert.equal(movedPair?.kind, "same-id");
  assert.equal(movedPair?.timeDeltaSeconds, 30);
  assert.deepEqual(movedPair?.differingFields, ["timestamp", "side", "action"]);
});

test("review mode counts a deleted and re-created nearby tag as a replacement", () => {
  const result = evaluate({
    agentTags: new Map([["agent-1", agentFields(10)]]),
    referenceTags: [referenceTag("user-1", 11)],
  });

  assert.equal(result.counts.matched, 1);
  assert.equal(result.counts.replacements, 1);
  assert.equal(result.counts.extras, 0);
  assert.equal(result.counts.misses, 0);
  assert.equal(result.pairs[0].kind, "time-matched");
  assert.equal(result.pairs[0].referenceTagId, "user-1");
});

test("unpaired agent tags are extras and unpaired reference touches are misses", () => {
  const result = evaluate({
    agentTags: new Map([
      ["a", agentFields(10)],
      ["ghost", agentFields(50)],
    ]),
    referenceTags: [
      referenceTag("a", 10),
      referenceTag("missed", 90),
      referenceTag("untimed", undefined),
    ],
  });

  assert.equal(result.counts.matched, 1);
  assert.deepEqual(result.extraAgentTagIds, ["ghost"]);
  assert.deepEqual(result.missedReferenceTagIds, ["missed", "untimed"]);
  assert.equal(result.precision, 0.5);
  assert.equal(result.recall, 1 / 3);
});

test("benchmark mode pairs by nearest time only and ignores matching ids", () => {
  const result = evaluate({
    mode: "benchmark",
    agentTags: new Map([
      ["shared-id", agentFields(10)],
      ["near", agentFields(30)],
      ["too-far", agentFields(60)],
    ]),
    referenceTags: [
      referenceTag("shared-id", 100),
      referenceTag("ref-near-a", 31.5),
      referenceTag("ref-near-b", 29.8),
      referenceTag("ref-far", 62.5),
    ],
  });

  assert.equal(result.counts.matched, 1);
  assert.equal(result.counts.replacements, 0);
  assert.deepEqual(result.pairs.map((pair) => [pair.agentTagId, pair.referenceTagId, pair.kind]), [
    ["near", "ref-near-b", "time-matched"],
  ]);
  assert.deepEqual(result.extraAgentTagIds, ["shared-id", "too-far"]);
  assert.deepEqual(result.missedReferenceTagIds, ["shared-id", "ref-near-a", "ref-far"]);
});

test("greedy time pairing assigns the closest pairs first", () => {
  const result = evaluate({
    mode: "benchmark",
    agentTags: new Map([
      ["x", agentFields(10)],
      ["y", agentFields(11)],
    ]),
    referenceTags: [referenceTag("p", 11.1), referenceTag("q", 9.5)],
  });

  assert.deepEqual(
    result.pairs.map((pair) => [pair.agentTagId, pair.referenceTagId]).sort(),
    [["x", "q"], ["y", "p"]],
  );
});

test("match clock only counts exact period and clock agreement", () => {
  const result = evaluate({
    matchClockEnabled: true,
    agentTags: new Map([
      ["exact", agentFields(10, { matchPeriod: "1", matchClock: "2:30" })],
      ["one-second-off", agentFields(20, { matchPeriod: "1", matchClock: "2:10" })],
      ["wrong-period", agentFields(30, { matchPeriod: "2", matchClock: "1:50" })],
    ]),
    referenceTags: [
      referenceTag("exact", 10, { matchPeriod: "1", matchClock: "2:30" }),
      referenceTag("one-second-off", 20, { matchPeriod: "1", matchClock: "2:11" }),
      referenceTag("wrong-period", 30, { matchPeriod: "1", matchClock: "1:50" }),
    ],
  });

  assert.deepEqual(result.matchClock, { exactShare: 1 / 3 });
  const offByOne = result.pairs.find((pair) => pair.agentTagId === "one-second-off");
  assert.deepEqual(offByOne?.differingFields, ["matchClock"]);
});

test("strip zone reports exact and within-one-zone agreement", () => {
  const result = evaluate({
    stripZoneEnabled: true,
    agentTags: new Map([
      ["exact", agentFields(10, { stripZone: "3" })],
      ["adjacent", agentFields(20, { stripZone: "2" })],
      ["far", agentFields(30, { stripZone: "1" })],
      ["missing", agentFields(40)],
    ]),
    referenceTags: [
      referenceTag("exact", 10, { stripZone: "3" }),
      referenceTag("adjacent", 20, { stripZone: "3" }),
      referenceTag("far", 30, { stripZone: "4" }),
      referenceTag("missing", 40, { stripZone: "5" }),
    ],
  });

  assert.deepEqual(result.stripZone, { exactShare: 0.25, withinOneZoneShare: 0.5 });
  assert.equal(result.matchClock, null);
});

test("rates are null when there is nothing to divide by", () => {
  const result = evaluate({
    matchClockEnabled: true,
    stripZoneEnabled: true,
  });

  assert.equal(result.precision, null);
  assert.equal(result.recall, null);
  assert.deepEqual(result.timing, {
    medianAbsoluteErrorSeconds: null,
    shareWithinHalfSecond: null,
  });
  assert.equal(result.side.share, null);
  assert.deepEqual(result.action, { exactShare: null, intentShare: null });
  assert.deepEqual(result.matchClock, { exactShare: null });
  assert.deepEqual(result.stripZone, { exactShare: null, withinOneZoneShare: null });
  assert.deepEqual(result.score.agent, { left: 0, right: 0 });
});

test("comment-only reference tags are not scoring touches", () => {
  const result = evaluate({
    agentTags: new Map([["note", agentFields(10)]]),
    referenceTags: [
      { id: "note", timestamp: 10, createdAt: 0, comment: "nice distance" },
      { id: "other", timestamp: 10.5, createdAt: 0, comment: "", side: "L" },
    ],
  });

  assert.equal(result.counts.referenceTouches, 0);
  assert.equal(result.counts.matched, 0);
  assert.deepEqual(result.extraAgentTagIds, ["note"]);
  assert.deepEqual(result.missedReferenceTagIds, []);
  assert.equal(result.recall, null);
});

test("card actions flow through computeScore for both final scores", () => {
  const result = evaluate({
    agentTags: new Map([
      ["touch", agentFields(10, { side: "L", action: "A-P" })],
      ["yellow", agentFields(20, { side: "R", action: "yc" })],
      ["red", agentFields(30, { side: "R", action: "rc" })],
    ]),
    referenceTags: [
      referenceTag("touch", 10, { side: "L", action: "A-P" }),
      referenceTag("yellow", 20, { side: "R", action: "rc" }),
      referenceTag("red", 30, { side: "R", action: "rc" }),
    ],
  });

  assert.deepEqual(result.score.agent, { left: 2, right: 0 });
  assert.deepEqual(result.score.reference, { left: 3, right: 0 });
  assert.equal(result.action.intentShare, 1);
  assert.equal(result.action.exactShare, 2 / 3);
});
