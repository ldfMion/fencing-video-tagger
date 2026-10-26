import { getTacticalIntent } from "@/lib/action-classifications";
import type { AgentTagFields } from "@/lib/auto-tag/agent-tag-fields";
import { computeScore } from "@/lib/score";
import { STRIP_ZONES, type StripZone, type Tag } from "@/lib/types";

export const TIME_PAIRING_WINDOW_SECONDS = 2;
export const TIMING_TOLERANCE_SECONDS = 0.5;

export type AutoTagEvaluationMode = "review" | "benchmark";

export interface AutoTagEvaluationInput {
  agentTags: Map<string, AgentTagFields>;
  referenceTags: Tag[];
  mode: AutoTagEvaluationMode;
  matchClockEnabled: boolean;
  stripZoneEnabled: boolean;
}

export type EvaluatedTagField =
  | "timestamp"
  | "side"
  | "action"
  | "matchPeriod"
  | "matchClock"
  | "stripZone";

export type EvaluationPairKind = "same-id" | "time-matched";

export interface EvaluationPair {
  agentTagId: string;
  referenceTagId: string;
  kind: EvaluationPairKind;
  /** Reference minus agent timestamp; null when the reference tag has no timestamp. */
  timeDeltaSeconds: number | null;
  differingFields: EvaluatedTagField[];
}

export type FinalScore = ReturnType<typeof computeScore>;

export interface AutoTagEvaluationResult {
  mode: AutoTagEvaluationMode;
  counts: {
    agentTouches: number;
    referenceTouches: number;
    matched: number;
    /** Review mode only: user deleted the agent tag and re-created it nearby. */
    replacements: number;
    extras: number;
    misses: number;
  };
  precision: number | null;
  recall: number | null;
  timing: {
    medianAbsoluteErrorSeconds: number | null;
    shareWithinHalfSecond: number | null;
  };
  side: { share: number | null };
  action: { exactShare: number | null; intentShare: number | null };
  /** Null when match clock tagging is disabled. */
  matchClock: { exactShare: number | null } | null;
  /** Null when strip zone tagging is disabled. */
  stripZone: {
    exactShare: number | null;
    withinOneZoneShare: number | null;
  } | null;
  score: { agent: FinalScore; reference: FinalScore };
  pairs: EvaluationPair[];
  extraAgentTagIds: string[];
  missedReferenceTagIds: string[];
}

type AgentTagEntry = { id: string; fields: AgentTagFields };
type ScoringReferenceTag = Tag & Required<Pick<Tag, "side" | "action">>;
type MatchedPair = {
  agent: AgentTagEntry;
  reference: ScoringReferenceTag;
  kind: EvaluationPairKind;
};

export function evaluateAutoTagJob(
  input: AutoTagEvaluationInput,
): AutoTagEvaluationResult {
  const agentEntries = toAgentTagEntries(input.agentTags);
  const referenceTouches = input.referenceTags.filter(isScoringReferenceTag);

  const idPairs = input.mode === "review"
    ? pairById(agentEntries, referenceTouches)
    : [];
  const timePairs = pairByNearestTime(
    excludePairedAgents(agentEntries, idPairs),
    excludePairedReferences(referenceTouches, idPairs),
  );
  const matchedPairs = [...idPairs, ...timePairs];

  const extraAgentTagIds = excludePairedAgents(agentEntries, matchedPairs)
    .map((entry) => entry.id);
  const missedReferenceTagIds = excludePairedReferences(referenceTouches, matchedPairs)
    .map((tag) => tag.id);

  return {
    mode: input.mode,
    counts: {
      agentTouches: agentEntries.length,
      referenceTouches: referenceTouches.length,
      matched: matchedPairs.length,
      replacements: input.mode === "review" ? timePairs.length : 0,
      extras: extraAgentTagIds.length,
      misses: missedReferenceTagIds.length,
    },
    precision: divideOrNull(matchedPairs.length, agentEntries.length),
    recall: divideOrNull(matchedPairs.length, referenceTouches.length),
    timing: computeTimingMetrics(matchedPairs),
    side: {
      share: computeShare(matchedPairs, (pair) => pair.agent.fields.side === pair.reference.side),
    },
    action: computeActionMetrics(matchedPairs),
    matchClock: input.matchClockEnabled
      ? { exactShare: computeShare(matchedPairs, isMatchClockEqual) }
      : null,
    stripZone: input.stripZoneEnabled ? computeStripZoneMetrics(matchedPairs) : null,
    score: {
      agent: computeScore(agentEntries.map(toSyntheticTag)),
      reference: computeScore(referenceTouches),
    },
    pairs: matchedPairs.map((pair) => describePair(pair, input)),
    extraAgentTagIds,
    missedReferenceTagIds,
  };
}

function toAgentTagEntries(agentTags: Map<string, AgentTagFields>): AgentTagEntry[] {
  return [...agentTags].map(([id, fields]) => ({ id, fields }));
}

function isScoringReferenceTag(tag: Tag): tag is ScoringReferenceTag {
  return tag.side != null && tag.action != null;
}

function pairById(
  agentEntries: AgentTagEntry[],
  referenceTouches: ScoringReferenceTag[],
): MatchedPair[] {
  const agentEntriesById = new Map(agentEntries.map((entry) => [entry.id, entry]));
  return referenceTouches.flatMap((reference) => {
    const agent = agentEntriesById.get(reference.id);
    return agent ? [{ agent, reference, kind: "same-id" as const }] : [];
  });
}

function pairByNearestTime(
  agentEntries: AgentTagEntry[],
  referenceTouches: ScoringReferenceTag[],
): MatchedPair[] {
  const candidates = listTimePairCandidatesClosestFirst(agentEntries, referenceTouches);
  const usedAgentIds = new Set<string>();
  const usedReferenceIds = new Set<string>();
  const pairs: MatchedPair[] = [];

  for (const candidate of candidates) {
    if (usedAgentIds.has(candidate.agent.id) || usedReferenceIds.has(candidate.reference.id)) {
      continue;
    }
    usedAgentIds.add(candidate.agent.id);
    usedReferenceIds.add(candidate.reference.id);
    pairs.push({ agent: candidate.agent, reference: candidate.reference, kind: "time-matched" });
  }
  return pairs;
}

function listTimePairCandidatesClosestFirst(
  agentEntries: AgentTagEntry[],
  referenceTouches: ScoringReferenceTag[],
) {
  const timedReferences = referenceTouches.filter((tag) => tag.timestamp != null);
  return agentEntries
    .flatMap((agent) =>
      timedReferences.map((reference) => ({
        agent,
        reference,
        distance: Math.abs(reference.timestamp! - agent.fields.timestamp),
      })),
    )
    .filter((candidate) => candidate.distance <= TIME_PAIRING_WINDOW_SECONDS)
    .sort((left, right) =>
      left.distance - right.distance ||
      left.agent.fields.timestamp - right.agent.fields.timestamp,
    );
}

function excludePairedAgents(
  agentEntries: AgentTagEntry[],
  pairs: MatchedPair[],
): AgentTagEntry[] {
  const pairedIds = new Set(pairs.map((pair) => pair.agent.id));
  return agentEntries.filter((entry) => !pairedIds.has(entry.id));
}

function excludePairedReferences(
  referenceTouches: ScoringReferenceTag[],
  pairs: MatchedPair[],
): ScoringReferenceTag[] {
  const pairedIds = new Set(pairs.map((pair) => pair.reference.id));
  return referenceTouches.filter((tag) => !pairedIds.has(tag.id));
}

function computeTimingMetrics(pairs: MatchedPair[]): AutoTagEvaluationResult["timing"] {
  const absoluteErrors = pairs.flatMap((pair) => {
    const delta = getTimeDelta(pair);
    return delta == null ? [] : [Math.abs(delta)];
  });
  return {
    medianAbsoluteErrorSeconds: median(absoluteErrors),
    shareWithinHalfSecond: computeShare(
      absoluteErrors,
      (error) => error <= TIMING_TOLERANCE_SECONDS,
    ),
  };
}

function computeActionMetrics(pairs: MatchedPair[]): AutoTagEvaluationResult["action"] {
  return {
    exactShare: computeShare(pairs, (pair) => pair.agent.fields.action === pair.reference.action),
    intentShare: computeShare(
      pairs,
      (pair) =>
        getTacticalIntent(pair.agent.fields.action) === getTacticalIntent(pair.reference.action),
    ),
  };
}

function computeStripZoneMetrics(
  pairs: MatchedPair[],
): NonNullable<AutoTagEvaluationResult["stripZone"]> {
  return {
    exactShare: computeShare(
      pairs,
      (pair) => pair.agent.fields.stripZone === pair.reference.stripZone,
    ),
    withinOneZoneShare: computeShare(pairs, (pair) =>
      areStripZonesWithinOne(pair.agent.fields.stripZone, pair.reference.stripZone),
    ),
  };
}

function isMatchClockEqual(pair: MatchedPair): boolean {
  return pair.agent.fields.matchPeriod === pair.reference.matchPeriod &&
    pair.agent.fields.matchClock === pair.reference.matchClock;
}

function areStripZonesWithinOne(
  agentZone: StripZone | undefined,
  referenceZone: StripZone | undefined,
): boolean {
  if (!agentZone || !referenceZone) return agentZone === referenceZone;
  return Math.abs(getStripZoneOrder(agentZone) - getStripZoneOrder(referenceZone)) <= 1;
}

function getStripZoneOrder(zone: StripZone): number {
  return STRIP_ZONES.indexOf(zone);
}

function getTimeDelta(pair: MatchedPair): number | null {
  return pair.reference.timestamp == null
    ? null
    : pair.reference.timestamp - pair.agent.fields.timestamp;
}

function describePair(pair: MatchedPair, input: AutoTagEvaluationInput): EvaluationPair {
  return {
    agentTagId: pair.agent.id,
    referenceTagId: pair.reference.id,
    kind: pair.kind,
    timeDeltaSeconds: getTimeDelta(pair),
    differingFields: listDifferingFields(pair, input),
  };
}

function listDifferingFields(
  pair: MatchedPair,
  input: Pick<AutoTagEvaluationInput, "matchClockEnabled" | "stripZoneEnabled">,
): EvaluatedTagField[] {
  const comparedFields: EvaluatedTagField[] = [
    "timestamp",
    "side",
    "action",
    ...(input.matchClockEnabled ? ["matchPeriod", "matchClock"] as const : []),
    ...(input.stripZoneEnabled ? ["stripZone"] as const : []),
  ];
  return comparedFields.filter((field) => pair.agent.fields[field] !== pair.reference[field]);
}

function toSyntheticTag(entry: AgentTagEntry): Tag {
  return { id: entry.id, createdAt: 0, comment: "", ...entry.fields };
}

function computeShare<T>(items: T[], isHit: (item: T) => boolean): number | null {
  return divideOrNull(items.filter(isHit).length, items.length);
}

function divideOrNull(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
