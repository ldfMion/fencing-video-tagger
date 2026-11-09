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
  /**
   * Kept only so existing tags stay valid: hidden from the tag picker and from the auto-tag agent.
   * Legacy codes still show up in search filters and statistics.
   */
  legacy?: true;
}

/**
 * The single source of truth for action codes: the list, their order in pickers, their meaning,
 * and their classification dimensions. `ACTION_CODES` and the `ActionCode` type derive from it.
 *
 * Notation: the scorer's actions come before `-`, the opponent's after it; `,` chains the same
 * fencer's successive actions, so `R` after a comma is a renewal (remise or redoublement).
 * A attack · P parry · R riposte (or renewal after a comma) · C counterattack · CT counter-time ·
 * CR counter-riposte · CCR counter-counter-riposte · AP attack on preparation · AN answering attack
 * (after the opponent's attack falls short, with distance only) · L point in line · D defense by
 * distance (retreating) · Cc closing counterattack (collapsing the distance, dodging, or opposing
 * the blade) · Csh stop-hit counterattack (opening the distance and running away) · bl the
 * opponent crossed the back line.
 */
export const ACTION_DEFINITIONS = {
  "A,R": {
    description:
      "The scorer attacks, is parried, and scores with a renewal of the attack. Usually a good parry that clearly found the blade, then a missed riposte, then the attacker's second action lands; sometimes the riposte is delayed and the attacker regains priority.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "A,R,R": {
    description:
      "Like `A,R` but with an additional renewal: a missed attack, a missed renewal, and a hit on the second renewal.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "A,R-P": {
    description:
      "The scorer attacks, is parried, and scores with a renewal that beats the opponent's second parry. This is used specifically when the defender tries to parry again instead of riposting after the first parry.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "A-A": {
    description:
      "Both fencers attempt an attack. Either the scoring fencer had right of way or the other fencer missed. Usually only happens right after 'allez'.",
    tacticalIntent: "offense",
  },
  "A-AP": {
    description:
      "The scorer attacks and scores despite the opponent's attempted attack on preparation. This should be used when the opponent attempted an attack on preparation but didn't actually get right of way. Can also be used when the defender properly executes an attack on preparation but misses and the original attack attempt scores.",
    tacticalIntent: "offense",
    receivingDefAlt: "AP",
  },
  "A-Cc": {
    description:
      "The scorer attacks and scores against the opponent's closing counterattack, meaning the defender tries to make the attacker miss by collapsing the distance, dodging in place, hitting and opposing with the blade or a combination of these. Ducking, leaning or contorting the body away while extending is this, not a parry.",
    tacticalIntent: "offense",
    receivingDefAlt: "C",
  },
  "A-Csh": {
    description:
      "The scorer attacks and scores against the opponent's stop hit counterattack, meaning the defender avoids the attack by opening the distance and running away with blade opposition or without.",
    tacticalIntent: "offense",
    receivingDefAlt: "C",
  },
  "A-D": {
    description:
      "The scorer attacks and scores against the opponent's attempt to defend by retreating out of distance.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "A-L": {
    description:
      "The scorer attacks against the opponent's point in line, taking or beating the blade, and scores or when the defender attempts a point in line but it is not given by the referee.",
    tacticalIntent: "offense",
    receivingDefAlt: "AP",
  },
  "A-P": {
    description:
      "The scorer attacks and scores against an attempted parry by the defender. Usually the parry fails to find the blade and the attack lands directly, with no riposte attempt by the fencer who was hit; if the parry clearly found the blade and a riposte was attempted, consider `A,R` instead.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "AN-P": {
    description:
      "The opponent's attack falls short; the scorer executes an answering attack (no parry executed, only defense with distance) at once and scores despite the initial attacker's parry attempt.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "AN-R": {
    description:
      "The opponent's attack falls short; the scorer executes an answering attack (no parry executed, only defense with distance) at once while the attacker attempts a renewal.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "AN,R": {
    description:
      "The opponent's attack falls short; the scorer executes an answering attack (no parry executed, only defense with distance) at once, it is parried by the initial attacker, but they miss the riposte and a renewal of the answering attack scores.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "AP-A": {
    description:
      "Regular attack on preparation, where the initial attacker makes a mistake (loses time, stops, searches), but tries to finish their attack thinking they have priority. Can also be used when the attempted attack on preparation doesn't have right of way but the initial attack misses.",
    tacticalIntent: "defense",
    scoringDefAlt: "AP",
  },
  "AP-P": {
    description:
      "Regular attack on preparation but the initial attacker tries to parry instead of finishing their attack, but the attack on preparation arrives.",
    tacticalIntent: "defense",
    scoringDefAlt: "AP",
  },
  "AP,R": {
    description:
      "Regular attack on preparation but the initial attacker parries instead of finishing the attack, but misses the riposte, and a renewal of the attack on preparation arrives.",
    tacticalIntent: "defense",
    scoringDefAlt: "AP",
  },
  // TODO: migrate existing "AR,R" tags to "A,R,R" and remove this entry.
  "AR,R": {
    description:
      "Legacy spelling of `A,R,R`: attack, missed renewal, hit on the second renewal.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
    legacy: true,
  },
  bl: {
    description: "The fencer goes past the back line and a touch is awarded to the opponent.",
    tacticalIntent: null,
  },
  "Cc-A": {
    description:
      "The opponent attacks and misses; the scorer's closing counterattack arrives: the scorer extends into the attack while standing, closing in, dodging or contorting the body away, with or without blade opposition.",
    tacticalIntent: "defense",
    scoringDefAlt: "C",
  },
  "Cc-AP": {
    description:
      "The opponent attempts an attack on preparation; the scorer (the initial attacker) does not finish their attack and scores with a closing counterattack instead.",
    tacticalIntent: "defense",
    scoringDefAlt: "C",
  },
  "Cc-CT": {
    description:
      "The opponent attacks, the scorer executes a closing counter attack, the attacker attempts to parry the counter attack (counter-time) but the counterattack arrives anyway.",
    tacticalIntent: "defense",
    scoringDefAlt: "C",
  },
  "CCR,R": {
    description:
      "Counter-counter-riposte, remise: the scorer parries an attack, the attacker attempts a counter-riposte, but the defender parries again and ripostes, the attacker also parries, but misses the riposte and the defender scores on their renewal.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "CCR-R": {
    description:
      "Counter-counter-riposte, remise: the scorer parries an attack, the attacker attempts a counter-riposte, but the defender parries again and hits the riposte against a renewal of the attacker's riposte.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "CCR-P": {
    description:
      "Counter-counter-riposte, remise: the scorer parries an attack, the attacker attempts a counter-riposte, but the defender parries again and hits the riposte against another parry attempt by the attacker.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "CR,R": {
    description:
      "The scorer's attack is parried; the scorer parries the riposte and scores with a renewed counter-riposte.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "CR,R,R,R": {
    description:
      "The scorer's attack is parried; the scorer parries the riposte and scores with the third renewal of the counter-riposte.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "CR-P": {
    description:
      "The scorer's attack is parried; the scorer parries the riposte and counter-ripostes; the opponent's parry fails.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "CR-R": {
    description:
      "The scorer's attack is parried; the scorer parries the riposte and counter-ripostes against the opponent's renewal.",
    tacticalIntent: "offense",
    receivingDefAlt: "P",
  },
  "Csh-A": {
    description:
      "The opponent attacks and misses; the scorer's stop hit counterattack (counter attack by opening the distance and running away) arrives.",
    tacticalIntent: "defense",
    scoringDefAlt: "C",
  },
  "CT-R": {
    description:
      "The scorer draws and parries the opponent's counterattack (counter time), then scores with a counter-time riposte against the opponent's renewal of their counterattack.",
    tacticalIntent: "offense",
    receivingDefAlt: "C",
  },
  "CT-P": {
    description:
      "The scorer draws and parries the opponent's counterattack (counter time), then scores with a counter-time riposte; the opponent's parry fails.",
    tacticalIntent: "offense",
    receivingDefAlt: "C",
  },
  "CT,R": {
    description:
      "The scorer draws and parries the opponent's counterattack (counter time); the counter-time riposte is parried and the scorer scores with a renewal.",
    tacticalIntent: "offense",
    receivingDefAlt: "C",
  },
  "C,R": {
    description:
      "The opponent attacks and misses; the scorer counterattacks and also misses, the attacker's renewal misses and the defender scores with a renewal of the counterattack.",
    tacticalIntent: "defense",
    scoringDefAlt: "C",
  },
  "C,R,R": {
    description:
      "Same as C,R with an extra renewal by the defender.",
    tacticalIntent: "defense",
    scoringDefAlt: "C",
  },
  "C,R-CT": {
    description:
      "The opponent attacks; the scorer counterattacks, the attacker parries the counter attack (renewal) but misses the riposte and the defender scores in a renewal of the counter attack.",
    tacticalIntent: "defense",
    scoringDefAlt: "C",
  },
  "L-A": {
    description:
      "The scorer's point in line is established; the opponent attacks into it and the line scores.",
    tacticalIntent: "defense",
    scoringDefAlt: "AP",
  },
  "R,R": {
    description:
      "The scorer parries the opponent's attack but misses; the attacker counter parries but the counter riposte misses and the defender scores with a renewal of the riposte.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "R,R,R": {
    description:
      "The scorer parries the opponent's attack and scores on the second renewal of the riposte.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "R-AP,P": {
    description:
      "The scorer parries the opponent's attack on preparation and ripostes; the opponent tries to parry again and fails.",
    tacticalIntent: "offense",
    receivingDefAlt: "AP",
  },
  "R-AP,R": {
    description:
      "The scorer parries the opponent's attack on preparation and ripostes against the opponent's renewal.",
    tacticalIntent: "offense",
    receivingDefAlt: "AP",
  },
  "R-CT,R": {
    description:
      "The scorer parries the opponent's counter-time riposte and ripostes against the opponent's renewal.",
    tacticalIntent: "defense",
  },
  "R-P": {
    description:
      "The scorer parries the opponent's attack and ripostes; the opponent's counter parry of the riposte fails.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  "R-R": {
    description:
      "The scorer parries the opponent's attack and ripostes against the opponent's renewal.",
    tacticalIntent: "defense",
    scoringDefAlt: "P",
  },
  rc: {
    description:
      "Red card against the tagged side; the opponent is awarded the point.",
    tacticalIntent: null,
  },
  yc: {
    description: "Yellow card against the tagged side; no point is awarded.",
    tacticalIntent: null,
  },
} as const satisfies Record<string, ActionDefinition>;

export type ActionCode = keyof typeof ACTION_DEFINITIONS;

/** All action codes in picker order, legacy ones included, so every stored tag validates. */
export const ACTION_CODES = Object.keys(ACTION_DEFINITIONS) as [
  ActionCode,
  ...ActionCode[],
];

/** The codes offered for new tags: everything that is not legacy. */
export const ACTIVE_ACTION_CODES = ACTION_CODES.filter(
  (code) => !isLegacyActionCode(code),
) as [ActionCode, ...ActionCode[]];

export function isLegacyActionCode(action: ActionCode): boolean {
  return getActionDefinition(action).legacy === true;
}

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
