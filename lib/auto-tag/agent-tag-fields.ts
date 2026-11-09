import { z } from "zod";
import { PhraseFactsSchema } from "@/lib/auto-tag/phrase";
import {
  ActionCodeSchema,
  ActiveActionCodeSchema,
  MatchClockSchema,
  MatchPeriodSchema,
  SideSchema,
  StripZoneSchema,
  type Tag,
} from "@/lib/types";

/** The tag fields an auto-tag agent is allowed to set. */
export const AgentTagFieldsSchema = z.object({
  timestamp: z.number().nonnegative(),
  side: SideSchema,
  action: ActionCodeSchema,
  matchPeriod: MatchPeriodSchema.optional(),
  matchClock: MatchClockSchema.optional(),
  stripZone: StripZoneSchema.optional(),
});

export type AgentTagFields = z.infer<typeof AgentTagFieldsSchema>;

/** What the agent may send to `add_tag` and `update_tag`: legacy action codes are refused. */
export const AgentTagInputSchema = AgentTagFieldsSchema.extend({
  action: ActiveActionCodeSchema,
});

/** `add_tag` may carry the phrase facts the action code was derived from; they are logged and checked. */
export const AgentTagAddInputSchema = AgentTagInputSchema.extend({
  phrase: PhraseFactsSchema.optional().describe("Optional: what you worked out from the touch sequence. Logged with the tag; the reply flags facts that disagree with the action code."),
});

/** `update_tag` may resend the phrase facts when the action changes. */
export const AgentTagUpdateInputSchema = AgentTagInputSchema.partial().extend({
  phrase: PhraseFactsSchema.optional().describe("Resend when you change the action code."),
});

export const AutoTagEventKindSchema = z.enum(["add", "update", "delete"]);
export type AutoTagEventKind = z.infer<typeof AutoTagEventKindSchema>;

export interface AutoTagEvent {
  seq: number;
  kind: AutoTagEventKind;
  tagId: string;
  /** Agent-set fields after this event; null for deletes. */
  snapshot: AgentTagFields | null;
  reasoning: string;
  createdAt: number;
}

export function pickAgentTagFields(tag: Tag): AgentTagFields | null {
  const parsed = AgentTagFieldsSchema.safeParse({
    timestamp: tag.timestamp,
    side: tag.side,
    action: tag.action,
    matchPeriod: tag.matchPeriod,
    matchClock: tag.matchClock,
    stripZone: tag.stripZone,
  });
  return parsed.success ? parsed.data : null;
}

export function areAgentTagFieldsEqual(
  left: AgentTagFields | null,
  right: AgentTagFields | null,
): boolean {
  if (!left || !right) return left === right;
  return left.timestamp === right.timestamp &&
    left.side === right.side &&
    left.action === right.action &&
    left.matchPeriod === right.matchPeriod &&
    left.matchClock === right.matchClock &&
    left.stripZone === right.stripZone;
}

/** The agent's settled version of each tag it still believes in, keyed by tag id. */
export function getFinalAgentSnapshots(
  events: AutoTagEvent[],
): Map<string, AgentTagFields> {
  const snapshots = new Map<string, AgentTagFields>();
  for (const event of [...events].sort((left, right) => left.seq - right.seq)) {
    if (event.kind === "delete" || !event.snapshot) {
      snapshots.delete(event.tagId);
    } else {
      snapshots.set(event.tagId, event.snapshot);
    }
  }
  return snapshots;
}
