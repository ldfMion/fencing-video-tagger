import { z } from "zod";

// Action codes for fencing touches (sorted alphabetically)
export const ACTION_CODES = [
  "A,R",
  "A,R-P",
  "A-A",
  "A-AP",
  "A-Cc",
  "A-Csh",
  "A-D",
  "A-L",
  "A-P",
  "AN-P",
  "AN-R",
  "AP-A",
  "AP-P",
  "AP,R",
  "AR,R",
  "bl",
  "Cc-A",
  "Cc-AP",
  "Cc-CT",
  "CCR-R",
  "CR,R",
  "CR-P",
  "CR-R",
  "Csh-A",
  "CT-R",
  "L-A",
  "R,R",
  "R-AP,P", // parrying an attack on prep and riposting with the opponent trying to parry again
  "R-AP,R", // parrying an attack on prep and riposting with the opponent renewing
  "R-CT,R", // parrying a riposte from a counter time with the opponent renewing
  "R-P",
  "R-R",
  "rc",
  "yc",
] as const;

export const ActionCodeSchema = z.enum(ACTION_CODES);
export const SideSchema = z.enum(["L", "R"]);
export const MistakeTypeSchema = z.enum(["tactical", "execution"]);

export type ActionCode = z.infer<typeof ActionCodeSchema>;
export type Side = z.infer<typeof SideSchema>;
export type MistakeType = z.infer<typeof MistakeTypeSchema>;

export const TagSchema = z.object({
  id: z.string(),
  timestamp: z.number(), // seconds into video
  createdAt: z.number(), // unix timestamp
  comment: z.string(), // replaces 'text' field
  // Optional fields for statistics
  side: SideSchema.optional(), // required for statistics, optional for notes
  action: ActionCodeSchema.optional(), // only for statistics
  mistake: MistakeTypeSchema.optional(), // only for statistics
});

export type Tag = z.infer<typeof TagSchema>;

export const VideoSessionSchema = z.object({
  id: z.string(), // serves as bout_id
  fileName: z.string(),
  tags: z.array(TagSchema),
  lastModified: z.number(), // unix timestamp
  // Bout metadata
  leftFencer: z.string().optional(),
  rightFencer: z.string().optional(),
  boutDate: z.string().optional(), // ISO date string
});

export type VideoSession = z.infer<typeof VideoSessionSchema>;

// --- Storage versioning ---

export const CURRENT_SCHEMA_VERSION = 1;

export const StorageEnvelopeSchema = z.object({
  version: z.number(),
  sessions: z.array(VideoSessionSchema),
});

export type StorageEnvelope = z.infer<typeof StorageEnvelopeSchema>;
