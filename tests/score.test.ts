import assert from "node:assert/strict";
import test from "node:test";
import { buildScoreProgressionChartData } from "@/lib/score";
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
