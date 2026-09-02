import { z } from "zod";
import {
  ActionCodeSchema,
  MatchPeriodSchema,
  MistakeTypeSchema,
  StripZoneSchema,
} from "@/lib/types";

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MultiValueSchema = <T extends z.ZodType>(schema: T) =>
  z.array(schema).max(100).default([]);

export const CommentSearchInputSchema = z.object({
  query: z.string().trim().max(2_000).default(""),
  filters: z.object({
    fencers: MultiValueSchema(z.string().trim().min(1)),
    actions: MultiValueSchema(ActionCodeSchema),
    mistakes: MultiValueSchema(MistakeTypeSchema),
    periods: MultiValueSchema(MatchPeriodSchema),
    stripZones: MultiValueSchema(StripZoneSchema),
    dateFrom: IsoDateSchema.optional(),
    dateTo: IsoDateSchema.optional(),
    includeWithoutReplay: z.boolean().default(false),
  }).default({
    fencers: [],
    actions: [],
    mistakes: [],
    periods: [],
    stripZones: [],
    includeWithoutReplay: false,
  }),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type CommentSearchInput = z.infer<typeof CommentSearchInputSchema>;

export interface CommentSearchResult {
  commentId: number;
  comment: string;
  commentHash: string;
  tagId: string;
  boutId: string;
  timestamp?: number;
  action?: z.infer<typeof ActionCodeSchema>;
  mistake?: z.infer<typeof MistakeTypeSchema>;
  period?: z.infer<typeof MatchPeriodSchema>;
  matchClock?: string;
  stripZone?: z.infer<typeof StripZoneSchema>;
  taggedFencer?: string;
  opponent?: string;
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string;
  boutDateIso?: string;
  videoRelativePath?: string;
  replayAvailable: boolean;
  cosineDistance?: number;
  cosineSimilarity?: number;
}

export interface CommentSearchResponse {
  results: CommentSearchResult[];
  embeddedComments: number;
  hasMore: boolean;
}
