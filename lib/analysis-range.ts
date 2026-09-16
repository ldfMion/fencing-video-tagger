import type { Tag } from "@/lib/types";
import { sortTags } from "@/lib/utils";

/** Inclusive boundaries, anchored to tags so edits cannot silently shift a range. */
export interface AnalysisRange {
  startId: string;
  endId: string;
}

export function filterTagsByAnalysisRange(tags: Tag[], range: AnalysisRange | null): Tag[] {
  if (!range) return tags;
  const orderedTags = sortTags(tags);
  const startIndex = orderedTags.findIndex((tag) => tag.id === range.startId);
  const endIndex = orderedTags.findIndex((tag) => tag.id === range.endId);
  // A deleted boundary invalidates the selection instead of showing misleading stats.
  if (startIndex < 0 || endIndex < 0) return tags;
  return orderedTags.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
}
