import type { Tag, Side } from "@/lib/types";
import { getTacticalIntent, type TacticalIntent } from "@/lib/action-classifications";

export interface StatRow<C extends string = string> {
  category: C;
  hitsFor: number;
  hitsAgainst: number;
  differential: number;
  winRate: number | null;
  expectedValue: number | null;
}

export interface MirrorPair<C extends string = string> {
  category: C;
  mirror: C;
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
  const hits = new Map<string, number>(); // key: `${side}:${category}`
  const key = (side: Side, cat: C) => `${side}:${cat}`;

  for (const tag of tags) {
    if (!tag.side || !tag.action) continue;
    // Cards don't count as normal hits
    if (tag.action === "yc" || tag.action === "bl") continue;
    // Red card: point goes to opponent
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

  // Build mirror lookup
  const mirrorOf = new Map<C, C>();
  for (const { category, mirror } of mirrorPairs) {
    mirrorOf.set(category, mirror);
    mirrorOf.set(mirror, category);
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

    return { category: cat, hitsFor, hitsAgainst, differential, winRate, expectedValue };
  });
}

// --- Tactical intent convenience ---

const TACTICAL_MIRROR_PAIRS: MirrorPair<TacticalIntent>[] = [
  { category: "offense", mirror: "defense" },
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
