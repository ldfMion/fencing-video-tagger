import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Domain fields stay in JSON. Identity, ownership, and ordering are duplicated
 * as relational metadata so SQLite can enforce aggregate boundaries while Zod
 * remains the authority for each entity payload.
 */
export const sessionsTable = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    payload: text("payload").notNull(),
  },
  (table) => [
    check("sessions_payload_is_json", sql`json_valid(${table.payload})`),
  ],
);

export const tagsTable = sqliteTable(
  "tags",
  {
    sessionId: text("session_id").notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    payload: text("payload").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.id] }),
    uniqueIndex("tags_session_position_unique")
      .on(table.sessionId, table.position),
    check("tags_position_is_nonnegative", sql`${table.position} >= 0`),
    check("tags_payload_is_json", sql`json_valid(${table.payload})`),
  ],
);
