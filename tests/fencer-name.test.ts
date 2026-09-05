import assert from "node:assert/strict";
import test from "node:test";
import {
  getUniqueFencerNames,
  normalizeFencerName,
} from "../lib/fencer-name";

test("normalizes names consistently with SQLite identity rules", () => {
  assert.equal(normalizeFencerName("  ALIce  "), "alice");
});

test("deduplicates fencer names by normalized identity", () => {
  assert.deepEqual(
    getUniqueFencerNames(["Alice", " ALICE ", "Bob", "bob"]),
    ["Alice", "Bob"],
  );
});
