import { z } from "zod";
import {
  ActionCodeSchema,
  MatchPeriodSchema,
  MistakeTypeSchema,
  SideSchema,
  StripZoneSchema,
} from "@/lib/types";

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CommentSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  filters: z.object({
    fencer: z.string().trim().min(1).optional(),
    side: SideSchema.optional(),
    action: ActionCodeSchema.optional(),
    mistake: MistakeTypeSchema.optional(),
    period: MatchPeriodSchema.optional(),
    stripZone: StripZoneSchema.optional(),
    dateFrom: IsoDateSchema.optional(),
    dateTo: IsoDateSchema.optional(),
  }).default({}),
  limit: z.number().int().min(1).max(100).default(20),
});

export type CommentSearchInput = z.infer<typeof CommentSearchInputSchema>;

export interface CommentSearchResult {
  commentId: number;
  comment: string;
  commentHash: string;
  tagId: string;
  boutId: string;
  timestamp?: number;
  side?: z.infer<typeof SideSchema>;
  action?: z.infer<typeof ActionCodeSchema>;
  mistake?: z.infer<typeof MistakeTypeSchema>;
  period?: z.infer<typeof MatchPeriodSchema>;
  stripZone?: z.infer<typeof StripZoneSchema>;
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string;
  boutDateIso?: string;
  cosineDistance: number;
  cosineSimilarity: number;
}

export interface CommentSearchResponse {
  results: CommentSearchResult[];
  embeddedComments: number;
}
