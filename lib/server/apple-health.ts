import "server-only";

import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

const HEART_RATE_TYPE = "HKQuantityTypeIdentifierHeartRate";

export interface ExtractedHeartRateSample {
  bpm: number;
  recordedAt: number;
  sourceName: string | null;
}

export interface AppleHealthWindow {
  birthDate: string | null;
  samples: ExtractedHeartRateSample[];
}

export function resolveAppleHealthExportPath(): string {
  const configuredPath = process.env.APPLE_HEALTH_EXPORT_FILE?.trim();
  return configuredPath
    ? path.resolve(configuredPath)
    : path.join(process.cwd(), "export.xml");
}

export async function extractHeartRateWindow(
  windowStart: number,
  windowEnd: number,
  exportPath = resolveAppleHealthExportPath(),
): Promise<AppleHealthWindow> {
  try {
    await access(exportPath);
  } catch {
    throw new Error(
      `Apple Health export not found at ${exportPath}. Place export.xml in the project root or set APPLE_HEALTH_EXPORT_FILE.`,
    );
  }

  let birthDate: string | null = null;
  const samplesByTime = new Map<number, ExtractedHeartRateSample>();
  const stream = createReadStream(exportPath, {
    encoding: "utf8",
    highWaterMark: 1024 * 1024,
  });
  const recordMarker = `type="${HEART_RATE_TYPE}"`;
  let buffer = "";

  for await (const chunk of stream) {
    buffer += chunk;

    if (birthDate == null) {
      const meStart = buffer.indexOf("<Me ");
      const meEnd = meStart >= 0 ? buffer.indexOf(">", meStart) : -1;
      if (meStart >= 0 && meEnd >= 0) {
        birthDate = getXmlAttribute(
          buffer.slice(meStart, meEnd + 1),
          "HKCharacteristicTypeIdentifierDateOfBirth",
        );
      }
    }

    while (true) {
      const markerIndex = buffer.indexOf(recordMarker);
      if (markerIndex < 0) {
        // Retain enough overlap for a marker or record split across chunks.
        buffer = buffer.slice(-4096);
        break;
      }
      const recordStart = buffer.lastIndexOf("<Record", markerIndex);
      const recordEnd = buffer.indexOf(">", markerIndex);
      if (recordStart < 0) {
        buffer = buffer.slice(markerIndex);
        break;
      }
      if (recordEnd < 0) {
        buffer = buffer.slice(recordStart);
        break;
      }

      collectHeartRateSample(
        buffer.slice(recordStart, recordEnd + 1),
        windowStart,
        windowEnd,
        samplesByTime,
      );
      buffer = buffer.slice(recordEnd + 1);
    }
  }

  return {
    birthDate,
    samples: [...samplesByTime.values()].sort(
      (left, right) => left.recordedAt - right.recordedAt,
    ),
  };
}

function collectHeartRateSample(
  record: string,
  windowStart: number,
  windowEnd: number,
  samplesByTime: Map<number, ExtractedHeartRateSample>,
): void {
  const dateText = getXmlAttribute(record, "startDate");
  const valueText = getXmlAttribute(record, "value");
  if (!dateText || !valueText) return;

  const recordedAt = parseAppleHealthDate(dateText);
  const bpm = Number(valueText);
  if (
    recordedAt == null ||
    recordedAt < windowStart ||
    recordedAt > windowEnd ||
    !Number.isFinite(bpm) ||
    bpm <= 0
  ) {
    return;
  }

  // Apple exports can include duplicate samples from nested workouts.
  samplesByTime.set(recordedAt, {
    bpm,
    recordedAt,
    sourceName: getXmlAttribute(record, "sourceName"),
  });
}

export function parseAppleHealthDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})$/.exec(
    value,
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
  const isoValue = `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetHour}:${offsetMinute}`;
  const timestamp = Date.parse(isoValue);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getXmlAttribute(line: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(line);
  return match ? decodeXmlEntities(match[1]) : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
