import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const float32Vector = customType<{
  data: Uint8Array;
  driverData: Uint8Array;
  config: { dimensions: number };
  configRequired: true;
}>({
  dataType(config) {
    return `F32_BLOB(${config.dimensions})`;
  },
});

export const boutsTable = sqliteTable(
  "bouts",
  {
    id: text("id").primaryKey(),
    fileName: text("file_name"),
    videoRelativePath: text("video_relative_path"),
    videoMimeType: text("video_mime_type"),
    videoSourceType: text("video_source_type"),
    lastModified: integer("last_modified").notNull(),
    leftFencer: text("left_fencer"),
    rightFencer: text("right_fencer"),
    boutDate: text("bout_date"),
    boutDateIso: text("bout_date_iso"),
    boutType: text("bout_type"),
    externalSource: text("external_source"),
    matchClockEnabled: integer("match_clock_enabled", { mode: "boolean" }),
    stripZoneEnabled: integer("strip_zone_enabled", { mode: "boolean" }),
  },
  (table) => [
    index("bouts_left_fencer_idx").on(table.leftFencer),
    index("bouts_right_fencer_idx").on(table.rightFencer),
    index("bouts_bout_date_iso_idx").on(table.boutDateIso),
    check(
      "bouts_video_source_type_valid",
      sql`${table.videoSourceType} IS NULL OR ${table.videoSourceType} IN ('library', 'temporary')`,
    ),
  ],
);

export const fencersTable = sqliteTable(
  "fencers",
  {
    id: text("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("fencers_normalized_name_unique").on(table.normalizedName),
  ],
);

export const boutParticipantsTable = sqliteTable(
  "bout_participants",
  {
    boutId: text("bout_id").notNull()
      .references(() => boutsTable.id, { onDelete: "cascade" }),
    side: text("side").notNull(),
    fencerId: text("fencer_id").notNull()
      .references(() => fencersTable.id, { onDelete: "restrict" }),
    displayNameSnapshot: text("display_name_snapshot").notNull(),
  },
  (table) => [
    uniqueIndex("bout_participants_bout_side_unique").on(table.boutId, table.side),
    index("bout_participants_fencer_id_idx").on(table.fencerId),
    check("bout_participants_side_valid", sql`${table.side} IN ('L', 'R')`),
  ],
);

export const tagsTable = sqliteTable(
  "tags",
  {
    rowId: integer("row_id").primaryKey({ autoIncrement: true }),
    boutId: text("bout_id").notNull()
      .references(() => boutsTable.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    timestamp: real("timestamp"),
    seq: integer("seq"),
    createdAt: integer("created_at").notNull(),
    side: text("side"),
    action: text("action"),
    mistake: text("mistake"),
    matchPeriod: text("match_period"),
    matchClock: text("match_clock"),
    stripZone: text("strip_zone"),
  },
  (table) => [
    uniqueIndex("tags_bout_id_id_unique").on(table.boutId, table.id),
    uniqueIndex("tags_bout_position_unique").on(table.boutId, table.position),
    index("tags_bout_id_idx").on(table.boutId),
    index("tags_side_idx").on(table.side),
    index("tags_action_idx").on(table.action),
    index("tags_mistake_idx").on(table.mistake),
    index("tags_match_period_idx").on(table.matchPeriod),
    index("tags_strip_zone_idx").on(table.stripZone),
    check("tags_position_nonnegative", sql`${table.position} >= 0`),
    check("tags_side_valid", sql`${table.side} IS NULL OR ${table.side} IN ('L', 'R')`),
    check(
      "tags_mistake_valid",
      sql`${table.mistake} IS NULL OR ${table.mistake} IN ('tactical', 'execution')`,
    ),
    check(
      "tags_match_period_valid",
      sql`${table.matchPeriod} IS NULL OR ${table.matchPeriod} IN ('1', '2', '3', 'priority')`,
    ),
    check(
      "tags_strip_zone_valid",
      sql`${table.stripZone} IS NULL OR ${table.stripZone} IN ('1', '2', '3', '4', '5')`,
    ),
  ],
);

export const commentsTable = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tagRowId: integer("tag_row_id").notNull().unique()
      .references(() => tagsTable.rowId, { onDelete: "cascade" }),
    body: text("body").notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (table) => [index("comments_tag_row_id_idx").on(table.tagRowId)],
);

export const commentEmbeddingsTable = sqliteTable(
  "comment_embeddings",
  {
    commentId: integer("comment_id").primaryKey()
      .references(() => commentsTable.id, { onDelete: "cascade" }),
    embedding: float32Vector("embedding", { dimensions: 256 }).notNull(),
    modelId: text("model_id").notNull(),
    modelRevision: text("model_revision").notNull(),
    artifactId: text("artifact_id").notNull(),
    artifactRevision: text("artifact_revision").notNull(),
    promptVersion: text("prompt_version").notNull(),
    dimensions: integer("dimensions").notNull(),
    commentHash: text("comment_hash").notNull(),
    generatedAt: integer("generated_at").notNull(),
  },
  (table) => [
    check("comment_embeddings_dimensions_256", sql`${table.dimensions} = 256`),
  ],
);

export const databaseSchema = {
  boutsTable,
  fencersTable,
  boutParticipantsTable,
  tagsTable,
  commentsTable,
  commentEmbeddingsTable,
};
