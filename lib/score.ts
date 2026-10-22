import type {
  ActionCode,
  MatchPeriod,
  MatchClock,
  Side,
  Tag,
} from "@/lib/types";
import { MATCH_PERIOD_SEGMENTS, parseMatchClockSeconds, REGULATION_PERIOD_DURATION_SECONDS } from "@/lib/match-clock";
import { sortTags } from "@/lib/utils";

export interface ScoringEvent {
  tag: Tag;
  leftScore: number;
  rightScore: number;
}

export interface ScoreProgressionPoint {
  x: number;
  leftScore: number;
  rightScore: number;
  pointType: "start" | "event";
  eventIndex?: number;
  action?: ActionCode;
  side?: Side;
  matchPeriod?: MatchPeriod;
  matchClock?: MatchClock;
  tag?: Tag;
}

export interface ScoreProgressionBreak {
  x: number;
  label: string;
}

export interface ScoreProgressionChartData {
  points: ScoreProgressionPoint[];
  breaks: ScoreProgressionBreak[];
  xMode: "event" | "time";
  domainMax: number;
}

const PERIOD_BREAKS = [
  { x: REGULATION_PERIOD_DURATION_SECONDS, order: 1 },
  { x: REGULATION_PERIOD_DURATION_SECONDS * 2, order: 2 },
  { x: REGULATION_PERIOD_DURATION_SECONDS * 3, order: 3 },
] as const;

export function computeRunningScore(tags: Tag[]): ScoringEvent[] {
  const withAction = sortTags(tags).filter((t) => t.side && t.action);

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

/** Signed left-minus-right average after each point, excluding non-scoring cards. */
export function computeAverageScoreDifference(tags: Tag[]): number | null {
  const scoringEvents = computeRunningScore(tags).filter(
    ({ tag }) => tag.action !== "yc",
  );

  if (scoringEvents.length === 0) return null;

  const totalDifference = scoringEvents.reduce(
    (total, event) => total + event.leftScore - event.rightScore,
    0,
  );
  return totalDifference / scoringEvents.length;
}

export function computeScore(tags: Tag[]): { left: number; right: number } {
  const events = computeRunningScore(tags);
  if (events.length === 0) return { left: 0, right: 0 };
  const last = events[events.length - 1];
  return { left: last.leftScore, right: last.rightScore };
}

export function buildScoreProgressionChartData(
  tags: Tag[],
): ScoreProgressionChartData {
  const events = computeRunningScore(tags);

  if (events.length === 0) {
    return {
      points: [
        {
          x: 0,
          leftScore: 0,
          rightScore: 0,
          pointType: "start",
        },
      ],
      breaks: [],
      xMode: "event",
      domainMax: 1,
    };
  }

  const timedAxis = getTimedAxis(events);

  if (!timedAxis) {
    return {
      points: [
        {
          x: 0,
          leftScore: 0,
          rightScore: 0,
          pointType: "start",
        },
        ...events.map((event, index) => ({
          x: index + 1,
          leftScore: event.leftScore,
          rightScore: event.rightScore,
          pointType: "event" as const,
          eventIndex: index + 1,
          action: event.tag.action,
          side: event.tag.side,
          matchPeriod: event.tag.matchPeriod,
          matchClock: event.tag.matchClock,
          tag: event.tag,
        })),
      ],
      breaks: getEventAxisBreaks(events),
      xMode: "event",
      domainMax: Math.max(1, events.length),
    };
  }

  const points: ScoreProgressionPoint[] = [
    {
      x: 0,
      leftScore: 0,
      rightScore: 0,
      pointType: "start",
    },
    ...events.map((event, index) => ({
      x: timedAxis.coordinates[index],
      leftScore: event.leftScore,
      rightScore: event.rightScore,
      pointType: "event" as const,
      eventIndex: index + 1,
      action: event.tag.action,
      side: event.tag.side,
      matchPeriod: event.tag.matchPeriod,
      matchClock: event.tag.matchClock,
      tag: event.tag,
    })),
  ];

  return {
    points,
    breaks: timedAxis.breaks,
    xMode: "time",
    domainMax: timedAxis.domainMax,
  };
}

function getEventAxisBreaks(
  events: ScoringEvent[],
): ScoreProgressionBreak[] {
  return events.flatMap((event, index) => {
    if (index === 0) {
      return [];
    }

    const previousPeriod = events[index - 1].tag.matchPeriod;
    const currentPeriod = event.tag.matchPeriod;

    if (!previousPeriod || !currentPeriod || previousPeriod === currentPeriod) {
      return [];
    }

    return [{ x: index + 0.5, label: "Break" }];
  });
}

function getTimedAxis(
  events: ScoringEvent[],
): { coordinates: number[]; breaks: ScoreProgressionBreak[]; domainMax: number } | null {
  const coordinates: number[] = [];
  let highestPeriodOrder = 0;
  let previousX = -1;

  for (const event of events) {
    if (!event.tag.matchPeriod || !event.tag.matchClock) {
      return null;
    }

    const segment = MATCH_PERIOD_SEGMENTS[event.tag.matchPeriod];
    const remainingSeconds = parseMatchClockSeconds(event.tag.matchClock);

    if (remainingSeconds == null || remainingSeconds > segment.duration) {
      return null;
    }

    const x = segment.start + (segment.duration - remainingSeconds);

    if (x < previousX) {
      return null;
    }

    previousX = x;
    highestPeriodOrder = Math.max(highestPeriodOrder, segment.order);
    coordinates.push(x);
  }

  return {
    coordinates,
    breaks: PERIOD_BREAKS
      .filter((periodBreak) => periodBreak.order <= highestPeriodOrder)
      .map((periodBreak) => ({
        x: periodBreak.x,
        label: "Break",
      })),
    domainMax: Math.max(1, coordinates[coordinates.length - 1]),
  };
}
