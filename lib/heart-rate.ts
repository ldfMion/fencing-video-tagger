import { z } from "zod";

export const HeartRateZoneSchema = z.enum(["zone1", "zone2", "zone3", "zone4", "zone5"]);
export type HeartRateZone = z.infer<typeof HeartRateZoneSchema>;

export const HeartRateSampleSchema = z.object({
  timestamp: z.number().nonnegative(),
  recordedAt: z.number(),
  bpm: z.number().positive(),
  zone: HeartRateZoneSchema,
});

export const HeartRateDataSchema = z.object({
  videoStartedAt: z.number(),
  videoDuration: z.number().positive(),
  timingSource: z.enum(["embedded", "fileModified"]),
  sourceName: z.string().nullable(),
  birthDate: z.string().nullable(),
  maxHeartRate: z.number().positive(),
  extractedAt: z.number(),
  samples: z.array(HeartRateSampleSchema),
});

export type HeartRateSample = z.infer<typeof HeartRateSampleSchema>;
export type HeartRateData = z.infer<typeof HeartRateDataSchema>;

export const HEART_RATE_ZONES = [
  { id: "zone1", label: "Zone 1", minimum: 0, maximum: 0.6, color: "#94a3b8" },
  { id: "zone2", label: "Zone 2", minimum: 0.6, maximum: 0.7, color: "#3b82f6" },
  { id: "zone3", label: "Zone 3", minimum: 0.7, maximum: 0.8, color: "#22c55e" },
  { id: "zone4", label: "Zone 4", minimum: 0.8, maximum: 0.9, color: "#f59e0b" },
  { id: "zone5", label: "Zone 5", minimum: 0.9, maximum: Number.POSITIVE_INFINITY, color: "#ef4444" },
] as const;

export function estimateMaxHeartRate(birthDate: string | null, at: Date): number {
  if (!birthDate) {
    return 190;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) {
    return 190;
  }

  const [, yearText, monthText, dayText] = match;
  const birthYear = Number(yearText);
  const birthMonth = Number(monthText) - 1;
  const birthDay = Number(dayText);
  let age = at.getUTCFullYear() - birthYear;
  if (
    at.getUTCMonth() < birthMonth ||
    (at.getUTCMonth() === birthMonth && at.getUTCDate() < birthDay)
  ) {
    age -= 1;
  }
  return Math.max(120, Math.min(220, 220 - age));
}

export function getHeartRateZone(bpm: number, maxHeartRate: number): HeartRateZone {
  const percentage = bpm / maxHeartRate;
  if (percentage >= 0.9) return "zone5";
  if (percentage >= 0.8) return "zone4";
  if (percentage >= 0.7) return "zone3";
  if (percentage >= 0.6) return "zone2";
  return "zone1";
}

export function getHeartRateZoneColor(zone: HeartRateZone): string {
  return HEART_RATE_ZONES.find((item) => item.id === zone)?.color ?? "#94a3b8";
}
