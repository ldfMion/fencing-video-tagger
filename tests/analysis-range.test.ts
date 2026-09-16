import assert from "node:assert/strict";
import test from "node:test";
import { filterTagsByAnalysisRange } from "../lib/analysis-range";
import { computeRunningScore, computeScore } from "../lib/score";
import type { Tag } from "../lib/types";

const tags: Tag[] = [
  { id: "before", seq: 1, createdAt: 1, comment: "", side: "L", action: "A-A" },
  { id: "start", seq: 2, createdAt: 2, comment: "", side: "R", action: "A-A" },
  { id: "note", seq: 3, createdAt: 3, comment: "Changed distance" },
  { id: "yellow", seq: 4, createdAt: 4, comment: "", side: "R", action: "yc" },
  { id: "end", seq: 5, createdAt: 5, comment: "", side: "L", action: "rc" },
  { id: "after", seq: 6, createdAt: 6, comment: "", side: "L", action: "A-A" },
];

test("inclusive selection retains intermediate notes and respects card scoring", () => {
  const selected = filterTagsByAnalysisRange([...tags].reverse(), { startId: "start", endId: "end" });
  assert.deepEqual(selected.map((tag) => tag.id), ["start", "note", "yellow", "end"]);
  assert.deepEqual(computeScore(selected), { left: 0, right: 2 });
  const selectedIds = new Set(selected.map((tag) => tag.id));
  const originalScores = computeRunningScore(tags).filter((event) => selectedIds.has(event.tag.id));
  assert.deepEqual(originalScores.map(({ leftScore, rightScore }) => [leftScore, rightScore]), [[1, 1], [1, 1], [1, 2]]);
});

test("single-event and reverse selections use stable tag boundaries", () => {
  assert.deepEqual(filterTagsByAnalysisRange(tags, { startId: "yellow", endId: "yellow" }).map((tag) => tag.id), ["yellow"]);
  assert.deepEqual(filterTagsByAnalysisRange(tags, { startId: "end", endId: "start" }), tags.slice(1, 5));
});

test("clearing or deleting a boundary restores all tags, including notes", () => {
  assert.equal(filterTagsByAnalysisRange(tags, null), tags);
  assert.equal(filterTagsByAnalysisRange(tags, { startId: "deleted", endId: "end" }), tags);
  assert.deepEqual(filterTagsByAnalysisRange([], null), []);
});

test("video order and sequence break ties independently of repeated match clocks", () => {
  const timedTags = tags.map((tag, index) => ({ ...tag, timestamp: index < 3 ? 10 : 20, matchPeriod: "1" as const, matchClock: "2:30" }));
  assert.deepEqual(filterTagsByAnalysisRange([...timedTags].reverse(), { startId: "start", endId: "end" }).map((tag) => tag.id), ["start", "note", "yellow", "end"]);
});
