import { STRIP_ZONE_LABELS } from "@/lib/tagging";
import type { Tag, Side, StripZone } from "@/lib/types";
import { STRIP_ZONES } from "@/lib/types";
import {
  getTacticalIntent,
  getScoringDefAlternative,
  getReceivingDefAlternative,
  type TacticalIntent,
} from "@/lib/action-classifications";

export interface StatRow<C extends string = string> {
  category: C;
  label: string;
  hitsFor: number;
  hitsAgainst: number;
  total: number;
  differential: number;
  winRate: number | null;
  expectedValue: number | null;
}

export interface MirrorPair<C extends string = string> {
  category: C;
  categoryLabel: string;
  mirror: C;
  mirrorLabel: string;
}

export interface StripZoneStat {
  zone: StripZone;
  label: string;
  leftScoreCount: number;
  rightScoreCount: number;
  total: number;
  net: number;
}

export interface StripZoneStatsSummary {
  zones: StripZoneStat[];
  leftTotal: number;
  rightTotal: number;
  totalScoringActions: number;
  maxLeftCount: number;
  maxRightCount: number;
  maxNetAbs: number;
}

/**
 * Generic stats engine. Given tags, a classification function, mirror pairs,
 * and a perspective side, computes per-category stat rows.
 *
 * Mirror pairing: when computing hits_against for a category, we look at
 * the opponent's hits in the mirror category.
 */
export function computeStats<C extends string>(
  tags: Tag[],
  classify: (tag: Tag) => C | null,
  mirrorPairs: MirrorPair<C>[],
  perspective: Side,
): StatRow<C>[] {
  const opponent: Side = perspective === "L" ? "R" : "L";

  // Count hits per side per category
  const hits = new Map<string, number>();
  const key = (side: Side, cat: C) => `${side}:${cat}`;

  for (const tag of tags) {
    if (!tag.side || !tag.action) continue;
    if (tag.action === "yc" || tag.action === "bl") continue;
    if (tag.action === "rc") {
      const cat = classify(tag);
      if (cat == null) continue;
      const scoringSide = tag.side === "L" ? "R" : "L";
      const k = key(scoringSide, cat);
      hits.set(k, (hits.get(k) ?? 0) + 1);
      continue;
    }

    const cat = classify(tag);
    if (cat == null) continue;
    const k = key(tag.side, cat);
    hits.set(k, (hits.get(k) ?? 0) + 1);
  }

  // Build mirror lookup and label lookup
  const mirrorOf = new Map<C, C>();
  const labelOf = new Map<C, string>();
  for (const { category, categoryLabel, mirror, mirrorLabel } of mirrorPairs) {
    mirrorOf.set(category, mirror);
    mirrorOf.set(mirror, category);
    labelOf.set(category, categoryLabel);
    labelOf.set(mirror, mirrorLabel);
  }

  // Collect all categories from mirror pairs (both sides)
  const categories: C[] = [];
  for (const { category, mirror } of mirrorPairs) {
    if (!categories.includes(category)) categories.push(category);
    if (!categories.includes(mirror)) categories.push(mirror);
  }

  return categories.map((cat) => {
    const hitsFor = hits.get(key(perspective, cat)) ?? 0;
    const mirror = mirrorOf.get(cat) ?? cat;
    const hitsAgainst = hits.get(key(opponent, mirror)) ?? 0;
    const total = hitsFor + hitsAgainst;
    const differential = hitsFor - hitsAgainst;
    const winRate = total > 0 ? hitsFor / total : null;
    const expectedValue = total > 0 ? differential / total : null;

    return {
      category: cat,
      label: labelOf.get(cat) ?? cat,
      hitsFor,
      hitsAgainst,
      total,
      differential,
      winRate,
      expectedValue,
    };
  });
}

// --- Tactical intent ---

const TACTICAL_MIRROR_PAIRS: MirrorPair<TacticalIntent>[] = [
  { category: "offense", categoryLabel: "Offense", mirror: "defense", mirrorLabel: "Defense" },
];

function classifyTactical(tag: Tag): TacticalIntent | null {
  if (!tag.action) return null;
  return getTacticalIntent(tag.action);
}

export function computeTacticalStats(
  tags: Tag[],
  perspective: Side,
): StatRow<TacticalIntent>[] {
  return computeStats(tags, classifyTactical, TACTICAL_MIRROR_PAIRS, perspective);
}

// --- Defensive alternative matchup ---

/**
 * Categories encode "{def_type}_{perspective}":
 * - "P_scoring" = fencer scored using parry (Parry vs Attack)
 * - "P_receiving" = fencer scored against opponent's parry (Attack vs Parry)
 */
type DefMatchup =
  | "C_scoring" | "C_receiving"
  | "P_scoring" | "P_receiving"
  | "AP_scoring" | "AP_receiving";

const DEF_MATCHUP_MIRROR_PAIRS: MirrorPair<DefMatchup>[] = [
  {
    category: "C_scoring",
    categoryLabel: "Counter Attack vs Attack",
    mirror: "C_receiving",
    mirrorLabel: "Attack vs Counter Attack",
  },
  {
    category: "P_scoring",
    categoryLabel: "Parry vs Attack",
    mirror: "P_receiving",
    mirrorLabel: "Attack vs Parry",
  },
  {
    category: "AP_scoring",
    categoryLabel: "Attack on Prep vs Attack",
    mirror: "AP_receiving",
    mirrorLabel: "Attack vs Attack on Prep",
  },
];

function classifyDefMatchup(tag: Tag): DefMatchup | null {
  if (!tag.action) return null;
  const scoringAlt = getScoringDefAlternative(tag.action);
  if (scoringAlt) return `${scoringAlt}_scoring` as DefMatchup;
  const receivingAlt = getReceivingDefAlternative(tag.action);
  if (receivingAlt) return `${receivingAlt}_receiving` as DefMatchup;
  return null;
}

export function computeDefMatchupStats(
  tags: Tag[],
  perspective: Side,
): StatRow<DefMatchup>[] {
  return computeStats(tags, classifyDefMatchup, DEF_MATCHUP_MIRROR_PAIRS, perspective);
}

export function computeStripZoneStats(tags: Tag[]): StripZoneStatsSummary {
  const zoneCounts = new Map<StripZone, { left: number; right: number }>();

  for (const zone of STRIP_ZONES) {
    zoneCounts.set(zone, { left: 0, right: 0 });
  }

  for (const tag of tags) {
    if (!tag.side || !tag.action || !tag.stripZone) continue;
    if (tag.action === "yc" || tag.action === "bl") continue;

    const zone = zoneCounts.get(tag.stripZone);

    if (!zone) continue;

    const scoringSide: Side =
      tag.action === "rc"
        ? tag.side === "L"
          ? "R"
          : "L"
        : tag.side;

    if (scoringSide === "L") {
      zone.left++;
    } else {
      zone.right++;
    }
  }

  const zones = STRIP_ZONES.map((zone) => {
    const counts = zoneCounts.get(zone) ?? { left: 0, right: 0 };
    const total = counts.left + counts.right;
    const net = counts.left - counts.right;

    return {
      zone,
      label: STRIP_ZONE_LABELS[zone],
      leftScoreCount: counts.left,
      rightScoreCount: counts.right,
      total,
      net,
    };
  });

  const leftTotal = zones.reduce((sum, zone) => sum + zone.leftScoreCount, 0);
  const rightTotal = zones.reduce((sum, zone) => sum + zone.rightScoreCount, 0);
  const totalScoringActions = leftTotal + rightTotal;
  const maxLeftCount = zones.reduce((max, zone) => Math.max(max, zone.leftScoreCount), 0);
  const maxRightCount = zones.reduce((max, zone) => Math.max(max, zone.rightScoreCount), 0);
  const maxNetAbs = zones.reduce((max, zone) => Math.max(max, Math.abs(zone.net)), 0);

  return {
    zones,
    leftTotal,
    rightTotal,
    totalScoringActions,
    maxLeftCount,
    maxRightCount,
    maxNetAbs,
  };
}
