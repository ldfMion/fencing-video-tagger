import type { VideoSession } from "@/lib/types";

export function toIsoDatePart(value: number | string | Date): string {
  return new Date(value).toISOString().split("T")[0];
}

export function getTodayIsoDate(): string {
  return toIsoDatePart(new Date());
}

export function deriveBoutDateFromFileMetadata(
  fileLastModified?: number,
): string | undefined {
  return fileLastModified != null ? toIsoDatePart(fileLastModified) : undefined;
}

export function formatLongDate(value: number | string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthYear(value: number | string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function getSessionDisplayDateValue(
  session: Pick<VideoSession, "boutDate" | "lastModified">,
): string | number {
  return session.boutDate ?? session.lastModified;
}

export function formatSessionDisplayDate(
  session: Pick<VideoSession, "boutDate" | "lastModified">,
): string {
  return formatLongDate(getSessionDisplayDateValue(session));
}
