import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateMaxHeartRate,
  getHeartRateZone,
} from "../lib/heart-rate";

test("estimates maximum heart rate from age at the recording date", () => {
  assert.equal(
    estimateMaxHeartRate("2004-01-25", new Date("2026-01-24T12:00:00Z")),
    199,
  );
  assert.equal(
    estimateMaxHeartRate("2004-01-25", new Date("2026-01-25T12:00:00Z")),
    198,
  );
});

test("assigns conventional five heart-rate zones at their boundaries", () => {
  const maximum = 200;
  assert.equal(getHeartRateZone(119, maximum), "zone1");
  assert.equal(getHeartRateZone(120, maximum), "zone2");
  assert.equal(getHeartRateZone(140, maximum), "zone3");
  assert.equal(getHeartRateZone(160, maximum), "zone4");
  assert.equal(getHeartRateZone(180, maximum), "zone5");
});
