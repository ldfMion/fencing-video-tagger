import assert from "node:assert/strict";
import test from "node:test";
import { CommentSearchInputSchema } from "../lib/comment-search";

test("accepts filter-only touch searches with replay-first defaults", () => {
  const input = CommentSearchInputSchema.parse({});

  assert.equal(input.query, "");
  assert.equal(input.limit, 50);
  assert.equal(input.offset, 0);
  assert.deepEqual(input.filters, {
    fencers: [],
    actions: [],
    mistakes: [],
    periods: [],
    stripZones: [],
    includeWithoutReplay: false,
  });
});

test("preserves multi-select touch search filters", () => {
  const input = CommentSearchInputSchema.parse({
    query: "  second intention  ",
    filters: {
      fencers: ["Mion", "Marostega"],
      actions: ["A-P", "CT-P"],
      mistakes: ["tactical"],
      periods: ["1", "priority"],
      stripZones: ["2", "4"],
      includeWithoutReplay: true,
    },
  });

  assert.equal(input.query, "second intention");
  assert.deepEqual(input.filters.fencers, ["Mion", "Marostega"]);
  assert.deepEqual(input.filters.actions, ["A-P", "CT-P"]);
  assert.equal(input.filters.includeWithoutReplay, true);
});
