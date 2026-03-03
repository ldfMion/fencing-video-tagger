import type { ActionCode } from "@/lib/types";

export type TacticalIntent = "offense" | "defense";

/**
 * Maps each ActionCode to its tactical intent.
 * Actions with no tactical intent (cards, blood) map to null.
 */
const TACTICAL_INTENT: Record<ActionCode, TacticalIntent | null> = {
  // Offensive actions (attacks, attack preparations, counter-attacks)
  "A,R": "offense",
  "A,R,R": "offense",
  "A,R-P": "offense",
  "A-A": "offense",
  "A-AP": "offense",
  "A-Cc": "offense",
  "A-Csh": "offense",
  "A-D": "offense",
  "A-L": "offense",
  "A-P": "offense",
  "AN-P": "offense",
  "AN-R": "offense",
  "AP-A": "offense",
  "AP-P": "offense",
  "AP,R": "offense",
  "AR,R": "offense",
  "L-A": "offense",

  // Defensive actions (ripostes, counter-ripostes, counter-attacks, counter-time)
  "Cc-A": "defense",
  "Cc-AP": "defense",
  "Cc-CT": "defense",
  "CCR-R": "defense",
  "CCR-P": "defense",
  "CR,R": "defense",
  "CR-P": "defense",
  "CR-R": "defense",
  "Csh-A": "defense",
  "CT-R": "defense",
  "CT-P": "defense",
  "C,R-CT": "defense",
  "R,R": "defense",
  "R-AP,P": "defense",
  "R-AP,R": "defense",
  "R-CT,R": "defense",
  "R-P": "defense",
  "R-R": "defense",

  // Non-scoring / no tactical intent
  "bl": null,
  "rc": null,
  "yc": null,
};

export function getTacticalIntent(
  action: ActionCode,
): TacticalIntent | null {
  return TACTICAL_INTENT[action];
}
