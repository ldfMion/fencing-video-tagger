import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client/node";
import test from "node:test";
import {
  LEGACY_BACKUP_SUFFIX,
  hashComment,
  openDatabase,
  toLocalLibsqlUrl,
} from "../lib/server/db/connection";

test("migrates legacy JSON sessions without loss and creates a native vector index", async () => {
  const temporaryDirectory = mkdtempSync(
    path.join(tmpdir(), "fencing-libsql-migration-"),
  );
  const databasePath = path.join(temporaryDirectory, "sessions.sqlite");
  const legacyClient = createClient({ url: toLocalLibsqlUrl(databasePath) });
  const session = {
    id: "bout-1",
    lastModified: 1234,
    leftFencer: "Esgrimista A",
    rightFencer: "Fencer B",
    boutDate: "8/2/25",
    taggingOptions: { matchClockEnabled: true },
  };
  const tag = {
    id: "tag-1",
    seq: 1,
    createdAt: 1234,
    comment: "Ataque preparado com muita distância",
    side: "L",
    action: "A-P",
    mistake: "tactical",
    matchPeriod: "1",
    matchClock: "2:30",
    stripZone: "3",
  };

  try {
    await legacyClient.batch([
      `CREATE TABLE sessions (
        id text PRIMARY KEY NOT NULL,
        payload text NOT NULL CHECK(json_valid(payload))
      )`,
      `CREATE TABLE tags (
        session_id text NOT NULL,
        id text NOT NULL,
        position integer NOT NULL,
        payload text NOT NULL CHECK(json_valid(payload)),
        PRIMARY KEY(session_id, id),
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE cascade
      )`,
      "CREATE UNIQUE INDEX tags_session_position_unique ON tags(session_id, position)",
      `CREATE TABLE __drizzle_migrations (
        id integer PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      )`,
      {
        sql: "INSERT INTO sessions(id, payload) VALUES (?, ?)",
        args: [session.id, JSON.stringify(session)],
      },
      {
        sql: "INSERT INTO tags(session_id, id, position, payload) VALUES (?, ?, ?, ?)",
        args: [session.id, tag.id, 0, JSON.stringify(tag)],
      },
      {
        sql: "INSERT INTO __drizzle_migrations(id, hash, created_at) VALUES (?, ?, ?)",
        args: [1, "legacy", 1788207684550],
      },
    ], "write");
    legacyClient.close();

    const { client, ready } = openDatabase(databasePath);
    await ready;
    assert.ok(existsSync(`${databasePath}${LEGACY_BACKUP_SUFFIX}`));

    const migrated = await client.execute(`
      SELECT
        b.id, b.left_fencer, b.right_fencer, b.bout_date, b.bout_date_iso,
        t.id AS tag_id, t.side, t.action, t.mistake, t.match_period,
        t.match_clock, t.strip_zone, c.body, c.content_hash
      FROM bouts AS b
      INNER JOIN tags AS t ON t.bout_id = b.id
      INNER JOIN comments AS c ON c.tag_row_id = t.row_id
    `);
    assert.equal(migrated.rows.length, 1);
    assert.deepEqual(migrated.rows[0], {
      id: session.id,
      left_fencer: session.leftFencer,
      right_fencer: session.rightFencer,
      bout_date: session.boutDate,
      bout_date_iso: "2025-02-08",
      tag_id: tag.id,
      side: tag.side,
      action: tag.action,
      mistake: tag.mistake,
      match_period: tag.matchPeriod,
      match_clock: tag.matchClock,
      strip_zone: tag.stripZone,
      body: tag.comment,
      content_hash: hashComment(tag.comment),
    });

    const participants = await client.execute(`
      SELECT p.side, p.display_name_snapshot, f.canonical_name, f.normalized_name
      FROM bout_participants AS p
      INNER JOIN fencers AS f ON f.id = p.fencer_id
      WHERE p.bout_id = 'bout-1'
      ORDER BY p.side
    `);
    assert.deepEqual(participants.rows, [
      {
        side: "L",
        display_name_snapshot: "Esgrimista A",
        canonical_name: "Esgrimista A",
        normalized_name: "esgrimista a",
      },
      {
        side: "R",
        display_name_snapshot: "Fencer B",
        canonical_name: "Fencer B",
        normalized_name: "fencer b",
      },
    ]);

    const vector = JSON.stringify(Array.from({ length: 256 }, (_, index) =>
      index === 0 ? 1 : 0
    ));
    await client.execute({
      sql: `INSERT INTO comment_embeddings (
        comment_id, embedding, model_id, model_revision, artifact_id,
        artifact_revision, prompt_version, dimensions, comment_hash, generated_at
      ) VALUES (1, vector32(?), 'model', 'revision', 'artifact',
        'artifact-revision', 'prompt', 256, ?, 1)`,
      args: [vector, hashComment(tag.comment)],
    });
    const nearest = await client.execute({
      sql: "SELECT id FROM vector_top_k('comment_embeddings_vector_idx', vector32(?), 1)",
      args: [vector],
    });
    assert.equal(Number(nearest.rows[0]?.id), 1);
    client.close();
  } finally {
    legacyClient.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
