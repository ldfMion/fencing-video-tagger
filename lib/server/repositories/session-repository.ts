import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/server/db/client";
import { sessionsTable, tagsTable } from "@/lib/server/db/schema";
import {
  TagSchema,
  VideoSessionSchema,
  type Tag,
  type VideoSession,
} from "@/lib/types";

const SessionPayloadSchema = VideoSessionSchema.omit({ tags: true });
type SessionPayload = Omit<VideoSession, "tags">;

export interface SessionRepository {
  list(): Promise<VideoSession[]>;
  findById(sessionId: string): Promise<VideoSession | null>;
  create(session: VideoSession): Promise<VideoSession>;
  update(session: VideoSession): Promise<VideoSession>;
  delete(sessionId: string): Promise<boolean>;
  import(sessions: VideoSession[]): Promise<{ imported: number; skipped: number }>;
  createTag(session: VideoSession, tag: Tag): Promise<VideoSession>;
  updateTag(session: VideoSession, tag: Tag): Promise<VideoSession>;
  deleteTag(session: VideoSession, tagId: string): Promise<VideoSession>;
}

class DrizzleSessionRepository implements SessionRepository {
  async list(): Promise<VideoSession[]> {
    const sessionRows = db.select().from(sessionsTable).all();
    const tagRows = db.select().from(tagsTable)
      .orderBy(asc(tagsTable.sessionId), asc(tagsTable.position)).all();
    const tagsBySession = groupTagsBySession(tagRows);

    return sessionRows.map((row) => assembleSession(
      row,
      tagsBySession.get(row.id) ?? [],
    ));
  }

  async findById(sessionId: string): Promise<VideoSession | null> {
    const row = db.select().from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId)).get();
    if (!row) {
      return null;
    }
    const tagRows = db.select().from(tagsTable)
      .where(eq(tagsTable.sessionId, sessionId))
      .orderBy(asc(tagsTable.position)).all();
    return assembleSession(row, tagRows.map(parseTagRow));
  }

  async create(session: VideoSession): Promise<VideoSession> {
    const parsedSession = VideoSessionSchema.parse(session);

    try {
      db.transaction((transaction) => {
        transaction.insert(sessionsTable).values(toSessionRow(parsedSession)).run();
        insertTags(transaction, parsedSession);
      });
    } catch (error) {
      if (isDuplicateSessionError(error)) {
        throw new Error(`Session ${parsedSession.id} already exists`);
      }
      throw error;
    }

    return parsedSession;
  }

  async update(session: VideoSession): Promise<VideoSession> {
    const parsedSession = VideoSessionSchema.parse(session);
    const result = db.update(sessionsTable).set(toSessionRow(parsedSession))
      .where(eq(sessionsTable.id, parsedSession.id)).run();
    if (result.changes === 0) {
      throw new Error(`Session ${parsedSession.id} was not found`);
    }
    return parsedSession;
  }

  async delete(sessionId: string): Promise<boolean> {
    const result = db.delete(sessionsTable)
      .where(eq(sessionsTable.id, sessionId)).run();
    return result.changes > 0;
  }

  async import(
    sessions: VideoSession[],
  ): Promise<{ imported: number; skipped: number }> {
    const parsedSessions = sessions.map((session) => VideoSessionSchema.parse(session));

    return db.transaction((transaction) => {
      let imported = 0;
      for (const session of parsedSessions) {
        const result = transaction.insert(sessionsTable)
          .values(toSessionRow(session))
          .onConflictDoNothing({ target: sessionsTable.id }).run();
        imported += result.changes;
        if (result.changes > 0) {
          insertTags(transaction, session);
        }
      }
      return { imported, skipped: parsedSessions.length - imported };
    });
  }

  async createTag(session: VideoSession, tag: Tag): Promise<VideoSession> {
    const parsedSession = VideoSessionSchema.parse(session);
    const parsedTag = TagSchema.parse(tag);

    db.transaction((transaction) => {
      updateSessionRow(transaction, parsedSession);
      const lastTag = transaction.select({ position: tagsTable.position })
        .from(tagsTable)
        .where(eq(tagsTable.sessionId, parsedSession.id))
        .orderBy(desc(tagsTable.position)).limit(1).get();
      transaction.insert(tagsTable).values(toTagRow(
        parsedSession.id,
        parsedTag,
        (lastTag?.position ?? -1) + 1,
      )).run();
    });
    return parsedSession;
  }

  async updateTag(session: VideoSession, tag: Tag): Promise<VideoSession> {
    const parsedSession = VideoSessionSchema.parse(session);
    const parsedTag = TagSchema.parse(tag);

    db.transaction((transaction) => {
      updateSessionRow(transaction, parsedSession);
      const result = transaction.update(tagsTable)
        .set({ payload: JSON.stringify(parsedTag) })
        .where(and(
          eq(tagsTable.sessionId, parsedSession.id),
          eq(tagsTable.id, parsedTag.id),
        )).run();
      if (result.changes === 0) {
        throw new Error(
          `Tag ${parsedTag.id} was not found in session ${parsedSession.id}`,
        );
      }
    });
    return parsedSession;
  }

  async deleteTag(session: VideoSession, tagId: string): Promise<VideoSession> {
    const parsedSession = VideoSessionSchema.parse(session);

    db.transaction((transaction) => {
      updateSessionRow(transaction, parsedSession);
      const result = transaction.delete(tagsTable).where(and(
        eq(tagsTable.sessionId, parsedSession.id),
        eq(tagsTable.id, tagId),
      )).run();
      if (result.changes === 0) {
        throw new Error(
          `Tag ${tagId} was not found in session ${parsedSession.id}`,
        );
      }
    });
    return parsedSession;
  }
}

function assembleSession(
  row: typeof sessionsTable.$inferSelect,
  tags: Tag[],
): VideoSession {
  const payload = parseJson(row.payload, `Session ${row.id}`);
  const result = SessionPayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Session ${row.id} is corrupt: ${result.error.message}`);
  }
  if (result.data.id !== row.id) {
    throw new Error(`Session ${row.id} has a mismatched id in its JSON payload`);
  }
  return VideoSessionSchema.parse({ ...result.data, tags });
}

function parseTagRow(row: typeof tagsTable.$inferSelect): Tag {
  const payload = parseJson(row.payload, `Tag ${row.id}`);
  const result = TagSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `Tag ${row.id} in session ${row.sessionId} is corrupt: ${result.error.message}`,
    );
  }
  if (result.data.id !== row.id) {
    throw new Error(
      `Tag ${row.id} in session ${row.sessionId} has a mismatched id in its JSON payload`,
    );
  }
  return result.data;
}

function groupTagsBySession(
  rows: (typeof tagsTable.$inferSelect)[],
): Map<string, Tag[]> {
  const grouped = new Map<string, Tag[]>();
  for (const row of rows) {
    const tags = grouped.get(row.sessionId) ?? [];
    tags.push(parseTagRow(row));
    grouped.set(row.sessionId, tags);
  }
  return grouped;
}

function toSessionRow(session: VideoSession): typeof sessionsTable.$inferInsert {
  const payload = SessionPayloadSchema.parse(session) satisfies SessionPayload;
  return { id: session.id, payload: JSON.stringify(payload) };
}

function toTagRows(session: VideoSession): (typeof tagsTable.$inferInsert)[] {
  return session.tags.map((tag, position) => toTagRow(session.id, tag, position));
}

function toTagRow(
  sessionId: string,
  tag: Tag,
  position: number,
): typeof tagsTable.$inferInsert {
  return {
    sessionId,
    id: tag.id,
    position,
    payload: JSON.stringify(tag),
  };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function insertTags(transaction: Transaction, session: VideoSession): void {
  const rows = toTagRows(session);
  if (rows.length > 0) {
    transaction.insert(tagsTable).values(rows).run();
  }
}

function updateSessionRow(transaction: Transaction, session: VideoSession): void {
  const result = transaction.update(sessionsTable).set(toSessionRow(session))
    .where(eq(sessionsTable.id, session.id)).run();
  if (result.changes === 0) {
    throw new Error(`Session ${session.id} was not found`);
  }
}

function parseJson(json: string, entityName: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`${entityName} contains invalid JSON: ${getErrorMessage(error)}`);
  }
}

function isDuplicateSessionError(error: unknown): boolean {
  return error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: sessions.id");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

let repository: SessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
  repository ??= new DrizzleSessionRepository();
  return repository;
}
