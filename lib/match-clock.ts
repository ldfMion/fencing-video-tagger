import { MatchClockSchema, type MatchPeriod, type Tag } from "@/lib/types";
import { sortTags } from "@/lib/utils";

export const REGULATION_PERIOD_DURATION_SECONDS = 3 * 60;
const PRIORITY_PERIOD_DURATION_SECONDS = 60;

export const MATCH_PERIOD_SEGMENTS: Record<
  MatchPeriod,
  { start: number; duration: number; order: number; label: string }
> = {
  "1": { start: 0, duration: REGULATION_PERIOD_DURATION_SECONDS, order: 0, label: "P1" },
  "2": { start: REGULATION_PERIOD_DURATION_SECONDS, duration: REGULATION_PERIOD_DURATION_SECONDS, order: 1, label: "P2" },
  "3": { start: REGULATION_PERIOD_DURATION_SECONDS * 2, duration: REGULATION_PERIOD_DURATION_SECONDS, order: 2, label: "P3" },
  priority: { start: REGULATION_PERIOD_DURATION_SECONDS * 3, duration: PRIORITY_PERIOD_DURATION_SECONDS, order: 3, label: "Pri" },
};

export function parseMatchClockSeconds(matchClock: string): number | null {
  if (!MatchClockSchema.safeParse(matchClock).success) return null;
  const [minutes, seconds] = matchClock.split(":").map(Number);
  return minutes * 60 + seconds;
}

function getMatchTime(tag: Tag) {
  if (!tag.matchPeriod || !tag.matchClock) return null;
  const segment = MATCH_PERIOD_SEGMENTS[tag.matchPeriod];
  const remainingSeconds = parseMatchClockSeconds(tag.matchClock);
  if (remainingSeconds === null || remainingSeconds > segment.duration) return null;
  return { ...segment, remainingSeconds };
}

function compareMatchTimes(left: NonNullable<ReturnType<typeof getMatchTime>>, right: NonNullable<ReturnType<typeof getMatchTime>>) {
  return left.order - right.order || right.remainingSeconds - left.remainingSeconds;
}

/** Checks only the candidate and its neighbors, so existing mistakes can be repaired one at a time. */
export function getMatchTimeValidationError(tags: Tag[], candidate: Tag): string | null {
  if (!candidate.matchPeriod && !candidate.matchClock) return null;
  if (!candidate.matchPeriod || !candidate.matchClock) return "Choose a period and enter a match clock.";

  const segment = MATCH_PERIOD_SEGMENTS[candidate.matchPeriod];
  const candidateTime = getMatchTime(candidate);
  if (!candidateTime) {
    return `Enter a clock between 0:00 and ${segment.duration / 60}:00 for ${segment.label}.`;
  }

  const orderedTags = sortTags([...tags.filter((tag) => tag.id !== candidate.id), candidate]);
  const candidateIndex = orderedTags.findIndex((tag) => tag.id === candidate.id);
  const previousTag = orderedTags.slice(0, candidateIndex).findLast((tag) => getMatchTime(tag) !== null);
  const nextTag = orderedTags.slice(candidateIndex + 1).find((tag) => getMatchTime(tag) !== null);

  if (previousTag) {
    const previousTime = getMatchTime(previousTag)!;
    if (compareMatchTimes(candidateTime, previousTime) < 0) {
      return `Must be at or after the previous tag (${previousTime.label} ${previousTag.matchClock}).`;
    }
  }
  if (nextTag) {
    const nextTime = getMatchTime(nextTag)!;
    if (compareMatchTimes(candidateTime, nextTime) > 0) {
      return `Must be at or before the next tag (${nextTime.label} ${nextTag.matchClock}).`;
    }
  }
  return null;
}
