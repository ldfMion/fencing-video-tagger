import type { VideoSession } from "@/lib/types";
import { formatTime } from "@/lib/utils";

function escapeCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function exportSessionsToCsv(sessions: VideoSession[]): string {
  const headers = [
    "bout_id",
    "file_name",
    "external_source",
    "left_fencer",
    "right_fencer",
    "bout_date",
    "touch_id",
    "timestamp",
    "timestamp_formatted",
    "side",
    "action",
    "comment",
    "mistake",
    "created_at",
  ];

  const rows: string[][] = [headers];

  for (const session of sessions) {
    for (const tag of session.tags) {
      rows.push([
        escapeCsvValue(session.id),
        escapeCsvValue(session.fileName ?? ""),
        escapeCsvValue(session.externalSource ?? ""),
        escapeCsvValue(session.leftFencer ?? ""),
        escapeCsvValue(session.rightFencer ?? ""),
        escapeCsvValue(session.boutDate ?? ""),
        escapeCsvValue(tag.id),
        escapeCsvValue(tag.timestamp != null ? String(tag.timestamp) : ""),
        escapeCsvValue(tag.timestamp != null ? formatTime(tag.timestamp) : ""),
        escapeCsvValue(tag.side ?? ""),
        escapeCsvValue(tag.action ?? ""),
        escapeCsvValue(tag.comment),
        escapeCsvValue(tag.mistake ?? ""),
        escapeCsvValue(tag.createdAt ? new Date(tag.createdAt).toISOString() : ""),
      ]);
    }
  }

  return rows.map((row) => row.join(",")).join("\n");
}
