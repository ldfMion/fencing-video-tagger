import type { VideoSession, Tag } from "@/lib/types";

/**
 * Returns sessions where the fencer appears as leftFencer or rightFencer.
 * Comparison is case-insensitive.
 */
export function getSessionsForFencer(
  sessions: VideoSession[],
  fencerName: string,
): VideoSession[] {
  const name = fencerName.toLowerCase();
  return sessions.filter(
    (s) =>
      s.leftFencer?.toLowerCase() === name ||
      s.rightFencer?.toLowerCase() === name,
  );
}

/**
 * Collects tags from all sessions where the fencer appears, flipping the side
 * on tags from bouts where the fencer was on the right. This normalizes all
 * tags so the fencer is always represented as side "L", letting us pass the
 * result directly to computeTacticalStats / computeDefMatchupStats with
 * perspective = "L".
 */
export function normalizeTagsForFencer(
  sessions: VideoSession[],
  fencerName: string,
): Tag[] {
  const name = fencerName.toLowerCase();
  const tags: Tag[] = [];

  for (const session of sessions) {
    const isLeft = session.leftFencer?.toLowerCase() === name;
    const isRight = session.rightFencer?.toLowerCase() === name;
    if (!isLeft && !isRight) continue;

    for (const tag of session.tags) {
      if (isLeft) {
        // Fencer is already on the left — keep tag as-is
        tags.push(tag);
      } else {
        // Fencer is on the right — flip the side
        tags.push({
          ...tag,
          side: tag.side === "L" ? "R" : tag.side === "R" ? "L" : tag.side,
        });
      }
    }
  }

  return tags;
}
