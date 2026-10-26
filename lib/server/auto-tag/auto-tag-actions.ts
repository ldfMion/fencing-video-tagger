"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import type { AutoTagJobView } from "@/lib/auto-tag/job";
import {
  cancelAutoTagJob as cancelJob,
  createBenchmarkCopy,
  getAutoTagJobReport as buildJobReport,
  getLatestAutoTagJob,
  getLaunchableJob,
  startAutoTagJob as startJob,
  type AutoTagJobReport,
} from "@/lib/server/auto-tag/job-service";
import { buildLaunchCommand, openCommandInTerminal } from "@/lib/server/auto-tag/job-workspace";

const SessionInputSchema = z.object({ sessionId: z.string() });
const JobInputSchema = z.object({ jobId: z.string() });

const AUTO_TAG_MCP_PATH = "/api/auto-tag/mcp";

export async function getAutoTagJobForSession(
  input: z.infer<typeof SessionInputSchema>,
): Promise<AutoTagJobView | null> {
  return getLatestAutoTagJob(SessionInputSchema.parse(input).sessionId);
}

export async function startAutoTagJob(
  input: z.infer<typeof SessionInputSchema>,
): Promise<AutoTagJobView> {
  return startJob({
    sessionId: SessionInputSchema.parse(input).sessionId,
    mcpUrl: await resolveMcpUrl(),
    scheduleBackgroundWork: after,
  });
}

export async function startAutoTagBenchmark(
  input: z.infer<typeof SessionInputSchema>,
): Promise<{ sessionId: string; job: AutoTagJobView }> {
  const copy = await createBenchmarkCopy(SessionInputSchema.parse(input).sessionId);
  const job = await startJob({
    sessionId: copy.id,
    referenceBoutId: input.sessionId,
    mcpUrl: await resolveMcpUrl(),
    scheduleBackgroundWork: after,
  });
  return { sessionId: copy.id, job };
}

export async function cancelAutoTagJob(
  input: z.infer<typeof JobInputSchema>,
): Promise<AutoTagJobView> {
  return cancelJob(JobInputSchema.parse(input).jobId);
}

export async function openAutoTagJobInTerminal(
  input: z.infer<typeof JobInputSchema>,
): Promise<{ opened: true } | { opened: false; error: string }> {
  const job = await getLaunchableJob(JobInputSchema.parse(input).jobId);
  try {
    await openCommandInTerminal(buildLaunchCommand(job.id));
    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      error: error instanceof Error && /-1743|not allowed|not authorized/i.test(error.message)
        ? "macOS blocked the app from controlling Terminal. Allow it under System Settings → Privacy & Security → Automation, or copy the command."
        : "Could not open Terminal. Copy the command and run it yourself.",
    };
  }
}

export async function getAutoTagJobReport(
  input: z.infer<typeof JobInputSchema>,
): Promise<AutoTagJobReport> {
  return buildJobReport(JobInputSchema.parse(input).jobId);
}

async function resolveMcpUrl(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}${AUTO_TAG_MCP_PATH}`;
}
