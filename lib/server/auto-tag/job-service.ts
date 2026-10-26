import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getFinalAgentSnapshots } from "@/lib/auto-tag/agent-tag-fields";
import { evaluateAutoTagJob, type AutoTagEvaluationResult } from "@/lib/auto-tag/evaluation";
import {
  ACTIVE_AUTO_TAG_JOB_STATUSES,
  AUTO_TAG_FRAME_BUDGET,
  AUTO_TAG_IDLE_TIMEOUT_MS,
  AUTO_TAG_OVERVIEW_FPS,
  AUTO_TAG_OVERVIEW_SECONDS_PER_SHEET,
  isAutoTagJobActive,
  type AutoTagJobStatus,
  type AutoTagJobView,
} from "@/lib/auto-tag/job";
import { createSessionRecord } from "@/lib/session-service";
import {
  buildLaunchCommand,
  getAutoTagOverviewDirectory,
  removeAutoTagJobWorkspace,
  writeCodexLaunchFiles,
} from "@/lib/server/auto-tag/job-workspace";
import { generateOverviewSheets, probeVideoStream } from "@/lib/server/auto-tag/media";
import {
  findActiveAutoTagJobForBout,
  findAutoTagJobById,
  findAutoTagJobByTokenHash,
  findLatestAutoTagJobForBout,
  insertAutoTagJob,
  listAutoTagEvents,
  transitionAutoTagJob,
  updateAutoTagJob,
  type AutoTagJobRecord,
} from "@/lib/server/repositories/auto-tag-job-repository";
import { getSessionRepository } from "@/lib/server/repositories/session-repository";
import { requireSession } from "@/lib/server/tag-mutations";
import { resolveVideoLibraryFile } from "@/lib/server/video-library";
import { isMatchClockEnabled, isStripZoneEnabled } from "@/lib/tagging";
import type { VideoSession } from "@/lib/types";

const TERMINAL_STATUS_BY_REASON = {
  finish: "finished",
  cancel: "cancelled",
  abandon: "abandoned",
  fail: "failed",
} as const satisfies Record<string, AutoTagJobStatus>;

type JobEndReason = keyof typeof TERMINAL_STATUS_BY_REASON;

export interface AutoTagJobReport {
  job: AutoTagJobView;
  evaluation: AutoTagEvaluationResult;
}

export async function startAutoTagJob(options: {
  sessionId: string;
  mcpUrl: string;
  referenceBoutId?: string;
  scheduleBackgroundWork: (work: () => Promise<void>) => void;
}): Promise<AutoTagJobView> {
  const session = await requireSession(options.sessionId);
  await assertSessionCanBeAutoTagged(session);
  const video = await resolveVideoLibraryFile(session.videoRelativePath!);
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const job = await insertAutoTagJob({
    id: randomUUID(),
    boutId: session.id,
    referenceBoutId: options.referenceBoutId ?? null,
    status: "preparing",
    agent: "codex",
    tokenHash: hashToken(token),
    videoDuration: null,
    overviewSheetCount: null,
    frameBudget: AUTO_TAG_FRAME_BUDGET,
    framesUsed: 0,
    writeCount: 0,
    error: null,
    summary: null,
    createdAt: now,
    lastActivityAt: now,
    finishedAt: null,
  });
  await writeCodexLaunchFiles({ jobId: job.id, token, mcpUrl: options.mcpUrl });
  options.scheduleBackgroundWork(() => prepareOverview(job.id, video.absolutePath));
  return toJobView(job);
}

export async function createBenchmarkCopy(sessionId: string): Promise<VideoSession> {
  const source = await requireSession(sessionId);
  if (!hasScoringTags(source)) {
    throw new Error("A benchmark needs a bout you have already tagged.");
  }
  const copy = {
    ...createSessionRecord({
      fileName: source.fileName,
      videoRelativePath: source.videoRelativePath,
      videoMimeType: source.videoMimeType,
      videoSourceType: source.videoSourceType,
      leftFencer: source.leftFencer,
      rightFencer: source.rightFencer,
      boutDate: source.boutDate,
      externalSource: `Auto-tag benchmark copy of bout ${source.id}`,
      taggingOptions: source.taggingOptions,
    }),
    ...(source.boutType && { boutType: source.boutType }),
    failureClassificationVersion: source.failureClassificationVersion,
  };
  return getSessionRepository().create(copy);
}

export async function getLatestAutoTagJob(sessionId: string): Promise<AutoTagJobView | null> {
  const job = await findLatestAutoTagJobForBout(sessionId);
  return job ? toJobView(await expireIdleJob(job)) : null;
}

export async function cancelAutoTagJob(jobId: string): Promise<AutoTagJobView> {
  await endAutoTagJob(jobId, "cancel");
  return toJobView(await requireJob(jobId));
}

export async function finishAutoTagJob(jobId: string, summary: string): Promise<void> {
  await endAutoTagJob(jobId, "finish", { summary });
}

/** Resolves a bearer token to its job, only while the agent may still use it. */
export async function authenticateAutoTagToken(token: string): Promise<AutoTagJobRecord | null> {
  const job = await findAutoTagJobByTokenHash(hashToken(token));
  if (!job) return null;
  const currentJob = await expireIdleJob(job);
  return currentJob.status === "ready" || currentJob.status === "running" ? currentJob : null;
}

export async function recordAgentActivity(jobId: string): Promise<void> {
  const now = Date.now();
  const started = await transitionAutoTagJob(jobId, ["ready"], {
    status: "running",
    lastActivityAt: now,
  });
  if (!started) {
    await updateAutoTagJob(jobId, { lastActivityAt: now });
  }
}

export async function getLaunchableJob(jobId: string): Promise<AutoTagJobRecord> {
  const job = await expireIdleJob(await requireJob(jobId));
  if (job.status !== "ready" && job.status !== "running") {
    throw new Error("This job can no longer be started.");
  }
  return job;
}

export async function getAutoTagJobReport(jobId: string): Promise<AutoTagJobReport> {
  const job = await requireJob(jobId);
  const session = await requireSession(job.boutId);
  const referenceSession = job.referenceBoutId
    ? await requireSession(job.referenceBoutId)
    : session;
  const evaluation = evaluateAutoTagJob({
    agentTags: getFinalAgentSnapshots(await listAutoTagEvents(job.id)),
    referenceTags: referenceSession.tags,
    mode: job.referenceBoutId ? "benchmark" : "review",
    matchClockEnabled: isMatchClockEnabled(session),
    stripZoneEnabled: isStripZoneEnabled(session),
  });
  return { job: toJobView(job), evaluation };
}

export async function requireJob(jobId: string): Promise<AutoTagJobRecord> {
  const job = await findAutoTagJobById(jobId);
  if (!job) {
    throw new Error(`Auto-tag job ${jobId} was not found`);
  }
  return job;
}

async function assertSessionCanBeAutoTagged(session: VideoSession): Promise<void> {
  if (session.videoSourceType !== "library" || !session.videoRelativePath) {
    throw new Error("Auto-tag needs a video attached from the library.");
  }
  if (hasScoringTags(session)) {
    throw new Error("Auto-tag only runs on bouts without scoring tags. Use a benchmark copy instead.");
  }
  const activeJob = await findActiveAutoTagJobForBout(session.id);
  if (activeJob && isAutoTagJobActive((await expireIdleJob(activeJob)).status)) {
    throw new Error("This bout already has an auto-tag job in progress.");
  }
}

async function prepareOverview(jobId: string, videoPath: string): Promise<void> {
  try {
    const streamInfo = await probeVideoStream(videoPath);
    const sheets = await generateOverviewSheets({
      videoPath,
      duration: streamInfo.duration,
      outputDir: getAutoTagOverviewDirectory(jobId),
      fps: AUTO_TAG_OVERVIEW_FPS,
      secondsPerSheet: AUTO_TAG_OVERVIEW_SECONDS_PER_SHEET,
    });
    const becameReady = await transitionAutoTagJob(jobId, ["preparing"], {
      status: "ready",
      videoDuration: streamInfo.duration,
      overviewSheetCount: sheets.length,
      lastActivityAt: Date.now(),
    });
    if (!becameReady) {
      await removeAutoTagJobWorkspace(jobId);
    }
  } catch (error) {
    await endAutoTagJob(jobId, "fail", {
      error: error instanceof Error ? error.message : "Could not prepare the overview.",
    });
  }
}

async function expireIdleJob(job: AutoTagJobRecord): Promise<AutoTagJobRecord> {
  const isIdle = Date.now() - job.lastActivityAt > AUTO_TAG_IDLE_TIMEOUT_MS;
  if (!isAutoTagJobActive(job.status) || !isIdle) {
    return job;
  }
  await endAutoTagJob(job.id, "abandon");
  return requireJob(job.id);
}

async function endAutoTagJob(
  jobId: string,
  reason: JobEndReason,
  details: { summary?: string; error?: string } = {},
): Promise<void> {
  const ended = await transitionAutoTagJob(jobId, ACTIVE_AUTO_TAG_JOB_STATUSES, {
    status: TERMINAL_STATUS_BY_REASON[reason],
    finishedAt: Date.now(),
    ...details,
  });
  if (ended) {
    await removeAutoTagJobWorkspace(jobId);
  }
}

function toJobView(job: AutoTagJobRecord): AutoTagJobView {
  return {
    id: job.id,
    boutId: job.boutId,
    referenceBoutId: job.referenceBoutId,
    status: job.status,
    agent: job.agent,
    videoDuration: job.videoDuration,
    overviewSheetCount: job.overviewSheetCount,
    frameBudget: job.frameBudget,
    framesUsed: job.framesUsed,
    writeCount: job.writeCount,
    error: job.error,
    summary: job.summary,
    createdAt: job.createdAt,
    lastActivityAt: job.lastActivityAt,
    finishedAt: job.finishedAt,
    launchCommand: job.status === "ready" || job.status === "running"
      ? buildLaunchCommand(job.id)
      : null,
  };
}

function hasScoringTags(session: VideoSession): boolean {
  return session.tags.some((tag) => tag.side && tag.action);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
