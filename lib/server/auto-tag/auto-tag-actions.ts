"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import type { AutoTagJobView } from "@/lib/auto-tag/job";
import {
  cancelAutoTagJob as cancelJob,
  getAutoTagJobReport as buildJobReport,
  getLatestAutoTagJob,
  startAutoTagBenchmark as startBenchmark,
  startAutoTagJob as startJob,
  type AutoTagJobReport,
} from "@/lib/server/auto-tag/job-service";

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
  return startBenchmark({
    sessionId: SessionInputSchema.parse(input).sessionId,
    mcpUrl: await resolveMcpUrl(),
    scheduleBackgroundWork: after,
  });
}

export async function cancelAutoTagJob(
  input: z.infer<typeof JobInputSchema>,
): Promise<AutoTagJobView> {
  return cancelJob(JobInputSchema.parse(input).jobId);
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
