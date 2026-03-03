import type { ActionCode } from "@/lib/types";

export type TacticalIntent = "offense" | "defense";
export type DefAlternative = "P" | "C" | "AP";

interface ActionClassification {
  tacticalIntent: TacticalIntent | null;
  scoringDefAlt?: DefAlternative;
  receivingDefAlt?: DefAlternative;
}

/**
 * All classification dimensions for each ActionCode in a single lookup,
 * sorted alphabetically to match ACTION_CODES in types.ts.
 *
 * - tacticalIntent: offense or defense (null for cards/blood)
 * - scoringDefAlt: for defensive actions, what defense the scoring fencer used
 * - receivingDefAlt: for offensive actions, what defense the non-scoring fencer attempted
 */
const CLASSIFICATIONS: Record<ActionCode, ActionClassification> = {
  "A,R":     { tacticalIntent: "offense", receivingDefAlt: "P" },
  "A,R,R":   { tacticalIntent: "offense", receivingDefAlt: "P" },
  "A,R-P":   { tacticalIntent: "offense", receivingDefAlt: "P" },
  "A-A":     { tacticalIntent: "offense" },
  "A-AP":    { tacticalIntent: "offense", receivingDefAlt: "AP" },
  "A-Cc":    { tacticalIntent: "offense", receivingDefAlt: "C" },
  "A-Csh":   { tacticalIntent: "offense", receivingDefAlt: "C" },
  "A-D":     { tacticalIntent: "offense", receivingDefAlt: "P" },
  "A-L":     { tacticalIntent: "offense", receivingDefAlt: "AP" },
  "A-P":     { tacticalIntent: "offense", receivingDefAlt: "P" },
  "AN-P":    { tacticalIntent: "defense", scoringDefAlt: "P" },
  "AN-R":    { tacticalIntent: "defense", scoringDefAlt: "P" },
  "AP-A":    { tacticalIntent: "defense", scoringDefAlt: "AP" },
  "AP-P":    { tacticalIntent: "defense", scoringDefAlt: "AP" },
  "AP,R":    { tacticalIntent: "defense", scoringDefAlt: "AP" },
  "AR,R":    { tacticalIntent: "offense", receivingDefAlt: "P" },
  "bl":      { tacticalIntent: null },
  "Cc-A":    { tacticalIntent: "defense", scoringDefAlt: "C" },
  "Cc-AP":   { tacticalIntent: "defense", scoringDefAlt: "C" },
  "Cc-CT":   { tacticalIntent: "defense", scoringDefAlt: "C" },
  "CCR-R":   { tacticalIntent: "defense", scoringDefAlt: "P" },
  "CCR-P":   { tacticalIntent: "defense", scoringDefAlt: "P" },
  "CR,R":    { tacticalIntent: "offense", receivingDefAlt: "P" },
  "CR-P":    { tacticalIntent: "offense", receivingDefAlt: "P" },
  "CR-R":    { tacticalIntent: "offense", receivingDefAlt: "P" },
  "Csh-A":   { tacticalIntent: "defense", scoringDefAlt: "C" },
  "CT-R":    { tacticalIntent: "offense", receivingDefAlt: "C" },
  "CT-P":    { tacticalIntent: "offense", receivingDefAlt: "C" },
  "C,R-CT":  { tacticalIntent: "defense", scoringDefAlt: "C" },
  "L-A":     { tacticalIntent: "defense", scoringDefAlt: "AP" },
  "R,R":     { tacticalIntent: "defense", scoringDefAlt: "P" },
  "R-AP,P":  { tacticalIntent: "offense", receivingDefAlt: "AP" },
  "R-AP,R":  { tacticalIntent: "offense", receivingDefAlt: "AP" },
  "R-CT,R":  { tacticalIntent: "defense" },
  "R-P":     { tacticalIntent: "defense", scoringDefAlt: "P" },
  "R-R":     { tacticalIntent: "defense", scoringDefAlt: "P" },
  "rc":      { tacticalIntent: null },
  "yc":      { tacticalIntent: null },
};

export function getTacticalIntent(action: ActionCode): TacticalIntent | null {
  return CLASSIFICATIONS[action].tacticalIntent;
}

export function getScoringDefAlternative(action: ActionCode): DefAlternative | undefined {
  return CLASSIFICATIONS[action].scoringDefAlt;
}

export function getReceivingDefAlternative(action: ActionCode): DefAlternative | undefined {
  return CLASSIFICATIONS[action].receivingDefAlt;
}
