import type { Tag } from "@/lib/types";

export function computeScore(tags: Tag[]): { left: number; right: number } {
  let left = 0;
  let right = 0;

  const withAction = tags
    .filter((t) => t.side && t.action)
    .sort((a, b) => a.timestamp - b.timestamp);

  for (const tag of withAction) {
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
  }

  return { left, right };
}
