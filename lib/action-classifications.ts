export type TacticalIntent = "offense" | "defense";
export type DefAlternative = "P" | "C" | "AP";

export interface ActionDefinition {
  /** Plain-language meaning of the code, written from the scorer's point of view. */
  description: string;
  /** offense or defense; null for cards and stoppages */
  tacticalIntent: TacticalIntent | null;
  /** for defensive actions, what defense the scoring fencer used */
  scoringDefAlt?: DefAlternative;
  /** for offensive actions, what defense the non-scoring fencer attempted */
  receivingDefAlt?: DefAlternative;
}

/**
 * The single source of truth for action codes: the list, their order in pickers, their meaning,
 * and their classification dimensions. `ACTION_CODES` and the `ActionCode` type derive from it.
 *
 * Notation: the scorer's actions come before `-`, the opponent's after it; `,` chains the same
 * fencer's successive actions, so `R` after a comma is a renewal (remise or redoublement).
 * A attack · P parry · R riposte (or renewal after a comma) · C counterattack · CT counter-time ·
 * CR counter-riposte · CCR counter-counter-riposte · AP attack on preparation · L point in line.
 */
export const ACTION_DEFINITIONS = {
  "A,R": {
    description: "The scorer attacks, is parried, and scores with a renewal of the attack.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "A,R,R": {
    description: "The scorer attacks, is parried, and scores on the second renewal.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "A,R-P": {
    description: "The scorer attacks, is parried, and scores with a renewal that beats the opponent's second parry.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "A-A": {
    description: "Both fencers attack; the scorer's attack had priority or arrived alone.",
    tacticalIntent: "offense",
  },
  "A-AP": {
    description: "The scorer attacks and scores despite the opponent's attempted attack on preparation.",
    tacticalIntent: "offense", receivingDefAlt: "AP",
  },
  "A-Cc": {
    description: "The scorer attacks and scores against the opponent's counterattack (Cc variant).",
    tacticalIntent: "offense", receivingDefAlt: "C",
  },
  "A-Csh": {
    description: "The scorer attacks and scores against the opponent's counterattack (Csh variant).",
    tacticalIntent: "offense", receivingDefAlt: "C",
  },
  "A-D": {
    description: "The scorer attacks and scores against the opponent's attempt to defend by retreating out of distance.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "A-L": {
    description: "The scorer attacks against the opponent's point in line, taking or beating the blade, and scores.",
    tacticalIntent: "offense", receivingDefAlt: "AP",
  },
  "A-P": {
    description: "The scorer attacks and scores; the opponent's parry fails.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "AN-P": {
    description: "The opponent's attack falls short; the scorer answers it at once and scores despite the opponent's parry attempt.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "AN-R": {
    description: "The opponent's attack falls short; the scorer answers it at once and scores against the opponent's renewal.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "AN,R": {
    description: "The opponent's attack falls short; the scorer answers it, is parried, and scores with a renewal.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "AP-A": {
    description: "The scorer attacks into the opponent's preparation and scores before the opponent's attack.",
    tacticalIntent: "defense", scoringDefAlt: "AP",
  },
  "AP-P": {
    description: "The scorer attacks into the opponent's preparation and scores; the opponent's parry fails.",
    tacticalIntent: "defense", scoringDefAlt: "AP",
  },
  "AP,R": {
    description: "The scorer attacks into the opponent's preparation, is parried, and scores with a renewal.",
    tacticalIntent: "defense", scoringDefAlt: "AP",
  },
  "AR,R": {
    description: "The scorer's attack is parried and riposted; the scorer renews and scores.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  bl: {
    description: "The bout is halted for blood or injury; no point is awarded.",
    tacticalIntent: null,
  },
  "Cc-A": {
    description: "The opponent attacks; the scorer's counterattack (Cc variant) arrives first or alone.",
    tacticalIntent: "defense", scoringDefAlt: "C",
  },
  "Cc-AP": {
    description: "The opponent attacks on preparation; the scorer's counterattack (Cc variant) scores.",
    tacticalIntent: "defense", scoringDefAlt: "C",
  },
  "Cc-CT": {
    description: "The scorer counterattacks (Cc variant) and scores; the opponent's counter-time fails.",
    tacticalIntent: "defense", scoringDefAlt: "C",
  },
  "CCR,R": {
    description: "The scorer parries the opponent's counter-riposte and scores with a renewed counter-counter-riposte.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "CCR-R": {
    description: "The scorer parries the opponent's counter-riposte and scores with a counter-counter-riposte against the opponent's renewal.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "CCR-P": {
    description: "The scorer parries the opponent's counter-riposte and scores with a counter-counter-riposte; the opponent's parry fails.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "CR,R": {
    description: "The scorer's attack is parried; the scorer parries the riposte and scores with a renewed counter-riposte.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "CR,R,R,R": {
    description: "The scorer's attack is parried; the scorer parries the riposte and scores with the third renewal of the counter-riposte.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "CR-P": {
    description: "The scorer's attack is parried; the scorer parries the riposte and counter-ripostes; the opponent's parry fails.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "CR-R": {
    description: "The scorer's attack is parried; the scorer parries the riposte and counter-ripostes against the opponent's renewal.",
    tacticalIntent: "offense", receivingDefAlt: "P",
  },
  "Csh-A": {
    description: "The opponent attacks; the scorer's counterattack (Csh variant) arrives first or alone.",
    tacticalIntent: "defense", scoringDefAlt: "C",
  },
  "CT-R": {
    description: "The scorer draws and parries the opponent's counterattack, then scores with a counter-time riposte against the opponent's renewal.",
    tacticalIntent: "offense", receivingDefAlt: "C",
  },
  "CT-P": {
    description: "The scorer draws and parries the opponent's counterattack, then scores with a counter-time riposte; the opponent's parry fails.",
    tacticalIntent: "offense", receivingDefAlt: "C",
  },
  "CT,R": {
    description: "The scorer draws and parries the opponent's counterattack; the counter-time riposte is parried and the scorer scores with a renewal.",
    tacticalIntent: "offense", receivingDefAlt: "C",
  },
  "C,R": {
    description: "The opponent attacks; the scorer counterattacks and scores with a renewal of the counterattack.",
    tacticalIntent: "defense", scoringDefAlt: "C",
  },
  "C,R,R": {
    description: "The opponent attacks; the scorer counterattacks and scores on the second renewal.",
    tacticalIntent: "defense", scoringDefAlt: "C",
  },
  "C,R-CT": {
    description: "The opponent attacks; the scorer counterattacks and renews, scoring despite the opponent's counter-time.",
    tacticalIntent: "defense", scoringDefAlt: "C",
  },
  "L-A": {
    description: "The scorer's point in line is established; the opponent attacks into it and the line scores.",
    tacticalIntent: "defense", scoringDefAlt: "AP",
  },
  "R,R": {
    description: "The scorer parries the opponent's attack; the riposte is parried and the scorer scores with a renewal.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "R,R,R": {
    description: "The scorer parries the opponent's attack and scores on the second renewal of the riposte.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "R-AP,P": {
    description: "The scorer parries the opponent's attack on preparation and ripostes; the opponent tries to parry again and fails.",
    tacticalIntent: "offense", receivingDefAlt: "AP",
  },
  "R-AP,R": {
    description: "The scorer parries the opponent's attack on preparation and ripostes against the opponent's renewal.",
    tacticalIntent: "offense", receivingDefAlt: "AP",
  },
  "R-CT,R": {
    description: "The scorer parries the opponent's counter-time riposte and ripostes against the opponent's renewal.",
    tacticalIntent: "defense",
  },
  "R-P": {
    description: "The scorer parries the opponent's attack and ripostes; the opponent's parry of the riposte fails.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  "R-R": {
    description: "The scorer parries the opponent's attack and ripostes against the opponent's renewal.",
    tacticalIntent: "defense", scoringDefAlt: "P",
  },
  rc: {
    description: "Red card against the tagged side; the opponent is awarded the point.",
    tacticalIntent: null,
  },
  yc: {
    description: "Yellow card against the tagged side; no point is awarded.",
    tacticalIntent: null,
  },
} as const satisfies Record<string, ActionDefinition>;

export type ActionCode = keyof typeof ACTION_DEFINITIONS;

/** All action codes in picker order. */
export const ACTION_CODES = Object.keys(ACTION_DEFINITIONS) as [ActionCode, ...ActionCode[]];

export function getActionDefinition(action: ActionCode): ActionDefinition {
  return ACTION_DEFINITIONS[action];
}

export function getActionDescription(action: ActionCode): string {
  return ACTION_DEFINITIONS[action].description;
}

export function getTacticalIntent(action: ActionCode): TacticalIntent | null {
  return ACTION_DEFINITIONS[action].tacticalIntent;
}

export function getScoringDefAlternative(
  action: ActionCode,
): DefAlternative | undefined {
  return getActionDefinition(action).scoringDefAlt;
}

export function getReceivingDefAlternative(
  action: ActionCode,
): DefAlternative | undefined {
  return getActionDefinition(action).receivingDefAlt;
}
