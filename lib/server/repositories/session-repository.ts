import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { normalizeBoutDate } from "@/lib/bout-date";
import { databaseReady, db } from "@/lib/server/db/client";
import { hashComment } from "@/lib/server/db/connection";
import {
  boutsTable,
  commentEmbeddingsTable,
  commentsTable,
  tagsTable,
} from "@/lib/server/db/schema";
import {
  TagSchema,
  VideoSessionSchema,
  type Tag,
  type TaggingOptions,
  type VideoSession,
} from "@/lib/types";

export interface SessionRepository {
  list(): Promise<VideoSession[]>;
  findById(sessionId: string): Promise<VideoSession | null>;
  create(session: VideoSession): Promise<VideoSession>;
  update(previousSession: VideoSession, session: VideoSession): Promise<VideoSession>;
  delete(sessionId: string): Promise<boolean>;
  import(sessions: VideoSession[]): Promise<{ imported: number; skipped: number }>;
  createTag(
    previousSession: VideoSession,
    session: VideoSession,
    tag: Tag,
  ): Promise<VideoSession>;
  updateTag(
    previousSession: VideoSession,
    session: VideoSession,
    tag: Tag,
  ): Promise<VideoSession>;
  deleteTag(
    previousSession: VideoSession,
    session: VideoSession,
    tagId: string,
  ): Promise<VideoSession>;
}

class LibsqlSessionRepository implements SessionRepository {
  async list(): Promise<VideoSession[]> {
    await databaseReady;
    const boutRows = await db.select().from(boutsTable);
    const tagRows = await selectTagRows();
    const tagsByBout = groupTagsByBout(tagRows);

    return boutRows.map((row) => assembleSession(
      row,
      tagsByBout.get(row.id) ?? [],
    ));
  }

  async findById(sessionId: string): Promise<VideoSession | null> {
    await databaseReady;
    const row = await db.select().from(boutsTable)
      .where(eq(boutsTable.id, sessionId)).get();
    if (!row) {
      return null;
    }

    const tagRows = await selectTagRows(sessionId);
    return assembleSession(row, tagRows.map(parseTagRow));
  }

  async create(session: VideoSession): Promise<VideoSession> {
    await databaseReady;
    const parsedSession = VideoSessionSchema.parse(session);

    try {
      await db.transaction(async (transaction) => {
        await transaction.insert(boutsTable).values(toBoutRow(parsedSession));
        await insertTags(transaction, parsedSession);
      });
    } catch (error) {
      if (isDuplicateSessionError(error)) {
        throw new Error(`Session ${parsedSession.id} already exists`);
      }
      throw error;
    }

    return parsedSession;
  }

  async update(
    previousSession: VideoSession,
    session: VideoSession,
  ): Promise<VideoSession> {
    await databaseReady;
    const parsedPreviousSession = VideoSessionSchema.parse(previousSession);
    const parsedSession = VideoSessionSchema.parse(session);
    const result = await db.update(boutsTable).set(toBoutRow(parsedSession))
      .where(sessionVersionMatches(parsedPreviousSession));
    if (result.rowsAffected === 0) {
      throwSessionConflict(parsedSession.id);
    }
    return parsedSession;
  }

  async delete(sessionId: string): Promise<boolean> {
    await databaseReady;
    const result = await db.delete(boutsTable)
      .where(eq(boutsTable.id, sessionId));
    return result.rowsAffected > 0;
  }

  async import(
    sessions: VideoSession[],
  ): Promise<{ imported: number; skipped: number }> {
    await databaseReady;
    const parsedSessions = sessions.map((session) => VideoSessionSchema.parse(session));

    return db.transaction(async (transaction) => {
      let imported = 0;
      for (const session of parsedSessions) {
        const result = await transaction.insert(boutsTable)
          .values(toBoutRow(session))
          .onConflictDoNothing({ target: boutsTable.id });
        imported += result.rowsAffected;
        if (result.rowsAffected > 0) {
          await insertTags(transaction, session);
        }
      }
      return { imported, skipped: parsedSessions.length - imported };
    });
  }

  async createTag(
    previousSession: VideoSession,
    session: VideoSession,
    tag: Tag,
  ): Promise<VideoSession> {
    await databaseReady;
    const parsedPreviousSession = VideoSessionSchema.parse(previousSession);
    const parsedSession = VideoSessionSchema.parse(session);
    const parsedTag = TagSchema.parse(tag);

    await db.transaction(async (transaction) => {
      await updateBoutRow(transaction, parsedPreviousSession, parsedSession);
      const lastTag = await transaction.select({ position: tagsTable.position })
        .from(tagsTable)
        .where(eq(tagsTable.boutId, parsedSession.id))
        .orderBy(desc(tagsTable.position)).limit(1).get();
      await insertTag(
        transaction,
        parsedSession.id,
        parsedTag,
        (lastTag?.position ?? -1) + 1,
      );
    });
    return parsedSession;
  }

  async updateTag(
    previousSession: VideoSession,
    session: VideoSession,
    tag: Tag,
  ): Promise<VideoSession> {
    await databaseReady;
    const parsedPreviousSession = VideoSessionSchema.parse(previousSession);
    const parsedSession = VideoSessionSchema.parse(session);
    const parsedTag = TagSchema.parse(tag);

    await db.transaction(async (transaction) => {
      await updateBoutRow(transaction, parsedPreviousSession, parsedSession);
      const existing = await transaction.select({
        rowId: tagsTable.rowId,
        commentId: commentsTable.id,
        contentHash: commentsTable.contentHash,
      }).from(tagsTable).innerJoin(
        commentsTable,
        eq(commentsTable.tagRowId, tagsTable.rowId),
      ).where(and(
        eq(tagsTable.boutId, parsedSession.id),
        eq(tagsTable.id, parsedTag.id),
      )).get();
      if (!existing) {
        throw new Error(
          `Tag ${parsedTag.id} was not found in session ${parsedSession.id}`,
        );
      }

      await transaction.update(tagsTable).set(toTagValues(parsedTag)).where(
        eq(tagsTable.rowId, existing.rowId),
      );
      const contentHash = hashComment(parsedTag.comment);
      await transaction.update(commentsTable).set({
        body: parsedTag.comment,
        contentHash,
      }).where(eq(commentsTable.id, existing.commentId));

      if (existing.contentHash !== contentHash) {
        await transaction.delete(commentEmbeddingsTable).where(
          eq(commentEmbeddingsTable.commentId, existing.commentId),
        );
      }
    });
    return parsedSession;
  }

  async deleteTag(
    previousSession: VideoSession,
    session: VideoSession,
    tagId: string,
  ): Promise<VideoSession> {
    await databaseReady;
    const parsedPreviousSession = VideoSessionSchema.parse(previousSession);
    const parsedSession = VideoSessionSchema.parse(session);

    await db.transaction(async (transaction) => {
      await updateBoutRow(transaction, parsedPreviousSession, parsedSession);
      const result = await transaction.delete(tagsTable).where(and(
        eq(tagsTable.boutId, parsedSession.id),
        eq(tagsTable.id, tagId),
      ));
      if (result.rowsAffected === 0) {
        throw new Error(
          `Tag ${tagId} was not found in session ${parsedSession.id}`,
        );
      }
    });
    return parsedSession;
  }
}

async function selectTagRows(boutId?: string) {
  const query = db.select({
    tag: tagsTable,
    comment: commentsTable.body,
  }).from(tagsTable).innerJoin(
    commentsTable,
    eq(commentsTable.tagRowId, tagsTable.rowId),
  );

  return boutId
    ? query.where(eq(tagsTable.boutId, boutId)).orderBy(asc(tagsTable.position))
    : query.orderBy(asc(tagsTable.boutId), asc(tagsTable.position));
}

type TagRow = Awaited<ReturnType<typeof selectTagRows>>[number];

function assembleSession(
  row: typeof boutsTable.$inferSelect,
  tags: Tag[],
): VideoSession {
  const taggingOptions = fromTaggingOptions(row);
  return VideoSessionSchema.parse({
    id: row.id,
    tags,
    lastModified: row.lastModified,
    ...(row.fileName != null && { fileName: row.fileName }),
    ...(row.videoRelativePath != null && { videoRelativePath: row.videoRelativePath }),
    ...(row.videoMimeType != null && { videoMimeType: row.videoMimeType }),
    ...(row.videoSourceType != null && { videoSourceType: row.videoSourceType }),
    ...(row.leftFencer != null && { leftFencer: row.leftFencer }),
    ...(row.rightFencer != null && { rightFencer: row.rightFencer }),
    ...(row.boutDate != null && { boutDate: row.boutDate }),
    ...(row.boutType != null && { boutType: row.boutType }),
    ...(row.externalSource != null && { externalSource: row.externalSource }),
    ...(taggingOptions && { taggingOptions }),
  });
}

function parseTagRow(row: TagRow): Tag {
  return TagSchema.parse({
    id: row.tag.id,
    createdAt: row.tag.createdAt,
    comment: row.comment,
    ...(row.tag.timestamp != null && { timestamp: row.tag.timestamp }),
    ...(row.tag.seq != null && { seq: row.tag.seq }),
    ...(row.tag.side != null && { side: row.tag.side }),
    ...(row.tag.action != null && { action: row.tag.action }),
    ...(row.tag.mistake != null && { mistake: row.tag.mistake }),
    ...(row.tag.matchPeriod != null && { matchPeriod: row.tag.matchPeriod }),
    ...(row.tag.matchClock != null && { matchClock: row.tag.matchClock }),
    ...(row.tag.stripZone != null && { stripZone: row.tag.stripZone }),
  });
}

function groupTagsByBout(rows: TagRow[]): Map<string, Tag[]> {
  const grouped = new Map<string, Tag[]>();
  for (const row of rows) {
    const tags = grouped.get(row.tag.boutId) ?? [];
    tags.push(parseTagRow(row));
    grouped.set(row.tag.boutId, tags);
  }
  return grouped;
}

function toBoutRow(session: VideoSession): typeof boutsTable.$inferInsert {
  return {
    id: session.id,
    fileName: session.fileName ?? null,
    videoRelativePath: session.videoRelativePath ?? null,
    videoMimeType: session.videoMimeType ?? null,
    videoSourceType: session.videoSourceType ?? null,
    lastModified: session.lastModified,
    leftFencer: session.leftFencer ?? null,
    rightFencer: session.rightFencer ?? null,
    boutDate: session.boutDate ?? null,
    boutDateIso: normalizeBoutDate(session.boutDate) ?? null,
    boutType: session.boutType ?? null,
    externalSource: session.externalSource ?? null,
    matchClockEnabled: session.taggingOptions?.matchClockEnabled ?? null,
    stripZoneEnabled: session.taggingOptions?.stripZoneEnabled ?? null,
  };
}

function toTagValues(tag: Tag) {
  return {
    timestamp: tag.timestamp ?? null,
    seq: tag.seq ?? null,
    createdAt: tag.createdAt,
    side: tag.side ?? null,
    action: tag.action ?? null,
    mistake: tag.mistake ?? null,
    matchPeriod: tag.matchPeriod ?? null,
    matchClock: tag.matchClock ?? null,
    stripZone: tag.stripZone ?? null,
  };
}

function fromTaggingOptions(
  row: typeof boutsTable.$inferSelect,
): TaggingOptions | undefined {
  if (row.matchClockEnabled == null && row.stripZoneEnabled == null) {
    return undefined;
  }
  return {
    ...(row.matchClockEnabled != null && {
      matchClockEnabled: row.matchClockEnabled,
    }),
    ...(row.stripZoneEnabled != null && {
      stripZoneEnabled: row.stripZoneEnabled,
    }),
  };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function insertTags(
  transaction: Transaction,
  session: VideoSession,
): Promise<void> {
  for (const [position, tag] of session.tags.entries()) {
    await insertTag(transaction, session.id, tag, position);
  }
}

async function insertTag(
  transaction: Transaction,
  boutId: string,
  tag: Tag,
  position: number,
): Promise<void> {
  const inserted = await transaction.insert(tagsTable).values({
    boutId,
    id: tag.id,
    position,
    ...toTagValues(tag),
  }).returning({ rowId: tagsTable.rowId }).get();
  await transaction.insert(commentsTable).values({
    tagRowId: inserted.rowId,
    body: tag.comment,
    contentHash: hashComment(tag.comment),
  });
}

async function updateBoutRow(
  transaction: Transaction,
  previousSession: VideoSession,
  session: VideoSession,
): Promise<void> {
  const result = await transaction.update(boutsTable).set(toBoutRow(session))
    .where(sessionVersionMatches(previousSession));
  if (result.rowsAffected === 0) {
    throwSessionConflict(session.id);
  }
}

function sessionVersionMatches(session: VideoSession) {
  return and(
    eq(boutsTable.id, session.id),
    eq(boutsTable.lastModified, session.lastModified),
  );
}

function throwSessionConflict(sessionId: string): never {
  throw new Error(
    `Session ${sessionId} changed while this request was being processed. Please retry.`,
  );
}

function isDuplicateSessionError(error: unknown): boolean {
  return error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: bouts.id");
}

let repository: SessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
  repository ??= new LibsqlSessionRepository();
  return repository;
}
