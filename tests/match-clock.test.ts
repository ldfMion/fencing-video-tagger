import assert from "node:assert/strict";
import test from "node:test";
import { getMatchTimeValidationError } from "@/lib/match-clock";
import { createTagRecord } from "@/lib/session-service";
import { assertTagMetadataMatchesSession, normalizeMatchClockInput } from "@/lib/tagging";
import type { Tag } from "@/lib/types";

function timedTag(id: string, timestamp: number | undefined, matchPeriod: Tag["matchPeriod"], matchClock: string, seq = 0): Tag {
  return { id, timestamp, matchPeriod, matchClock, seq, createdAt: 0, comment: "", side: "L", action: "A,R" };
}

const previous = timedTag("previous", 450, "1", "0:05");
const next = timedTag("next", 490, "2", "2:53");
const candidate = timedTag("candidate", 480, "1", "2:54");

test("rejects a countdown reset without advancing the period", () => {
  assert.match(getMatchTimeValidationError([previous, next], candidate)!, /previous tag \(P1 0:05\)/);
  assert.equal(getMatchTimeValidationError([previous, next], { ...candidate, matchPeriod: "2" }), null);
});

test("enforces regulation and priority duration limits", () => {
  for (const period of ["1", "2", "3"] as const) {
    assert.match(getMatchTimeValidationError([], { ...candidate, matchPeriod: period, matchClock: "3:01" })!, /0:00 and 3:00/);
    assert.equal(getMatchTimeValidationError([], { ...candidate, matchPeriod: period, matchClock: "3:00" }), null);
  }
  assert.match(getMatchTimeValidationError([], { ...candidate, matchPeriod: "priority", matchClock: "1:01" })!, /0:00 and 1:00/);
  assert.equal(getMatchTimeValidationError([], { ...candidate, matchPeriod: "priority", matchClock: "1:00" }), null);
  assert.equal(getMatchTimeValidationError([], { ...candidate, matchClock: "0:00" }), null);
  assert.ok(getMatchTimeValidationError([], { ...candidate, matchClock: "0:99" }));
});

test("checks both neighbors when inserting or editing a tag", () => {
  const before = timedTag("before", 10, "1", "2:30");
  const after = timedTag("after", 30, "1", "2:10");
  const edited = timedTag("edited", 20, "1", "2:20");
  const tags = [after, edited, before];
  assert.equal(getMatchTimeValidationError(tags, edited), null);
  assert.match(getMatchTimeValidationError(tags, { ...edited, matchClock: "2:31" })!, /previous tag/);
  assert.match(getMatchTimeValidationError(tags, { ...edited, matchClock: "2:09" })!, /next tag/);
  assert.equal(getMatchTimeValidationError(tags, { ...edited, matchClock: "2:30" }), null);
  assert.equal(getMatchTimeValidationError(tags, { ...edited, matchClock: "2:10" }), null);
});

test("does not allow going backwards across a period boundary at the same elapsed time", () => {
  assert.ok(getMatchTimeValidationError([timedTag("p2", 10, "2", "3:00")], timedTag("p1", 20, "1", "0:00")));
});

test("uses sequence order for videoless tags and equal video timestamps", () => {
  for (const timestamp of [undefined, 10]) {
    const first = timedTag("first", timestamp, "1", "2:30", 1);
    const second = timedTag("second", timestamp, "1", "2:20", 2);
    assert.ok(getMatchTimeValidationError([first], { ...second, matchClock: "2:40" }));
    assert.equal(getMatchTimeValidationError([first], second), null);
  }
});

test("skips untimed neighbors without blocking unrelated repairs", () => {
  const untimed: Tag = { id: "note", timestamp: 470, createdAt: 0, comment: "note" };
  const unrelatedInvalid = timedTag("old-error", 0, "1", "9:00");
  assert.equal(getMatchTimeValidationError([unrelatedInvalid, previous, untimed, next], { ...candidate, matchPeriod: "2" }), null);
  assert.equal(getMatchTimeValidationError([previous, next], untimed), null);
});

test("shared save validation rejects invalid creates and updates", () => {
  const session = { failureClassificationVersion: 2 as const, taggingOptions: { matchClockEnabled: true }, tags: [previous, next] };
  assert.throws(() => createTagRecord(candidate, session, { tagId: candidate.id }), /previous tag/);
  assert.throws(() => assertTagMetadataMatchesSession(session, candidate), /previous tag/);
  assert.doesNotThrow(() => assertTagMetadataMatchesSession(session, { ...candidate, matchPeriod: "2" }));
  assert.doesNotThrow(() => assertTagMetadataMatchesSession(session, { id: "note", createdAt: 0, comment: "note" }));
});

test("normalizes shorthand but rejects impossible seconds", () => {
  assert.equal(normalizeMatchClockInput("254"), "2:54");
  assert.equal(normalizeMatchClockInput("5"), "0:05");
  assert.equal(normalizeMatchClockInput("99"), undefined);
});
