import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  areAgentTagFieldsEqual,
  getFinalAgentSnapshots,
  pickAgentTagFields,
  type AgentTagFields,
} from "@/lib/auto-tag/agent-tag-fields";
import { describeFrameSheetTiles, type CropRect, type FrameSheet } from "@/lib/auto-tag/frame-sheet";
import {
  AUTO_TAG_DUPLICATE_WINDOW_SECONDS,
  AUTO_TAG_FRAMES_PER_CALL_LIMIT,
  AUTO_TAG_OVERVIEW_FPS,
  AUTO_TAG_OVERVIEW_SECONDS_PER_SHEET,
} from "@/lib/auto-tag/job";
import { buildJobBrief } from "@/lib/auto-tag/prompt";
import { formatAgentTagLine } from "@/lib/auto-tag/tag-lines";
import { finishAutoTagJob } from "@/lib/server/auto-tag/job-service";
import {
  getAutoTagOverviewDirectory,
  getAutoTagSamplesDirectory,
} from "@/lib/server/auto-tag/job-workspace";
import {
  extractFrameSheet,
  extractSingleFrame,
  readOverviewManifest,
} from "@/lib/server/auto-tag/media";
import { countSamplingInstants } from "@/lib/server/auto-tag/ffmpeg-helpers";
import {
  appendAutoTagEvent,
  listAutoTagEvents,
  reserveAutoTagFrames,
  type AutoTagJobRecord,
} from "@/lib/server/repositories/auto-tag-job-repository";
import {
  addTagToSession,
  deleteTagFromSession,
  requireSession,
  updateTagInSession,
} from "@/lib/server/tag-mutations";
import { resolveVideoLibraryFile } from "@/lib/server/video-library";
import { isMatchClockEnabled, isStripZoneEnabled } from "@/lib/tagging";
import type { Tag, VideoSession } from "@/lib/types";

export type AgentToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: "image/jpeg" };

export interface FrameRequest {
  start: number;
  end: number;
  fps: number;
  crop?: CropRect;
}

const SESSION_CONFLICT_PATTERN = /changed while this request was being processed/;

export async function getJobBrief(job: AutoTagJobRecord): Promise<AgentToolContent[]> {
  const session = await requireSession(job.boutId);
  return [text(buildJobBrief({
    leftFencer: session.leftFencer,
    rightFencer: session.rightFencer,
    videoDuration: job.videoDuration ?? 0,
    matchClockEnabled: isMatchClockEnabled(session),
    stripZoneEnabled: isStripZoneEnabled(session),
    overviewSheetCount: job.overviewSheetCount ?? 0,
    overviewFps: AUTO_TAG_OVERVIEW_FPS,
    secondsPerSheet: AUTO_TAG_OVERVIEW_SECONDS_PER_SHEET,
    framesPerCallLimit: AUTO_TAG_FRAMES_PER_CALL_LIMIT,
    framesRemaining: job.frameBudget - job.framesUsed,
    tags: session.tags,
  }))];
}

export async function getOverviewSheet(
  job: AutoTagJobRecord,
  sheetIndex: number,
): Promise<AgentToolContent[]> {
  const sheets = await readOverviewManifest(getAutoTagOverviewDirectory(job.id));
  const sheet = sheets[sheetIndex];
  if (!sheet) {
    throw new Error(`Overview sheet ${sheetIndex} does not exist; valid indexes are 0-${sheets.length - 1}.`);
  }
  return describeSheetImage(sheet, `Overview sheet ${sheetIndex} (indexes 0-${sheets.length - 1})`);
}

export async function sampleFrames(
  job: AutoTagJobRecord,
  request: FrameRequest,
): Promise<AgentToolContent[]> {
  assertWindowInsideVideo(job, request.start, request.end);
  const frameCount = countSamplingInstants(request.start, request.end, request.fps);
  if (frameCount > AUTO_TAG_FRAMES_PER_CALL_LIMIT) {
    throw new Error(
      `That window would return about ${frameCount} frames; the limit is ${AUTO_TAG_FRAMES_PER_CALL_LIMIT}. Narrow the window or lower fps.`,
    );
  }
  await reserveFramesOrThrow(job, frameCount);
  const outputPath = createSamplePath(job.id);
  try {
    const sheet = await extractFrameSheet({
      videoPath: await resolveJobVideoPath(job),
      start: request.start,
      end: request.end,
      fps: request.fps,
      crop: request.crop,
      outputPath,
    });
    return await describeSheetImage(sheet, `Frames ${request.start.toFixed(3)}-${request.end.toFixed(3)}s at ${request.fps} fps`);
  } finally {
    await fs.rm(outputPath, { force: true });
  }
}

export async function getFrame(
  job: AutoTagJobRecord,
  request: { time: number; crop?: CropRect },
): Promise<AgentToolContent[]> {
  assertWindowInsideVideo(job, request.time, request.time);
  await reserveFramesOrThrow(job, 1);
  const outputPath = createSamplePath(job.id);
  try {
    const frame = await extractSingleFrame({
      videoPath: await resolveJobVideoPath(job),
      time: request.time,
      crop: request.crop,
      outputPath,
    });
    return [
      text(`Frame at ${frame.time.toFixed(3)}s`),
      await readJpeg(frame.imagePath),
    ];
  } finally {
    await fs.rm(outputPath, { force: true });
  }
}

export async function listJobTags(job: AutoTagJobRecord): Promise<AgentToolContent[]> {
  const session = await requireSession(job.boutId);
  const editableTagIds = await findAgentEditableTagIds(job, session);
  const lines = session.tags
    .filter((tag) => tag.side && tag.action)
    .map((tag) => `${formatAgentTagLine(tag)}${editableTagIds.has(tag.id) ? " editable=yes" : " editable=no"}`);
  return [text(lines.length > 0 ? lines.join("\n") : "No scoring tags yet.")];
}

export async function addAgentTag(
  job: AutoTagJobRecord,
  fields: AgentTagFields,
  reasoning: string,
): Promise<AgentToolContent[]> {
  assertWindowInsideVideo(job, fields.timestamp, fields.timestamp);
  const { tag } = await retryOnSessionConflict(async () => {
    const session = await requireSession(job.boutId);
    assertNoDuplicateTouch(session, fields.timestamp);
    return addTagToSession(session.id, toTagContent(fields), {
      origin: "agent",
      autoTagJobId: job.id,
    });
  });
  await logAgentWrite(job, "add", tag, reasoning);
  return [text(`Saved ${formatAgentTagLine(tag)}`)];
}

export async function updateAgentTag(
  job: AutoTagJobRecord,
  tagId: string,
  updates: Partial<AgentTagFields>,
  reasoning: string,
): Promise<AgentToolContent[]> {
  if (updates.timestamp != null) {
    assertWindowInsideVideo(job, updates.timestamp, updates.timestamp);
  }
  const { tag } = await retryOnSessionConflict(async () => {
    const session = await requireSession(job.boutId);
    await assertAgentCanEditTag(job, session, tagId);
    if (updates.timestamp != null) {
      assertNoDuplicateTouch(session, updates.timestamp, tagId);
    }
    return updateTagInSession(session.id, tagId, updates);
  });
  await logAgentWrite(job, "update", tag, reasoning);
  return [text(`Updated ${formatAgentTagLine(tag)}`)];
}

export async function deleteAgentTag(
  job: AutoTagJobRecord,
  tagId: string,
  reasoning: string,
): Promise<AgentToolContent[]> {
  await retryOnSessionConflict(async () => {
    const session = await requireSession(job.boutId);
    await assertAgentCanEditTag(job, session, tagId);
    return deleteTagFromSession(session.id, tagId);
  });
  await appendAutoTagEvent(job.id, {
    kind: "delete",
    tagId,
    snapshot: null,
    reasoning,
    createdAt: Date.now(),
  });
  return [text(`Deleted tag ${tagId}`)];
}

export async function finishJob(
  job: AutoTagJobRecord,
  summary: string,
): Promise<AgentToolContent[]> {
  await finishAutoTagJob(job.id, summary);
  return [text("Job finished. The user will review your tags in the app.")];
}

async function findAgentEditableTagIds(
  job: AutoTagJobRecord,
  session: VideoSession,
): Promise<Set<string>> {
  const snapshots = getFinalAgentSnapshots(await listAutoTagEvents(job.id));
  return new Set(session.tags
    .filter((tag) => isTagStillAgentOwned(job, tag, snapshots.get(tag.id)))
    .map((tag) => tag.id));
}

/** Only the fields the agent sets count: a comment you add does not take the tag away from it. */
function isTagStillAgentOwned(
  job: AutoTagJobRecord,
  tag: Tag,
  lastAgentSnapshot: AgentTagFields | undefined,
): boolean {
  return tag.origin === "agent" &&
    tag.autoTagJobId === job.id &&
    lastAgentSnapshot !== undefined &&
    areAgentTagFieldsEqual(pickAgentTagFields(tag), lastAgentSnapshot);
}

async function assertAgentCanEditTag(
  job: AutoTagJobRecord,
  session: VideoSession,
  tagId: string,
): Promise<void> {
  const tag = session.tags.find((candidate) => candidate.id === tagId);
  if (!tag) {
    throw new Error(`Tag ${tagId} does not exist (the user may have deleted it).`);
  }
  const editableTagIds = await findAgentEditableTagIds(job, session);
  if (!editableTagIds.has(tagId)) {
    throw new Error(`Tag ${tagId} belongs to the user now; leave it as it is and continue.`);
  }
}

function assertNoDuplicateTouch(session: VideoSession, timestamp: number, ignoredTagId?: string): void {
  const duplicate = session.tags.find((tag) =>
    tag.id !== ignoredTagId &&
    tag.side &&
    tag.timestamp != null &&
    Math.abs(tag.timestamp - timestamp) < AUTO_TAG_DUPLICATE_WINDOW_SECONDS);
  if (duplicate) {
    throw new Error(
      `A scoring tag already exists ${Math.abs(duplicate.timestamp! - timestamp).toFixed(2)}s away (${formatAgentTagLine(duplicate).slice(2)}). Update it instead of adding another.`,
    );
  }
}

function assertWindowInsideVideo(job: AutoTagJobRecord, start: number, end: number): void {
  const duration = job.videoDuration ?? 0;
  if (start < 0 || end > duration + 0.001 || start > end) {
    throw new Error(`Times must be within 0-${duration.toFixed(3)}s and start must not be after end.`);
  }
}

async function reserveFramesOrThrow(job: AutoTagJobRecord, frameCount: number): Promise<void> {
  if (!await reserveAutoTagFrames(job.id, frameCount)) {
    throw new Error("The look-closer frame budget for this job is used up. Finish with what you have and call finish_job.");
  }
}

async function retryOnSessionConflict<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Error && SESSION_CONFLICT_PATTERN.test(error.message)) {
      return write();
    }
    throw error;
  }
}

async function logAgentWrite(
  job: AutoTagJobRecord,
  kind: "add" | "update",
  tag: Tag,
  reasoning: string,
): Promise<void> {
  await appendAutoTagEvent(job.id, {
    kind,
    tagId: tag.id,
    snapshot: pickAgentTagFields(tag),
    reasoning,
    createdAt: Date.now(),
  });
}

function toTagContent(fields: AgentTagFields) {
  return {
    timestamp: fields.timestamp,
    side: fields.side,
    action: fields.action,
    matchPeriod: fields.matchPeriod,
    matchClock: fields.matchClock,
    stripZone: fields.stripZone,
    comment: "",
  };
}

async function resolveJobVideoPath(job: AutoTagJobRecord): Promise<string> {
  const session = await requireSession(job.boutId);
  if (!session.videoRelativePath) {
    throw new Error("The bout no longer has a library video attached.");
  }
  return (await resolveVideoLibraryFile(session.videoRelativePath)).absolutePath;
}

async function describeSheetImage(sheet: FrameSheet, title: string): Promise<AgentToolContent[]> {
  return [
    text(`${title}. ${describeFrameSheetTiles(sheet)}`),
    await readJpeg(sheet.imagePath),
  ];
}

async function readJpeg(imagePath: string): Promise<AgentToolContent> {
  return {
    type: "image",
    data: (await fs.readFile(imagePath)).toString("base64"),
    mimeType: "image/jpeg",
  };
}

function createSamplePath(jobId: string): string {
  return path.join(getAutoTagSamplesDirectory(jobId), `${randomUUID()}.jpg`);
}

function text(value: string): AgentToolContent {
  return { type: "text", text: value };
}
