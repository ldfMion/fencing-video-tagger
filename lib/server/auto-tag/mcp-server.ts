import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { AgentTagFieldsSchema } from "@/lib/auto-tag/agent-tag-fields";
import { CropRectSchema } from "@/lib/auto-tag/frame-sheet";
import {
  addAgentTag,
  deleteAgentTag,
  finishJob,
  getFrame,
  getJobBrief,
  getOverviewSheet,
  listJobTags,
  sampleFrames,
  updateAgentTag,
  type AgentToolContent,
} from "@/lib/server/auto-tag/agent-tools";
import { recordAgentActivity, requireJob } from "@/lib/server/auto-tag/job-service";
import type { AutoTagJobRecord } from "@/lib/server/repositories/auto-tag-job-repository";

type ToolContext = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

const ReasoningSchema = z.string().min(1).describe("One or two sentences on what you saw; logged, not shown on the tag.");
const TimeSchema = z.number().nonnegative().describe("Video seconds");

const READ_ONLY = { readOnlyHint: true } as const;

export function registerAutoTagTools(server: McpServer): void {
  server.registerTool("get_job_brief", {
    description: "Bout details, tagging rules, action codes, and frame limits. Call this first.",
    annotations: READ_ONLY,
  }, (ctx) => runJobTool(ctx, (job) => getJobBrief(job)));

  server.registerTool("get_overview_sheet", {
    description: "One pre-cut overview sheet: a grid of frames covering a fixed slice of the video, with each tile's exact time.",
    inputSchema: z.object({ index: z.number().int().nonnegative() }),
    annotations: READ_ONLY,
  }, ({ index }, ctx) => runJobTool(ctx, (job) => getOverviewSheet(job, index)));

  server.registerTool("sample_frames", {
    description: "Frames from a time window at a chosen frame rate, tiled into one image, optionally cropped. Spends look-closer budget.",
    inputSchema: z.object({
      start: TimeSchema,
      end: TimeSchema,
      fps: z.number().positive().max(60),
      crop: CropRectSchema.optional().describe("Normalized 0-1 rectangle of the full frame"),
    }),
    annotations: READ_ONLY,
  }, (request, ctx) => runJobTool(ctx, (job) => sampleFrames(job, request)));

  server.registerTool("get_frame", {
    description: "One full-resolution frame at or just after a time, optionally cropped (e.g. to read the scoreboard). Spends 1 frame of budget.",
    inputSchema: z.object({
      time: TimeSchema,
      crop: CropRectSchema.optional().describe("Normalized 0-1 rectangle of the full frame"),
    }),
    annotations: READ_ONLY,
  }, (request, ctx) => runJobTool(ctx, (job) => getFrame(job, request)));

  server.registerTool("list_tags", {
    description: "Current scoring tags on the bout, with whether you can still edit each one.",
    annotations: READ_ONLY,
  }, (ctx) => runJobTool(ctx, (job) => listJobTags(job)));

  server.registerTool("add_tag", {
    description: "Save one awarded touch immediately. It appears in the app right away.",
    inputSchema: AgentTagFieldsSchema.extend({ reasoning: ReasoningSchema }),
  }, ({ reasoning, ...fields }, ctx) => runJobTool(ctx, (job) => addAgentTag(job, fields, reasoning)));

  server.registerTool("update_tag", {
    description: "Correct a tag you saved earlier. Only fields you pass change.",
    inputSchema: AgentTagFieldsSchema.partial().extend({
      tagId: z.string(),
      reasoning: ReasoningSchema,
    }),
  }, ({ tagId, reasoning, ...updates }, ctx) =>
    runJobTool(ctx, (job) => updateAgentTag(job, tagId, updates, reasoning)));

  server.registerTool("delete_tag", {
    description: "Withdraw a tag you saved earlier that you no longer believe.",
    inputSchema: z.object({ tagId: z.string(), reasoning: ReasoningSchema }),
    annotations: { destructiveHint: true },
  }, ({ tagId, reasoning }, ctx) => runJobTool(ctx, (job) => deleteAgentTag(job, tagId, reasoning)));

  server.registerTool("finish_job", {
    description: "End the job once the whole video is covered. No further tool calls will work afterwards.",
    inputSchema: z.object({ summary: z.string().min(1) }),
  }, ({ summary }, ctx) => runJobTool(ctx, (job) => finishJob(job, summary)));
}

async function runJobTool(
  ctx: ToolContext,
  tool: (job: AutoTagJobRecord) => Promise<AgentToolContent[]>,
) {
  try {
    const job = await requireActiveJob(ctx);
    await recordAgentActivity(job.id);
    return { content: await tool(job) };
  } catch (error) {
    return {
      content: [{
        type: "text" as const,
        text: error instanceof Error ? error.message : "The tool failed.",
      }],
      isError: true,
    };
  }
}

async function requireActiveJob(ctx: ToolContext): Promise<AutoTagJobRecord> {
  const jobId = ctx.http?.authInfo?.extra?.jobId;
  if (typeof jobId !== "string") {
    throw new Error("Missing auto-tag job credentials.");
  }
  const job = await requireJob(jobId);
  if (job.status !== "ready" && job.status !== "running") {
    throw new Error(`This auto-tag job is ${job.status}; stop working on it.`);
  }
  return job;
}
