import {
  MatchClockSchema,
  MatchPeriodSchema,
  type Tag,
  type TaggingOptions,
  type VideoSession,
  StripZoneSchema,
} from "@/lib/types";

export const STRIP_ZONE_FLEX_WEIGHTS = [2, 3, 4, 3, 2] as const;
export const STRIP_ZONE_LABELS: Record<NonNullable<Tag["stripZone"]>, string> = {
  "1": "L 2 Zone",
  "2": "L 3 Zone",
  "3": "Box",
  "4": "R 3 Zone",
  "5": "R 2 Zone",
};

export function normalizeTaggingOptions(
  options: TaggingOptions | null | undefined,
): TaggingOptions | undefined {
  if (!options) {
    return undefined;
  }

  const matchClockEnabled = options.matchClockEnabled === true;
  const stripZoneEnabled = options.stripZoneEnabled === true;

  if (!matchClockEnabled && !stripZoneEnabled) {
    return undefined;
  }

  return {
    matchClockEnabled,
    stripZoneEnabled,
  };
}

export function isMatchClockEnabled(session: Pick<VideoSession, "taggingOptions">): boolean {
  return session.taggingOptions?.matchClockEnabled === true;
}

export function isStripZoneEnabled(session: Pick<VideoSession, "taggingOptions">): boolean {
  return session.taggingOptions?.stripZoneEnabled === true;
}

export function areTaggingOptionsLocked(
  session: Pick<VideoSession, "tags">,
): boolean {
  return session.tags.length > 0;
}

export function normalizeMatchClockInput(value: string): string | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const directParse = MatchClockSchema.safeParse(trimmedValue);

  if (directParse.success) {
    const [minutes, seconds] = trimmedValue.split(":");
    return `${Number(minutes)}:${seconds}`;
  }

  const digitsOnly = trimmedValue.replace(/\D/g, "");

  if (!digitsOnly || digitsOnly.length > 4) {
    return undefined;
  }

  if (digitsOnly.length <= 2) {
    return `0:${digitsOnly.padStart(2, "0")}`;
  }

  const minutes = digitsOnly.slice(0, -2);
  const seconds = digitsOnly.slice(-2);

  if (Number(seconds) >= 60) {
    return undefined;
  }

  return `${Number(minutes)}:${seconds}`;
}

export function formatMatchPeriodLabel(period: Tag["matchPeriod"]): string | null {
  switch (period) {
    case "1":
      return "P1";
    case "2":
      return "P2";
    case "3":
      return "P3";
    case "priority":
      return "Pri";
    default:
      return null;
  }
}

export function formatStripZoneLabel(stripZone: Tag["stripZone"]): string | null {
  return stripZone ? STRIP_ZONE_LABELS[stripZone] : null;
}

export function getDefaultMatchPeriod(): NonNullable<Tag["matchPeriod"]> {
  return "1";
}

export function assertTagMetadataMatchesSession(
  session: Pick<VideoSession, "taggingOptions">,
  tag: Pick<Tag, "matchPeriod" | "matchClock" | "stripZone">,
): void {
  const requiresMatchClock = isMatchClockEnabled(session);
  const requiresStripZone = isStripZoneEnabled(session);

  if (requiresMatchClock) {
    MatchPeriodSchema.parse(tag.matchPeriod);
    MatchClockSchema.parse(tag.matchClock);
  }

  if (requiresStripZone) {
    StripZoneSchema.parse(tag.stripZone);
  }
}

export function assertTaggingOptionsAreMutable(
  previousSession: Pick<VideoSession, "taggingOptions" | "tags">,
  nextOptions: TaggingOptions | undefined,
): void {
  const previousOptions = normalizeTaggingOptions(previousSession.taggingOptions);
  const normalizedNextOptions = normalizeTaggingOptions(nextOptions);

  if (
    areTaggingOptionsLocked(previousSession) &&
    JSON.stringify(previousOptions ?? null) !== JSON.stringify(normalizedNextOptions ?? null)
  ) {
    throw new Error("Tagging options cannot be changed after the first tag is added.");
  }
}
