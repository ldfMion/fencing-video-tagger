import { getActionDescription, getTacticalIntent } from "@/lib/action-classifications";
import { formatAgentTagLine } from "@/lib/auto-tag/tag-lines";
import { STRIP_ZONE_LABELS } from "@/lib/tagging";
import { ACTIVE_ACTION_CODES, STRIP_ZONES, type ActionCode, type Tag } from "@/lib/types";
import { formatTime } from "@/lib/utils";

export const AUTO_TAG_MCP_SERVER_NAME = "fencing_auto_tag";

export interface AutoTagBriefContext {
  leftFencer?: string;
  rightFencer?: string;
  videoDuration: number;
  matchClockEnabled: boolean;
  stripZoneEnabled: boolean;
  overviewSheetCount: number;
  overviewFps: number;
  secondsPerSheet: number;
  framesPerCallLimit: number;
  framesRemaining: number;
  tags: Tag[];
}

export function buildAgentPrompt(): string {
  return [
    "You are auto-tagging the scoring touches of a recorded foil bout for a fencing video tagger app.",
    "",
    `You cannot open the video directly. Everything goes through the \`${AUTO_TAG_MCP_SERVER_NAME}\` MCP tools: they return frame images and save tags straight into the app.`,
    "",
    "Start by calling `get_job_brief`. It has the fencers, the rules, the action codes, and the tools' limits. Follow it until every awarded touch in the video is tagged, then call `finish_job`.",
    "",
    "These MCP tools are the only tools you have. Work through the video from start to end and keep going until it is fully covered. Nobody reads your messages while you work, so never stop to ask a question; decide and move on.",
  ].join("\n");
}

export function buildJobBrief(context: AutoTagBriefContext): string {
  return [
    describeBout(context),
    describeGoal(),
    describeTagRules(context),
    describeWorkflow(context),
    describeActionCodes(),
    describeExistingTags(context.tags),
  ].join("\n\n");
}

function describeBout(context: AutoTagBriefContext): string {
  return [
    "# Bout",
    `- Left fencer (side L, on the left of the frame at the start): ${context.leftFencer ?? "unknown"}`,
    `- Right fencer (side R): ${context.rightFencer ?? "unknown"}`,
    `- Video length: ${formatTime(context.videoDuration)} (${context.videoDuration.toFixed(1)}s)`,
    `- Match clock required on every tag: ${context.matchClockEnabled ? "yes" : "no"}`,
    `- Strip zone required on every tag: ${context.stripZoneEnabled ? "yes" : "no"}`,
  ].join("\n");
}

function describeGoal(): string {
  return [
    "# Goal",
    "Save exactly one tag for every touch the referee awarded: a point to one fencer, or a card. Do not tag off-target lights, annulled touches, or simultaneous lights where no point was given. Do not record mistakes, failure modes, or comments: only the fields listed below.",
  ].join("\n");
}

function describeTagRules(context: AutoTagBriefContext): string {
  const rules = [
    "# Tag fields",
    "- `timestamp`: video seconds of the first frame where the scoring lamp is visibly on. Use the exact tile times the tools report; never estimate from frame counts.",
    "- `side`: the fencer awarded the point. For cards, `side` is the fencer who received the card: `rc` gives the point to the opponent, `yc` gives no point.",
    "- `action`: always pick your single best code from the list below, even when unsure. Never leave it empty.",
  ];
  if (context.matchClockEnabled) {
    rules.push(
      "- `matchPeriod` (`1`, `2`, `3`, or `priority`) and `matchClock` (time remaining as `m:ss`, e.g. `2:17`): read them from the scoreboard at the touch. Clocks must be in order across tags; if a save is rejected for ordering, one of the neighbouring tags it names may be the misread one.",
    );
  }
  if (context.stripZoneEnabled) {
    const zones = STRIP_ZONES.map((zone) => `\`${zone}\` = ${STRIP_ZONE_LABELS[zone]}`).join(", ");
    rules.push(
      `- \`stripZone\`: where on the strip the touch happened, left to right as seen in the frame: ${zones}.`,
    );
  }
  rules.push("- `reasoning`: one or two sentences on what you saw. It is logged, not shown on the tag.");
  return rules.join("\n");
}

function describeWorkflow(context: AutoTagBriefContext): string {
  return [
    "# How to work",
    `- The whole video is pre-cut into ${context.overviewSheetCount} overview sheets (\`get_overview_sheet\`, index 0-${Math.max(context.overviewSheetCount - 1, 0)}), each ${context.secondsPerSheet}s at ${context.overviewFps} frames per second, tiled into one image. The text next to each image lists every tile's time. Overview sheets are free.`,
    `- Look closer with \`sample_frames\` (a time window at a higher frame rate, optionally cropped) or \`get_frame\` (one full-resolution frame, optionally cropped, e.g. to read the scoreboard). Crops use 0-1 coordinates of the full frame, so they work even when a handheld camera moves. Each call is capped at ${context.framesPerCallLimit} frames; ${context.framesRemaining} look-closer frames remain for this job.`,
    "- Save as you go: call `add_tag` as soon as you are confident a touch was awarded. Fix your own tags with `update_tag` or `delete_tag`. Once the user edits one of your tags, it is theirs and you can no longer change it.",
    "- A new scoring tag within 1 second of an existing one is rejected as a duplicate. Call `list_tags` whenever you lose track of what is already saved.",
    "- When the whole video is covered, call `finish_job` with a short summary. Nothing else ends the job.",
  ].join("\n");
}

function describeActionCodes(): string {
  const codesByIntent = {
    offense: ACTIVE_ACTION_CODES.filter((code) => getTacticalIntent(code) === "offense"),
    defense: ACTIVE_ACTION_CODES.filter((code) => getTacticalIntent(code) === "defense"),
    other: ACTIVE_ACTION_CODES.filter((code) => getTacticalIntent(code) === null),
  };
  return [
    "# Action codes",
    "The user's own notation: the scorer's actions come before `-` and the opponent's after it; `,` chains the same fencer's successive actions, so `R` after a comma is a renewal. `A` attack, `P` parry, `R` riposte, `C` counterattack (`Cc` closing: collapsing the distance, dodging, or opposing the blade; `Csh` stop hit: opening the distance and running away), `CT` counter-time, `CR` counter-riposte, `CCR` counter-counter-riposte, `AP` attack on preparation, `AN` answering attack after the opponent's attack falls short, `D` defense by distance, `L` point in line. Pick the code whose description matches what you saw; when unsure between two, the offense/defense grouping (from the scorer's point of view) matters most.",
    "",
    "## Offense (the scorer was attacking)",
    ...codesByIntent.offense.map(describeCode),
    "",
    "## Defense (the scorer was defending)",
    ...codesByIntent.defense.map(describeCode),
    "",
    "## Other",
    ...codesByIntent.other.map(describeCode),
  ].join("\n");
}

function describeCode(code: ActionCode): string {
  return `- \`${code}\`: ${getActionDescription(code)}`;
}

function describeExistingTags(tags: Tag[]): string {
  const scoringTags = tags.filter((tag) => tag.side && tag.action);
  if (scoringTags.length === 0) {
    return "# Existing tags\nNone yet.";
  }
  return ["# Existing tags", ...scoringTags.map(formatAgentTagLine)].join("\n");
}
