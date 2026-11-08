import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export function getAutoTagJobDirectory(jobId: string): string {
  return path.join(process.cwd(), ".data", "auto-tag-jobs", jobId);
}

export function getAutoTagOverviewDirectory(jobId: string): string {
  return path.join(getAutoTagJobDirectory(jobId), "overview");
}

export function getAutoTagSamplesDirectory(jobId: string): string {
  return path.join(getAutoTagJobDirectory(jobId), "samples");
}

/** Creates the job folder; it is also the agent's working directory, so it holds no project files. */
export async function ensureAutoTagJobWorkspace(jobId: string): Promise<void> {
  await fs.mkdir(getAutoTagJobDirectory(jobId), { recursive: true });
}

export async function removeAutoTagJobWorkspace(jobId: string): Promise<void> {
  await fs.rm(getAutoTagJobDirectory(jobId), { recursive: true, force: true });
}
