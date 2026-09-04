import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionVideoUrl } from "../lib/video-library";

test("buildSessionVideoUrl exposes only the encoded session identity", () => {
  assert.equal(
    buildSessionVideoUrl({ id: "bout/with spaces" }),
    "/api/videos/bout%2Fwith%20spaces",
  );
});
