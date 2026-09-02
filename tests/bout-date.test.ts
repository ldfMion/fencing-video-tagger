import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBoutDate } from "../lib/bout-date";

test("normalizes ISO and Brazilian legacy bout dates", () => {
  assert.equal(normalizeBoutDate("2026-02-21"), "2026-02-21");
  assert.equal(normalizeBoutDate("8/2/25"), "2025-02-08");
  assert.equal(normalizeBoutDate("31/1/26"), "2026-01-31");
  assert.equal(normalizeBoutDate("20/03/2025"), "2025-03-20");
});

test("rejects invalid dates without changing the preserved source value", () => {
  assert.equal(normalizeBoutDate("2025-02-30"), undefined);
  assert.equal(normalizeBoutDate("31/13/25"), undefined);
  assert.equal(normalizeBoutDate("not a date"), undefined);
  assert.equal(normalizeBoutDate(undefined), undefined);
});
