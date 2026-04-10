import JSZip from "jszip";
import type { VideoSession } from "@/lib/types";
import { formatTime } from "@/lib/utils";

function escapeCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function stringifyValue(value: number | string | undefined): string {
  return value == null ? "" : String(value);
}

function getSingleTableHeaders(): string[] {
  return [
    "bout_id",
    "file_name",
    "video_relative_path",
    "video_mime_type",
    "video_source_type",
    "external_source",
    "left_fencer",
    "right_fencer",
    "bout_date",
    "bout_type",
    "last_modified",
    "touch_id",
    "timestamp",
    "timestamp_formatted",
    "seq",
    "side",
    "action",
    "comment",
    "mistake",
    "created_at",
  ];
}

function createSingleTableRow(
  session: VideoSession,
  tag?: VideoSession["tags"][number],
): string[] {
  return [
    session.id,
    session.fileName ?? "",
    session.videoRelativePath ?? "",
    session.videoMimeType ?? "",
    session.videoSourceType ?? "",
    session.externalSource ?? "",
    session.leftFencer ?? "",
    session.rightFencer ?? "",
    session.boutDate ?? "",
    session.boutType ?? "",
    stringifyValue(session.lastModified),
    tag?.id ?? "",
    stringifyValue(tag?.timestamp),
    tag?.timestamp != null ? formatTime(tag.timestamp) : "",
    stringifyValue(tag?.seq),
    tag?.side ?? "",
    tag?.action ?? "",
    tag?.comment ?? "",
    tag?.mistake ?? "",
    stringifyValue(tag?.createdAt),
  ];
}

export function exportSessionsToJson(sessions: VideoSession[]): string {
  return `${JSON.stringify(sessions, null, 2)}\n`;
}

export function exportSessionToCsv(session: VideoSession): string {
  const rows: string[][] = [getSingleTableHeaders()];

  if (session.tags.length === 0) {
    rows.push(createSingleTableRow(session));
    return toCsv(rows);
  }

  for (const tag of session.tags) {
    rows.push(createSingleTableRow(session, tag));
  }

  return toCsv(rows);
}

export function exportSessionsToNormalizedCsvFiles(
  sessions: VideoSession[],
): Record<string, string> {
  const sessionRows: string[][] = [
    [
      "session_id",
      "file_name",
      "video_relative_path",
      "video_mime_type",
      "video_source_type",
      "left_fencer",
      "right_fencer",
      "bout_date",
      "bout_type",
      "external_source",
      "last_modified",
    ],
  ];
  const tagRows: string[][] = [
    [
      "tag_id",
      "session_id",
      "timestamp",
      "timestamp_formatted",
      "seq",
      "side",
      "action",
      "comment",
      "mistake",
      "created_at",
    ],
  ];

  for (const session of sessions) {
    sessionRows.push([
      session.id,
      session.fileName ?? "",
      session.videoRelativePath ?? "",
      session.videoMimeType ?? "",
      session.videoSourceType ?? "",
      session.leftFencer ?? "",
      session.rightFencer ?? "",
      session.boutDate ?? "",
      session.boutType ?? "",
      session.externalSource ?? "",
      stringifyValue(session.lastModified),
    ]);

    for (const tag of session.tags) {
      tagRows.push([
        tag.id,
        session.id,
        stringifyValue(tag.timestamp),
        tag.timestamp != null ? formatTime(tag.timestamp) : "",
        stringifyValue(tag.seq),
        tag.side ?? "",
        tag.action ?? "",
        tag.comment,
        tag.mistake ?? "",
        stringifyValue(tag.createdAt),
      ]);
    }
  }

  return {
    "sessions.csv": toCsv(sessionRows),
    "tags.csv": toCsv(tagRows),
  };
}

export async function exportSessionsToNormalizedCsvZip(
  sessions: VideoSession[],
): Promise<Blob> {
  const files = exportSessionsToNormalizedCsvFiles(sessions);
  const zip = new JSZip();

  for (const [fileName, contents] of Object.entries(files)) {
    zip.file(fileName, contents);
  }

  return zip.generateAsync({ type: "blob" });
}
