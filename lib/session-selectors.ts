import type { VideoSession } from "@/lib/types";
import { formatSessionDisplayDate, getSessionDisplayDateValue } from "@/lib/date-utils";

export interface SessionListFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

function normalizeDateOnly(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const dateOnlyMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return dateOnlyMatch?.[1];
}

export function getSessionByFileName(
  sessions: VideoSession[],
  fileName: string,
): VideoSession | undefined {
  return sessions.find((session) => session.fileName === fileName);
}

export function getSessionById(
  sessions: VideoSession[],
  id: string,
): VideoSession | undefined {
  return sessions.find((session) => session.id === id);
}

export function getAllFencerNames(sessions: VideoSession[]): string[] {
  const names = new Set<string>();

  for (const session of sessions) {
    if (session.leftFencer?.trim()) {
      names.add(session.leftFencer.trim());
    }

    if (session.rightFencer?.trim()) {
      names.add(session.rightFencer.trim());
    }
  }

  return Array.from(names).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

export function filterSessionsBySearchAndDate(
  sessions: VideoSession[],
  filters: SessionListFilters,
): VideoSession[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const { dateFrom = "", dateTo = "" } = filters;

  return sessions.filter((session) => {
    if (search) {
      const left = session.leftFencer?.toLowerCase() ?? "";
      const right = session.rightFencer?.toLowerCase() ?? "";
      const fileName = session.fileName?.toLowerCase() ?? "";
      const source = session.externalSource?.toLowerCase() ?? "";

      const matchesSearch =
        left.includes(search) ||
        right.includes(search) ||
        fileName.includes(search) ||
        source.includes(search);

      if (!matchesSearch) {
        return false;
      }
    }

    if (dateFrom) {
      const boutDate = normalizeDateOnly(session.boutDate);
      if (!boutDate || boutDate < dateFrom) {
        return false;
      }
    }

    if (dateTo) {
      const boutDate = normalizeDateOnly(session.boutDate);
      if (!boutDate || boutDate > dateTo) {
        return false;
      }
    }

    return true;
  });
}

export function sortSessionsByLastModified(
  sessions: VideoSession[],
): VideoSession[] {
  return [...sessions].sort((left, right) => right.lastModified - left.lastModified);
}

export function sortSessionsByDisplayDate(
  sessions: VideoSession[],
): VideoSession[] {
  return [...sessions].sort((left, right) => {
    const leftDate = normalizeDateOnly(left.boutDate);
    const rightDate = normalizeDateOnly(right.boutDate);

    if (leftDate && rightDate) {
      return rightDate.localeCompare(leftDate);
    }

    if (leftDate) {
      return -1;
    }

    if (rightDate) {
      return 1;
    }

    return right.lastModified - left.lastModified;
  });
}

export function getBoutDisplayLabel(session: VideoSession): string {
  if (session.leftFencer && session.rightFencer) {
    return `${session.leftFencer} vs ${session.rightFencer}`;
  }

  if (session.leftFencer) {
    return `${session.leftFencer} vs ?`;
  }

  if (session.rightFencer) {
    return `? vs ${session.rightFencer}`;
  }

  return session.fileName ?? "Untitled Bout";
}

export function getBoutDisplayDateLabel(session: VideoSession): string {
  return formatSessionDisplayDate(session);
}

export function getBoutDisplayDateSortValue(
  session: VideoSession,
): string | number {
  return getSessionDisplayDateValue(session);
}

export function hasBoutFencerNames(session: VideoSession): boolean {
  return Boolean(session.leftFencer || session.rightFencer);
}
