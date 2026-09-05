"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  estimateMaxHeartRate,
  getHeartRateZone,
  HeartRateDataSchema,
  type HeartRateData,
} from "@/lib/heart-rate";
import { extractHeartRateWindow } from "@/lib/server/apple-health";
import { databaseReady, db } from "@/lib/server/db/client";
import {
  heartRateImportsTable,
  heartRateSamplesTable,
} from "@/lib/server/db/schema";
import { getSessionVideoAttachment } from "@/lib/server/session-service";
import { resolveVideoLibraryFile } from "@/lib/server/video-library";
import { readVideoTiming } from "@/lib/server/video-metadata";

const BoutHeartRateInputSchema = z.object({
  sessionId: z.string().min(1),
});

export async function getBoutHeartRate(sessionId: string): Promise<HeartRateData | null> {
  const parsedSessionId = z.string().min(1).parse(sessionId);
  await databaseReady;

  const imported = await db.select().from(heartRateImportsTable)
    .where(eq(heartRateImportsTable.boutId, parsedSessionId)).get();
  if (!imported) {
    return null;
  }

  const samples = await db.select({
    timestamp: heartRateSamplesTable.timestamp,
    recordedAt: heartRateSamplesTable.recordedAt,
    bpm: heartRateSamplesTable.bpm,
    zone: heartRateSamplesTable.zone,
  }).from(heartRateSamplesTable)
    .where(eq(heartRateSamplesTable.boutId, parsedSessionId))
    .orderBy(asc(heartRateSamplesTable.timestamp));

  return HeartRateDataSchema.parse({
    videoStartedAt: imported.videoStartedAt,
    videoDuration: imported.videoDuration,
    timingSource: imported.timingSource,
    sourceName: imported.sourceName,
    birthDate: imported.birthDate,
    maxHeartRate: imported.maxHeartRate,
    extractedAt: imported.extractedAt,
    samples,
  });
}

export async function matchBoutHeartRate(input: {
  sessionId: string;
}): Promise<HeartRateData> {
  const { sessionId } = BoutHeartRateInputSchema.parse(input);
  const attachment = await getSessionVideoAttachment(sessionId);
  if (
    !attachment ||
    attachment.videoSourceType !== "library" ||
    !attachment.videoRelativePath
  ) {
    throw new Error("Attach a library video before matching heart-rate data.");
  }

  const videoFile = await resolveVideoLibraryFile(attachment.videoRelativePath);
  const timing = await readVideoTiming(videoFile.absolutePath, videoFile.modifiedAt);
  const windowEnd = timing.startedAt + timing.duration * 1000;
  const health = await extractHeartRateWindow(timing.startedAt, windowEnd);
  if (health.samples.length === 0) {
    throw new Error(
      `No heart-rate samples were found during ${formatWindow(timing.startedAt, windowEnd)}. Check that this is the original video file and that export.xml includes that date.`,
    );
  }

  const maxHeartRate = estimateMaxHeartRate(
    health.birthDate,
    new Date(timing.startedAt),
  );
  const sourceName = getMostCommonSourceName(health.samples);
  const extractedAt = Date.now();
  const samples = health.samples.map((sample) => ({
    timestamp: Math.max(0, (sample.recordedAt - timing.startedAt) / 1000),
    recordedAt: sample.recordedAt,
    bpm: sample.bpm,
    zone: getHeartRateZone(sample.bpm, maxHeartRate),
  }));

  await databaseReady;
  await db.transaction(async (transaction) => {
    await transaction.delete(heartRateImportsTable).where(
      eq(heartRateImportsTable.boutId, sessionId),
    );
    await transaction.insert(heartRateImportsTable).values({
      boutId: sessionId,
      videoStartedAt: timing.startedAt,
      videoDuration: timing.duration,
      timingSource: timing.timingSource,
      sourceName,
      birthDate: health.birthDate,
      maxHeartRate,
      extractedAt,
    });
    for (let index = 0; index < samples.length; index += 100) {
      await transaction.insert(heartRateSamplesTable).values(
        samples.slice(index, index + 100).map((sample) => ({
          boutId: sessionId,
          ...sample,
        })),
      );
    }
  });

  return HeartRateDataSchema.parse({
    videoStartedAt: timing.startedAt,
    videoDuration: timing.duration,
    timingSource: timing.timingSource,
    sourceName,
    birthDate: health.birthDate,
    maxHeartRate,
    extractedAt,
    samples,
  });
}

function getMostCommonSourceName(
  samples: Array<{ sourceName: string | null }>,
): string | null {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    if (sample.sourceName) {
      counts.set(sample.sourceName, (counts.get(sample.sourceName) ?? 0) + 1);
    }
  }
  return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function formatWindow(start: number, end: number): string {
  const formatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZoneName: "short",
  });
  return `${formatter.format(start)}–${formatter.format(end)}`;
}
