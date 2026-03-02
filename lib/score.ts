import type { Tag } from "@/lib/types";

export interface ScoringEvent {
  tag: Tag;
  leftScore: number;
  rightScore: number;
}

export function computeRunningScore(tags: Tag[]): ScoringEvent[] {
  const withAction = tags
    .filter((t) => t.side && t.action)
    .sort((a, b) => a.timestamp - b.timestamp);

  let left = 0;
  let right = 0;

  return withAction.map((tag) => {
    if (tag.action === "yc") {
      // Yellow card: no points awarded
    } else if (tag.action === "rc") {
      // Red card: point awarded to opponent
      if (tag.side === "L") right++;
      else left++;
    } else {
      if (tag.side === "L") left++;
      else right++;
    }
    return { tag, leftScore: left, rightScore: right };
  });
}

export function computeScore(tags: Tag[]): { left: number; right: number } {
  const events = computeRunningScore(tags);
  if (events.length === 0) return { left: 0, right: 0 };
  const last = events[events.length - 1];
  return { left: last.leftScore, right: last.rightScore };
}
