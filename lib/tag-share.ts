import { getBoutDisplayLabel } from "@/lib/session-selectors";
import type { Tag, VideoSession } from "@/lib/types";
import { formatTime } from "@/lib/utils";

const MAX_DESCRIPTION_LENGTH = 160;

export function getSharedTagHref(sessionId: string, tagId: string): string {
  return `/bouts/${encodeURIComponent(sessionId)}?tag=${encodeURIComponent(tagId)}`;
}

export function findTagById(
  session: VideoSession | undefined,
  tagId: string | null | undefined,
): Tag | null {
  if (!session || !tagId) {
    return null;
  }

  return session.tags.find((tag) => tag.id === tagId) ?? null;
}

export function getTagShareTitle(session: VideoSession, tag: Tag): string {
  return `${getBoutDisplayLabel(session)} at ${getTagTimestampLabel(tag)}`;
}

export function getTagShareDescription(tag: Tag): string {
  const parts: string[] = [];

  if (tag.comment.trim()) {
    parts.push(tag.comment.trim());
  }

  if (parts.length === 0) {
    parts.push(`Tag at ${getTagTimestampLabel(tag)}`);
  }

  const detailLabels = [tag.side, tag.action, tag.mistake].filter(
    (value): value is NonNullable<typeof value> => value != null,
  );

  if (detailLabels.length > 0) {
    parts.push(detailLabels.join(" "));
  }

  return truncateText(parts.join(" • "), MAX_DESCRIPTION_LENGTH);
}

export function getDefaultBoutDescription(session: VideoSession): string {
  const parts = [session.leftFencer, session.rightFencer].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  if (parts.length === 2) {
    return `Analyze ${parts[0]} vs ${parts[1]} with timestamped video tags.`;
  }

  return "Analyze fencing videos with timestamped tags.";
}

export function getTagTimestampLabel(tag: Tag): string {
  return tag.timestamp != null ? formatTime(tag.timestamp) : "untimed tag";
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
