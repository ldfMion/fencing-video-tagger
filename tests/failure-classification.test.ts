import assert from "node:assert/strict";
import test from "node:test";
import { exportSessionsToJson } from "../lib/session-export";
import {
  createSessionRecord,
  parseStoredSessionsFromRaw,
} from "../lib/session-service";
import { VideoSessionSchema } from "../lib/types";

const baseSession = {
  id: "bout-1",
  lastModified: 1,
};

test("new bouts explicitly use failure classification version 2", () => {
  const session = createSessionRecord({}, { now: 1, sessionId: "bout-1" });
  assert.equal(session.failureClassificationVersion, 2);
});

test("missing bout classification versions remain version 1", () => {
  const session = VideoSessionSchema.parse({ ...baseSession, tags: [] });
  assert.equal(session.failureClassificationVersion, 1);
});

test("version 1 preserves legacy classifications and rejects version 2 fields", () => {
  assert.equal(
    VideoSessionSchema.parse({
      ...baseSession,
      tags: [
        { id: "tag-1", createdAt: 1, comment: "", mistake: "tactical" },
      ],
    }).tags[0].mistake,
    "tactical",
  );

  assert.equal(
    VideoSessionSchema.safeParse({
      ...baseSession,
      tags: [
        { id: "tag-1", createdAt: 1, comment: "", failureMode: "distance" },
      ],
    }).success,
    false,
  );
});

test("version 2 accepts a failure mode and cause but rejects legacy mistakes", () => {
  const parsed = VideoSessionSchema.parse({
    ...baseSession,
    failureClassificationVersion: 2,
    tags: [
      {
        id: "tag-1",
        createdAt: 1,
        comment: "Repeated an attack from too far away",
        failureMode: "distance",
        failureCause: "discipline",
      },
    ],
  });
  assert.equal(parsed.tags[0].failureMode, "distance");
  assert.equal(parsed.tags[0].failureCause, "discipline");

  assert.equal(
    VideoSessionSchema.safeParse({
      ...baseSession,
      failureClassificationVersion: 2,
      tags: [
        { id: "tag-1", createdAt: 1, comment: "", mistake: "execution" },
      ],
    }).success,
    false,
  );
});

test("a cause cannot be stored without a failure mode", () => {
  assert.equal(
    VideoSessionSchema.safeParse({
      ...baseSession,
      failureClassificationVersion: 2,
      tags: [
        { id: "tag-1", createdAt: 1, comment: "", failureCause: "lapse" },
      ],
    }).success,
    false,
  );
});

test("JSON import and export preserve each bout's classification version", () => {
  const sessions = [
    VideoSessionSchema.parse({ ...baseSession, tags: [] }),
    VideoSessionSchema.parse({
      ...baseSession,
      id: "bout-2",
      failureClassificationVersion: 2,
      tags: [],
    }),
  ];
  const exported = JSON.parse(exportSessionsToJson(sessions));
  const reparsed = parseStoredSessionsFromRaw(exported);

  assert.equal(exported.version, 2);
  assert.deepEqual(
    reparsed.sessions.map((session) => session.failureClassificationVersion),
    [1, 2],
  );
});
