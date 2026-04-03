import type { Tag, VideoSession } from "@/lib/types";
import { formatLongDate, formatMonthYear } from "@/lib/date-utils";
import { computeScore } from "@/lib/score";
import { computeDefMatchupStats, computeTacticalStats } from "@/lib/stats";
import { sortSessionsByDisplayDate } from "@/lib/session-selectors";

export interface FencerFilters {
  dateFrom?: string;
  dateTo?: string;
  selectedOpponents?: string[];
}

export interface FencerBoutRow {
  sessionId: string;
  opponent: string;
  fencerScore: number;
  opponentScore: number;
  hasScore: boolean;
  fencerWins: boolean;
  displayDate: string;
}

export interface FencerCommentFeedItem {
  comment: string;
  side?: Tag["side"];
  action?: Tag["action"];
  boutId: string;
  boutOpponent: string;
  boutDate?: string;
  boutDateLabel?: string;
}

export interface FencerRecordSummary {
  wins: number;
  losses: number;
  winRate: number | null;
  dateRange: { from: string; to: string } | null;
  dateRangeLabel: string | null;
}

export interface FencerPageViewModel {
  sessions: VideoSession[];
  filteredSessions: VideoSession[];
  uniqueOpponents: string[];
  tacticalStats: ReturnType<typeof computeTacticalStats>;
  defMatchupStats: ReturnType<typeof computeDefMatchupStats>;
  hasStatsData: boolean;
  record: FencerRecordSummary;
  boutRows: FencerBoutRow[];
  commentFeedItems: FencerCommentFeedItem[];
}

function matchesFencerName(candidate: string | undefined, fencerName: string): boolean {
  return candidate?.toLowerCase() === fencerName.toLowerCase();
}

export function getSessionsForFencer(
  sessions: VideoSession[],
  fencerName: string,
): VideoSession[] {
  return sessions.filter(
    (session) =>
      matchesFencerName(session.leftFencer, fencerName) ||
      matchesFencerName(session.rightFencer, fencerName),
  );
}

export function getOpponentForFencer(
  session: VideoSession,
  fencerName: string,
): string | undefined {
  const isLeft = matchesFencerName(session.leftFencer, fencerName);
  return isLeft ? session.rightFencer : session.leftFencer;
}

export function getUniqueOpponentsForFencer(
  sessions: VideoSession[],
  fencerName: string,
): string[] {
  const opponents = new Set<string>();

  for (const session of sessions) {
    const opponent = getOpponentForFencer(session, fencerName);

    if (opponent) {
      opponents.add(opponent);
    }
  }

  return [...opponents].sort((left, right) => left.localeCompare(right));
}

export function filterSessionsForFencer(
  sessions: VideoSession[],
  fencerName: string,
  filters: FencerFilters,
): VideoSession[] {
  const { dateFrom = "", dateTo = "", selectedOpponents = [] } = filters;

  return sessions.filter((session) => {
    if (dateFrom && (!session.boutDate || session.boutDate < dateFrom)) {
      return false;
    }

    if (dateTo && (!session.boutDate || session.boutDate > dateTo)) {
      return false;
    }

    if (selectedOpponents.length > 0) {
      const opponent = getOpponentForFencer(session, fencerName);
      if (!opponent || !selectedOpponents.includes(opponent)) {
        return false;
      }
    }

    return true;
  });
}

export function normalizeTagsForFencer(
  sessions: VideoSession[],
  fencerName: string,
): Tag[] {
  const tags: Tag[] = [];

  for (const session of sessions) {
    const isLeft = matchesFencerName(session.leftFencer, fencerName);
    const isRight = matchesFencerName(session.rightFencer, fencerName);

    if (!isLeft && !isRight) {
      continue;
    }

    for (const tag of session.tags) {
      if (isLeft) {
        tags.push(tag);
        continue;
      }

      tags.push({
        ...tag,
        side: tag.side === "L" ? "R" : tag.side === "R" ? "L" : tag.side,
      });
    }
  }

  return tags;
}

export function getFencerRecordSummary(
  sessions: VideoSession[],
  fencerName: string,
): FencerRecordSummary {
  let wins = 0;
  let losses = 0;
  let earliestDate: string | undefined;
  let latestDate: string | undefined;

  for (const session of sessions) {
    const score = computeScore(session.tags);
    const isLeft = matchesFencerName(session.leftFencer, fencerName);
    const fencerScore = isLeft ? score.left : score.right;
    const opponentScore = isLeft ? score.right : score.left;

    if (fencerScore > opponentScore) {
      wins++;
    } else if (opponentScore > fencerScore) {
      losses++;
    }

    if (session.boutDate) {
      if (!earliestDate || session.boutDate < earliestDate) {
        earliestDate = session.boutDate;
      }

      if (!latestDate || session.boutDate > latestDate) {
        latestDate = session.boutDate;
      }
    }
  }

  const dateRange =
    earliestDate && latestDate
      ? {
          from: earliestDate,
          to: latestDate,
        }
      : null;

  return {
    wins,
    losses,
    winRate:
      wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
    dateRange,
    dateRangeLabel:
      dateRange != null
        ? `${formatMonthYear(dateRange.from)} - ${formatMonthYear(dateRange.to)}`
        : null,
  };
}

export function getSortedFencerBoutRows(
  sessions: VideoSession[],
  fencerName: string,
): FencerBoutRow[] {
  return sortSessionsByDisplayDate(sessions).map((session) => {
    const isLeft = matchesFencerName(session.leftFencer, fencerName);
    const opponent = getOpponentForFencer(session, fencerName) ?? "?";
    const score = computeScore(session.tags);
    const fencerScore = isLeft ? score.left : score.right;
    const opponentScore = isLeft ? score.right : score.left;
    const hasScore = session.tags.some((tag) => tag.side && tag.action);

    return {
      sessionId: session.id,
      opponent,
      fencerScore,
      opponentScore,
      hasScore,
      fencerWins: fencerScore > opponentScore,
      displayDate: formatLongDate(session.boutDate ?? session.lastModified),
    };
  });
}

export function getNormalizedFencerCommentFeedItems(
  sessions: VideoSession[],
  fencerName: string,
): FencerCommentFeedItem[] {
  const items: FencerCommentFeedItem[] = [];

  for (const session of sessions) {
    const isLeft = matchesFencerName(session.leftFencer, fencerName);
    const opponent = getOpponentForFencer(session, fencerName) ?? "?";

    for (const tag of session.tags) {
      if (!tag.comment?.trim()) {
        continue;
      }

      let normalizedSide = tag.side;

      if (!isLeft && normalizedSide === "L") {
        normalizedSide = "R";
      } else if (!isLeft && normalizedSide === "R") {
        normalizedSide = "L";
      }

      items.push({
        comment: tag.comment.trim(),
        side: normalizedSide,
        action: tag.action,
        boutId: session.id,
        boutOpponent: opponent,
        boutDate: session.boutDate,
        boutDateLabel: session.boutDate ? formatLongDate(session.boutDate) : undefined,
      });
    }
  }

  return items;
}

export function deriveFencerPageViewModel(
  sessions: VideoSession[],
  fencerName: string,
  filters: FencerFilters,
): FencerPageViewModel {
  const fencerSessions = getSessionsForFencer(sessions, fencerName);
  const filteredSessions = filterSessionsForFencer(
    fencerSessions,
    fencerName,
    filters,
  );
  const normalizedTags = normalizeTagsForFencer(filteredSessions, fencerName);
  const tacticalStats = computeTacticalStats(normalizedTags, "L");
  const defMatchupStats = computeDefMatchupStats(normalizedTags, "L");
  const allRows = [...tacticalStats, ...defMatchupStats];

  return {
    sessions: fencerSessions,
    filteredSessions,
    uniqueOpponents: getUniqueOpponentsForFencer(fencerSessions, fencerName),
    tacticalStats,
    defMatchupStats,
    hasStatsData: allRows.some((row) => row.hitsFor > 0 || row.hitsAgainst > 0),
    record: getFencerRecordSummary(filteredSessions, fencerName),
    boutRows: getSortedFencerBoutRows(filteredSessions, fencerName),
    commentFeedItems: getNormalizedFencerCommentFeedItems(
      filteredSessions,
      fencerName,
    ),
  };
}
