import { z } from "zod";
import { ACTIVE_ACTION_CODES, type ActionCode } from "@/lib/action-classifications";

/**
 * What the agent must work out about a touch before it names the action code. The facts are
 * about the exchange that led to the scoring hit, from the scorer's point of view.
 */
export const PhraseFactsSchema = z.object({
  attacker: z.enum(["scorer", "opponent", "both"]).describe(
    "Who first moved forward to attack with the arm extending. `both` when the two attacks started together.",
  ),
  defence: z.enum([
    "none",
    "parry-found-blade",
    "parry-missed",
    "closing-counterattack",
    "stop-hit",
    "point-in-line",
    "retreat",
    "attack-on-preparation",
  ]).describe(
    "What the fencer being attacked did before the first hit. `parry-found-blade`: the parry visibly met and deflected the blade. `parry-missed`: a parry motion that did not find the blade. `closing-counterattack`: extended into the attack while standing, closing in, dodging or opposing. `stop-hit`: extended while opening the distance or running away. `retreat`: only stepped back so the attack fell short. `attack-on-preparation`: attacked into the opponent's preparation before their attack started.",
  ),
  dodged: z.boolean().describe(
    "The fencer being attacked ducked, leaned, twisted or otherwise contorted the body to avoid being hit. A strong counterattack cue, even if the blade also moved.",
  ),
  riposteAttempted: z.boolean().describe(
    "After a parry, the parrying fencer tried to riposte (hit or miss).",
  ),
  scoringHitWasRenewal: z.boolean().describe(
    "The scoring hit came after an earlier attempt by the scorer had been parried or missed.",
  ),
  exchangesBeforeHit: z.number().int().min(0).max(6).describe(
    "Parry-riposte exchanges between the first attack and the scoring hit. 0 for a direct hit, 1 for parry-riposte, 2 when the riposte was itself parried and answered.",
  ),
  lights: z.enum(["scorer-only", "both", "scorer-and-off-target"]).optional().describe(
    "Which lamps came on.",
  ),
});

export type PhraseFacts = z.infer<typeof PhraseFactsSchema>;

/** One compact line for the event log. */
export function formatPhraseFacts(facts: PhraseFacts): string {
  return [
    `attacker=${facts.attacker}`,
    `defence=${facts.defence}`,
    `dodged=${facts.dodged ? "yes" : "no"}`,
    `riposte=${facts.riposteAttempted ? "attempted" : "none"}`,
    `renewal=${facts.scoringHitWasRenewal ? "yes" : "no"}`,
    `exchanges=${facts.exchangesBeforeHit}`,
    ...(facts.lights ? [`lights=${facts.lights}`] : []),
  ].join("; ");
}

/**
 * The action codes consistent with the facts; empty when the rules have nothing to say.
 * These are the common families only: the agent may still pick something else deliberately.
 */
export function suggestActionCodes(facts: PhraseFacts): ActionCode[] {
  const defenderCounterattacked = facts.dodged && facts.defence !== "point-in-line" && facts.defence !== "retreat";
  const defence = defenderCounterattacked && (facts.defence === "none" || facts.defence.startsWith("parry"))
    ? "closing-counterattack"
    : facts.defence;

  let codes: string[] = [];
  if (facts.attacker === "both") {
    codes = ["A-A"];
  } else if (facts.attacker === "scorer") {
    switch (defence) {
      case "none":
        codes = ["A-A"];
        break;
      case "retreat":
        codes = ["A-D"];
        break;
      case "closing-counterattack":
        codes = ["A-Cc"];
        break;
      case "stop-hit":
        codes = ["A-Csh"];
        break;
      case "point-in-line":
        codes = ["A-L"];
        break;
      case "attack-on-preparation":
        codes = ["A-AP"];
        break;
      case "parry-found-blade":
      case "parry-missed":
        if (facts.exchangesBeforeHit >= 1 && facts.riposteAttempted) {
          codes = facts.scoringHitWasRenewal ? ["CR,R", "CR,R,R,R"] : ["CR-P", "CR-R"];
        } else if (facts.scoringHitWasRenewal) {
          codes = ["A,R", "A,R-P", "A,R,R"];
        } else {
          codes = ["A-P"];
        }
        break;
    }
  } else {
    switch (defence) {
      case "parry-found-blade":
      case "parry-missed":
        if (facts.exchangesBeforeHit >= 2) {
          codes = facts.scoringHitWasRenewal ? ["CCR,R"] : ["CCR-P", "CCR-R"];
        } else {
          codes = facts.scoringHitWasRenewal ? ["R,R", "R,R,R"] : ["R-P", "R-R", "R-AP,P", "R-AP,R"];
        }
        break;
      case "closing-counterattack":
        codes = facts.scoringHitWasRenewal ? ["C,R", "C,R,R", "C,R-CT"] : ["Cc-A", "Cc-AP", "Cc-CT"];
        break;
      case "stop-hit":
        codes = facts.scoringHitWasRenewal ? ["C,R", "C,R,R"] : ["Csh-A"];
        break;
      case "point-in-line":
        codes = ["L-A"];
        break;
      case "retreat":
        codes = facts.scoringHitWasRenewal ? ["AN,R"] : ["AN-P", "AN-R"];
        break;
      case "attack-on-preparation":
        codes = facts.scoringHitWasRenewal ? ["AP,R"] : ["AP-A", "AP-P"];
        break;
      case "none":
        codes = [];
        break;
    }
  }
  return codes.filter((code): code is ActionCode => (ACTIVE_ACTION_CODES as readonly string[]).includes(code));
}

/** A note for the agent when its code disagrees with its own facts, or null when they fit. */
export function checkPhraseAgainstCode(facts: PhraseFacts, code: ActionCode): string | null {
  const notes: string[] = [];
  const suggested = suggestActionCodes(facts);
  if (suggested.length > 0 && !suggested.includes(code)) {
    notes.push(`your phrase facts point to ${suggested.map((c) => `\`${c}\``).join(" or ")}, not \`${code}\``);
  }
  if (facts.dodged && opponentParried(code)) {
    notes.push("dodging or contorting the body to avoid the hit is a counterattack cue, not a parry");
  }
  if (code === "A-P" && facts.defence === "parry-found-blade" && facts.riposteAttempted) {
    notes.push("a parry that found the blade followed by a missed riposte is usually `A,R`, unless the attack landed before any renewal");
  }
  if (notes.length === 0) return null;
  return `Check the action: ${notes.join("; ")}. Keep it only if you are sure, otherwise call update_tag.`;
}

/** Whether the code says the opponent's answer to the scorer's attack was a parry. */
function opponentParried(code: ActionCode): boolean {
  const opponentPart = code.split("-")[1];
  return opponentPart !== undefined && opponentPart.split(",").includes("P");
}
