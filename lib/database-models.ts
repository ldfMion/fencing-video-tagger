import { z } from "zod";
import { TagSchema, VideoSessionSchema } from "@/lib/types";

export const CURRENT_SCHEMA_VERSION = 2;

// These aliases name the records as they exist in the persisted database.
// Touches remain embedded in sessions for backwards-compatible storage.
export const StoredTouchSchema = TagSchema;
export const StoredSessionSchema = VideoSessionSchema.extend({
  tags: z.array(StoredTouchSchema),
});

export const DatabaseSchema = z.object({
  version: z.number(),
  sessions: z.array(StoredSessionSchema),
});

export type Database = z.infer<typeof DatabaseSchema>;
export type StoredSession = z.infer<typeof StoredSessionSchema>;
export type StoredTouch = z.infer<typeof StoredTouchSchema>;

// Import/export code historically uses this name.
export const StorageEnvelopeSchema = DatabaseSchema;
export type StorageEnvelope = Database;

export function createEmptyDatabase(): Database {
  return {
    version: CURRENT_SCHEMA_VERSION,
    sessions: [],
  };
}
