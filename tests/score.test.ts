import assert from "node:assert/strict";
import test from "node:test";
import { buildScoreProgressionChartData, computeAverageScoreDifference } from "@/lib/score";
import type { Tag } from "@/lib/types";

function scoringTag(
  id: string,
  matchPeriod: Tag["matchPeriod"],
  matchClock?: Tag["matchClock"],
): Tag {
  return {
    id,
    createdAt: 0,
    comment: "",
    side: "L",
    action: "A,R",
    matchPeriod,
    matchClock,
  };
}

test("adds period break lines to scoring-order fallback timelines", () => {
  const chartData = buildScoreProgressionChartData([
    scoringTag("p1-1", "1", "0:10"),
    scoringTag("p1-2", "1", "2:30"),
    scoringTag("p2-1", "2", "2:50"),
  ]);

  assert.equal(chartData.xMode, "event");
  assert.deepEqual(chartData.breaks, [{ x: 2.5, label: "Break" }]);
});

test("keeps regulation-time break lines on chronological timelines", () => {
  const chartData = buildScoreProgressionChartData([
    scoringTag("p1", "1", "0:10"),
    scoringTag("p2", "2", "2:50"),
  ]);

  assert.equal(chartData.xMode, "time");
  assert.deepEqual(chartData.breaks, [{ x: 180, label: "Break" }]);
});


test("signed average cancels opposing leads and counts tied scores", () => {
  const tags = ["L", "R", "R", "L"].map((side, index) => ({
    ...scoringTag(String(index), "1"),
    createdAt: index,
    side: side as "L" | "R",
  }));
  assert.equal(computeAverageScoreDifference(tags), 0);
  assert.equal(computeAverageScoreDifference(tags.slice(0, 3)), 0);
  assert.equal(computeAverageScoreDifference(tags.slice(0, 2)), 0.5);
});

test("average ignores yellow cards and awards red-card points to the opponent", () => {
  const tags: Tag[] = [
    { ...scoringTag("touch", "1"), createdAt: 1 },
    { ...scoringTag("yellow", "1"), createdAt: 2, action: "yc" },
    { ...scoringTag("red", "1"), createdAt: 3, action: "rc" },
  ];
  assert.equal(computeAverageScoreDifference(tags), 0.5);
  assert.equal(computeAverageScoreDifference([{ ...tags[2], createdAt: 0 }]), -1);
  assert.equal(computeAverageScoreDifference([tags[1]]), null);
  assert.equal(computeAverageScoreDifference([]), null);
});


test("ends the timed chart at the last touch instead of padding the rest of the period", () => {
  const chartData = buildScoreProgressionChartData([
    scoringTag("p1", "1", "0:05"),
    scoringTag("p2", "2", "2:42"),
  ]);
  assert.equal(chartData.xMode, "time");
  assert.equal(chartData.domainMax, 198);
  assert.equal(chartData.points.length, 3);
  assert.equal(chartData.points.at(-1)?.x, 198);
  assert.equal(chartData.points.at(-1)?.tag?.id, "p2");
  assert.deepEqual(chartData.breaks, [{ x: 180, label: "Break" }]);
});

test("handles a last touch at period start without extending the axis to period end", () => {
  const chartData = buildScoreProgressionChartData([
    scoringTag("p1", "1", "0:05"),
    scoringTag("p2", "2", "3:00"),
  ]);
  assert.equal(chartData.domainMax, 180);
  assert.deepEqual(chartData.breaks, [{ x: 180, label: "Break" }]);
});
