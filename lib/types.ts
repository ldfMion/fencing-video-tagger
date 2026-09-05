import { z } from "zod";

// Action codes for fencing touches (sorted alphabetically)
export const ACTION_CODES = [
  "A,R",
  "A,R,R",
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
  "AN,R",
  "AP-A",
  "AP-P",
  "AP,R",
  "AR,R",
  "bl",
  "Cc-A",
  "Cc-AP",
  "Cc-CT",
  "CCR-R",
  "CCR-P",
  "CR,R",
  "CR,R,R,R",
  "CR-P",
  "CR-R",
  "Csh-A",
  "CT-R",
  "CT-P",
  "CT,R",
  "C,R",
  "C,R,R",
  "C,R-CT",
  "L-A",
  "R,R",
  "R,R,R",
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
export const VideoSourceTypeSchema = z.enum(["library", "temporary"]);
export const MATCH_PERIODS = ["1", "2", "3", "priority"] as const;
export const STRIP_ZONES = ["1", "2", "3", "4", "5"] as const;
export const MATCH_CLOCK_PATTERN = /^(\d{1,2}):([0-5]\d)$/;
export const MatchPeriodSchema = z.enum(MATCH_PERIODS);
export const MatchClockSchema = z.string().regex(MATCH_CLOCK_PATTERN);
export const StripZoneSchema = z.enum(STRIP_ZONES);
export const TaggingOptionsSchema = z.object({
  matchClockEnabled: z.boolean().optional(),
  stripZoneEnabled: z.boolean().optional(),
});

export type ActionCode = z.infer<typeof ActionCodeSchema>;
export type Side = z.infer<typeof SideSchema>;
export type MistakeType = z.infer<typeof MistakeTypeSchema>;
export type VideoSourceType = z.infer<typeof VideoSourceTypeSchema>;
export type MatchPeriod = z.infer<typeof MatchPeriodSchema>;
export type MatchClock = z.infer<typeof MatchClockSchema>;
export type StripZone = z.infer<typeof StripZoneSchema>;
export type TaggingOptions = z.infer<typeof TaggingOptionsSchema>;

export const TagSchema = z.object({
  id: z.string(),
  timestamp: z.number().optional(), // seconds into video (optional for videoless tags)
  seq: z.number().optional(), // insertion order for videoless tags or tiebreaker for video tags
  createdAt: z.number(), // unix timestamp
  comment: z.string(), // replaces 'text' field
  // Optional fields for statistics
  side: SideSchema.optional(), // required for statistics, optional for notes
  action: ActionCodeSchema.optional(), // only for statistics
  mistake: MistakeTypeSchema.optional(), // only for statistics
  matchPeriod: MatchPeriodSchema.optional(),
  matchClock: MatchClockSchema.optional(),
  stripZone: StripZoneSchema.optional(),
});

export type Tag = z.infer<typeof TagSchema>;
export const TagContentSchema = TagSchema.omit({
  id: true,
  seq: true,
  createdAt: true,
});
export type TagContent = z.infer<typeof TagContentSchema>;

// Form submissions must name every editable field, including optional ones.
// This makes adding a field to TagSchema a compile-time failure at submission
// sites until both create and edit flows explicitly account for it.
export interface CompleteTagContent {
  timestamp: TagContent["timestamp"];
  comment: TagContent["comment"];
  side: TagContent["side"];
  action: TagContent["action"];
  mistake: TagContent["mistake"];
  matchPeriod: TagContent["matchPeriod"];
  matchClock: TagContent["matchClock"];
  stripZone: TagContent["stripZone"];
}

type AssertNoUnaccountedTagFields<Fields extends never> = Fields;
type UnaccountedTagFields = AssertNoUnaccountedTagFields<
  Exclude<keyof TagContent, keyof CompleteTagContent>
>;
type UnknownCompleteTagFields = AssertNoUnaccountedTagFields<
  Exclude<keyof CompleteTagContent, keyof TagContent>
>;

// Keep the assertions part of the emitted type graph without runtime output.
export type TagContentFieldCoverage =
  | UnaccountedTagFields
  | UnknownCompleteTagFields;

export const VideoSessionSchema = z.object({
  id: z.string(), // serves as bout_id
  fileName: z.string().optional(), // optional for videoless bouts
  videoRelativePath: z.string().optional(),
  videoMimeType: z.string().optional(),
  videoSourceType: VideoSourceTypeSchema.optional(),
  tags: z.array(TagSchema),
  lastModified: z.number(), // unix timestamp
  // Bout metadata
  leftFencer: z.string().optional(),
  rightFencer: z.string().optional(),
  boutDate: z.string().optional(), // ISO date string
  boutType: z.string().optional(), // e.g. "pool", "DE", "team"
  externalSource: z.string().optional(), // URL or reference note
  taggingOptions: TaggingOptionsSchema.optional(),
});

export type VideoSession = z.infer<typeof VideoSessionSchema>;
