import { z } from "zod";

export const AUTO_TAG_JOB_STATUSES = [
  "preparing",
  "ready",
  "running",
  "finished",
  "cancelled",
  "abandoned",
  "failed",
] as const;

export const AutoTagJobStatusSchema = z.enum(AUTO_TAG_JOB_STATUSES);
export type AutoTagJobStatus = z.infer<typeof AutoTagJobStatusSchema>;

export const AutoTagAgentSchema = z.enum(["codex"]);
export type AutoTagAgent = z.infer<typeof AutoTagAgentSchema>;

export const ACTIVE_AUTO_TAG_JOB_STATUSES: readonly AutoTagJobStatus[] = [
  "preparing",
  "ready",
  "running",
];

/** A job with no tool calls for this long is marked abandoned. */
export const AUTO_TAG_IDLE_TIMEOUT_MS = 20 * 60 * 1000;

export const AUTO_TAG_OVERVIEW_FPS = 2;
export const AUTO_TAG_OVERVIEW_SECONDS_PER_SHEET = 10;
export const AUTO_TAG_FRAMES_PER_CALL_LIMIT = 60;
/** Look-closer frames allowed per job, on top of the overview sheets. */
export const AUTO_TAG_FRAME_BUDGET = 4000;
/** A new scoring tag this close to an existing one is treated as a duplicate. */
export const AUTO_TAG_DUPLICATE_WINDOW_SECONDS = 1;

export interface AutoTagJobView {
  id: string;
  boutId: string;
  referenceBoutId: string | null;
  status: AutoTagJobStatus;
  agent: AutoTagAgent;
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
  /** Shell command that starts the agent; only present while the job can still run. */
  launchCommand: string | null;
}

export function isAutoTagJobActive(status: AutoTagJobStatus): boolean {
  return ACTIVE_AUTO_TAG_JOB_STATUSES.includes(status);
}

export function formatAutoTagJobStatus(status: AutoTagJobStatus): string {
  switch (status) {
    case "preparing":
      return "Preparing overview";
    case "ready":
      return "Waiting for agent";
    case "running":
      return "Agent tagging";
    case "finished":
      return "Finished";
    case "cancelled":
      return "Cancelled";
    case "abandoned":
      return "Abandoned";
    case "failed":
      return "Failed";
  }
}
