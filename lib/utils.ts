import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Tag } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function sortTags(tags: Tag[]): Tag[] {
  return [...tags].sort((a, b) => {
    // Tags with timestamps come first
    const aHasTime = a.timestamp != null;
    const bHasTime = b.timestamp != null;

    if (aHasTime && !bHasTime) return -1;
    if (!aHasTime && bHasTime) return 1;

    // Both have timestamps: sort by timestamp, then seq
    if (aHasTime && bHasTime) {
      const timeCompare = a.timestamp! - b.timestamp!;
      if (timeCompare !== 0) return timeCompare;
      const aSeq = a.seq ?? 0;
      const bSeq = b.seq ?? 0;
      return aSeq - bSeq;
    }

    // Neither has timestamp: sort by seq, then createdAt
    const aSeq = a.seq ?? 0;
    const bSeq = b.seq ?? 0;
    if (aSeq !== bSeq) return aSeq - bSeq;
    return a.createdAt - b.createdAt;
  });
}
