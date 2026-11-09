import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { AgentTagAddInputSchema, AgentTagUpdateInputSchema } from "@/lib/auto-tag/agent-tag-fields";
import { CropRectSchema } from "@/lib/auto-tag/frame-sheet";
import { TOUCH_SEQUENCE_DEFAULTS, TOUCH_SEQUENCE_LIMITS } from "@/lib/auto-tag/touch-sequence";
import {
  addAgentTag,
  deleteAgentTag,
  finishJob,
  getFrame,
  getJobBrief,
  getOverviewSheet,
  getTouchSequence,
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

  server.registerTool("get_touch_sequence", {
    description: "The phrase and outcome of one touch as wide-tiled sheets: sparse context, a dense exchange around the lamp, and full-frame lamp shots after the hit. Call it for every touch before choosing an action code. Spends one frame of budget per sampled instant.",
    inputSchema: z.object({
      time: TimeSchema.describe("The lamp time of the touch, in video seconds"),
      contextSeconds: z.number().min(TOUCH_SEQUENCE_LIMITS.minContextSeconds).max(TOUCH_SEQUENCE_LIMITS.maxContextSeconds).optional()
        .describe(`Seconds of sparse context before the exchange (default ${TOUCH_SEQUENCE_DEFAULTS.contextSeconds}); use more when the phrase starts earlier, e.g. a long march or a preparation that was already under way`),
      exchangeSeconds: z.number().min(TOUCH_SEQUENCE_LIMITS.minExchangeSeconds).max(TOUCH_SEQUENCE_LIMITS.maxExchangeSeconds).optional()
        .describe(`Seconds before the lamp covered densely (default ${TOUCH_SEQUENCE_DEFAULTS.exchangeSeconds}); use more for long phrases with several ripostes`),
      exchangeFps: z.number().min(TOUCH_SEQUENCE_LIMITS.minExchangeFps).max(TOUCH_SEQUENCE_LIMITS.maxExchangeFps).optional()
        .describe(`Frame rate of the dense exchange (default ${TOUCH_SEQUENCE_DEFAULTS.exchangeFps})`),
      crop: CropRectSchema.optional()
        .describe("Normalized 0-1 rectangle of the full frame applied to the context and exchange sheets (the lamp sheet is never cropped). Cover both fencers' full bodies with clear margin above the heads and below the feet; the camera pans and tilts, so check the context sheet and widen the crop if anything is cut off"),
    }),
    annotations: READ_ONLY,
  }, (request, ctx) => runJobTool(ctx, (job) => getTouchSequence(job, request)));

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
    inputSchema: AgentTagAddInputSchema.extend({ reasoning: ReasoningSchema }),
  }, ({ reasoning, phrase, ...fields }, ctx) => runJobTool(ctx, (job) => addAgentTag(job, fields, reasoning, phrase)));

  server.registerTool("update_tag", {
    description: "Correct a tag you saved earlier. Only fields you pass change.",
    inputSchema: AgentTagUpdateInputSchema.extend({
      tagId: z.string(),
      reasoning: ReasoningSchema,
    }),
  }, ({ tagId, reasoning, phrase, ...updates }, ctx) =>
    runJobTool(ctx, (job) => updateAgentTag(job, tagId, updates, reasoning, phrase)));

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
