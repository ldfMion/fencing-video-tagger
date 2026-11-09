import "server-only";

import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  AgentTagFieldsSchema,
  AutoTagEventKindSchema,
  type AutoTagEvent,
} from "@/lib/auto-tag/agent-tag-fields";
import {
  ACTIVE_AUTO_TAG_JOB_STATUSES,
  AutoTagAgentSchema,
  AutoTagJobStatusSchema,
  type AutoTagAgent,
  type AutoTagJobStatus,
} from "@/lib/auto-tag/job";
import { databaseReady, db } from "@/lib/server/db/client";
import { autoTagJobEventsTable, autoTagJobsTable } from "@/lib/server/db/schema";

export interface AutoTagJobRecord {
  id: string;
  boutId: string;
  referenceBoutId: string | null;
  status: AutoTagJobStatus;
  agent: AutoTagAgent;
  tokenHash: string;
  videoDuration: number | null;
  overviewSheetCount: number | null;
  frameBudget: number;
  framesUsed: number;
  writeCount: number;
  error: string | null;
  summary: string | null;
  createdAt: number;
  lastActivityAt: number;
  finishedAt: number | null;
}

export type AutoTagJobPatch = Partial<Pick<
  AutoTagJobRecord,
  | "status"
  | "videoDuration"
  | "overviewSheetCount"
  | "error"
  | "summary"
  | "lastActivityAt"
  | "finishedAt"
>>;

type NewAutoTagEvent = Omit<AutoTagEvent, "seq">;

export async function insertAutoTagJob(job: AutoTagJobRecord): Promise<AutoTagJobRecord> {
  await databaseReady;
  await db.insert(autoTagJobsTable).values(job);
  return job;
}

export async function findAutoTagJobById(jobId: string): Promise<AutoTagJobRecord | null> {
  await databaseReady;
  const row = await db.select().from(autoTagJobsTable)
    .where(eq(autoTagJobsTable.id, jobId)).get();
  return row ? parseJobRow(row) : null;
}

export async function findAutoTagJobByTokenHash(
  tokenHash: string,
): Promise<AutoTagJobRecord | null> {
  await databaseReady;
  const row = await db.select().from(autoTagJobsTable)
    .where(eq(autoTagJobsTable.tokenHash, tokenHash)).get();
  return row ? parseJobRow(row) : null;
}

export async function findLatestAutoTagJobForBout(
  boutId: string,
): Promise<AutoTagJobRecord | null> {
  await databaseReady;
  const row = await db.select().from(autoTagJobsTable)
    .where(eq(autoTagJobsTable.boutId, boutId))
    .orderBy(desc(autoTagJobsTable.createdAt)).limit(1).get();
  return row ? parseJobRow(row) : null;
}

export async function findActiveAutoTagJobForBout(
  boutId: string,
): Promise<AutoTagJobRecord | null> {
  await databaseReady;
  const row = await db.select().from(autoTagJobsTable)
    .where(and(
      eq(autoTagJobsTable.boutId, boutId),
      inArray(autoTagJobsTable.status, [...ACTIVE_AUTO_TAG_JOB_STATUSES]),
    ))
    .orderBy(desc(autoTagJobsTable.createdAt)).limit(1).get();
  return row ? parseJobRow(row) : null;
}

export async function updateAutoTagJob(
  jobId: string,
  patch: AutoTagJobPatch,
): Promise<void> {
  await databaseReady;
  await db.update(autoTagJobsTable).set(patch).where(eq(autoTagJobsTable.id, jobId));
}

/** Moves a job between statuses only if it is still in one of `fromStatuses`. */
export async function transitionAutoTagJob(
  jobId: string,
  fromStatuses: readonly AutoTagJobStatus[],
  patch: AutoTagJobPatch & { status: AutoTagJobStatus },
): Promise<boolean> {
  await databaseReady;
  const result = await db.update(autoTagJobsTable).set(patch).where(and(
    eq(autoTagJobsTable.id, jobId),
    inArray(autoTagJobsTable.status, [...fromStatuses]),
  ));
  return result.rowsAffected > 0;
}

/** Atomically spends frames from the job budget; false when it would overspend. */
export async function reserveAutoTagFrames(jobId: string, frameCount: number): Promise<boolean> {
  await databaseReady;
  const result = await db.update(autoTagJobsTable)
    .set({ framesUsed: sql`${autoTagJobsTable.framesUsed} + ${frameCount}` })
    .where(and(
      eq(autoTagJobsTable.id, jobId),
      lte(sql`${autoTagJobsTable.framesUsed} + ${frameCount}`, autoTagJobsTable.frameBudget),
    ));
  return result.rowsAffected > 0;
}

export async function appendAutoTagEvent(jobId: string, event: NewAutoTagEvent): Promise<void> {
  await databaseReady;
  await db.transaction(async (transaction) => {
    const last = await transaction.select({ seq: autoTagJobEventsTable.seq })
      .from(autoTagJobEventsTable)
      .where(eq(autoTagJobEventsTable.jobId, jobId))
      .orderBy(desc(autoTagJobEventsTable.seq)).limit(1).get();
    await transaction.insert(autoTagJobEventsTable).values({
      jobId,
      seq: (last?.seq ?? 0) + 1,
      kind: event.kind,
      tagId: event.tagId,
      snapshot: event.snapshot ? JSON.stringify(event.snapshot) : null,
      reasoning: event.reasoning,
      createdAt: event.createdAt,
    });
    await transaction.update(autoTagJobsTable)
      .set({ writeCount: sql`${autoTagJobsTable.writeCount} + 1` })
      .where(eq(autoTagJobsTable.id, jobId));
  });
}

export async function listAutoTagEvents(jobId: string): Promise<AutoTagEvent[]> {
  await databaseReady;
  const rows = await db.select().from(autoTagJobEventsTable)
    .where(eq(autoTagJobEventsTable.jobId, jobId))
    .orderBy(asc(autoTagJobEventsTable.seq));
  return rows.map((row) => ({
    seq: row.seq,
    kind: AutoTagEventKindSchema.parse(row.kind),
    tagId: row.tagId,
    snapshot: row.snapshot ? AgentTagFieldsSchema.parse(JSON.parse(row.snapshot)) : null,
    reasoning: row.reasoning,
    createdAt: row.createdAt,
  }));
}

function parseJobRow(row: typeof autoTagJobsTable.$inferSelect): AutoTagJobRecord {
  return {
    ...row,
    status: AutoTagJobStatusSchema.parse(row.status),
    agent: AutoTagAgentSchema.parse(row.agent),
  };
}
