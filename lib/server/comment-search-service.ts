"use server";

import type { InValue } from "@libsql/client";
import {
  CommentSearchInputSchema,
  type CommentSearchInput,
  type CommentSearchResponse,
  type CommentSearchResult,
} from "@/lib/comment-search";
import { databaseClient, databaseReady } from "@/lib/server/db/client";
import { backfillCommentEmbeddings } from "@/lib/server/embeddings/backfill";
import { embedQuery } from "@/lib/server/embeddings/model";

export async function listSearchFencers(): Promise<string[]> {
  await databaseReady;
  const result = await databaseClient.execute(`
    SELECT f.canonical_name AS name
    FROM fencers AS f
    WHERE EXISTS (
      SELECT 1
      FROM bout_participants AS p
      WHERE p.fencer_id = f.id
    )
    ORDER BY f.canonical_name COLLATE NOCASE
  `);

  return result.rows.map((row) => String(row.name));
}

export async function searchComments(
  input: CommentSearchInput,
): Promise<CommentSearchResponse> {
  await databaseReady;
  const parsedInput = CommentSearchInputSchema.parse(input);
  const requestedCount = parsedInput.offset + parsedInput.limit + 1;

  if (!parsedInput.query) {
    const results = await executeFilterSearch(parsedInput, requestedCount);
    return {
      results: results.slice(parsedInput.offset, parsedInput.offset + parsedInput.limit),
      embeddedComments: 0,
      hasMore: results.length > parsedInput.offset + parsedInput.limit,
    };
  }

  const backfill = await backfillCommentEmbeddings();
  const queryEmbedding = await embedQuery(parsedInput.query);
  const queryVector = JSON.stringify(queryEmbedding);
  const totalResult = await databaseClient.execute(
    "SELECT count(*) AS count FROM comment_embeddings",
  );
  const totalEmbeddings = Number(totalResult.rows[0]?.count ?? 0);

  if (totalEmbeddings === 0) {
    return { results: [], embeddedComments: backfill.embedded, hasMore: false };
  }

  let candidateCount = Math.min(totalEmbeddings, Math.max(requestedCount * 10, 100));
  let results: CommentSearchResult[] = [];

  while (true) {
    results = await executeSemanticSearch(
      parsedInput,
      queryVector,
      candidateCount,
      requestedCount,
    );
    if (results.length >= requestedCount || candidateCount >= totalEmbeddings) break;
    candidateCount = Math.min(totalEmbeddings, candidateCount * 2);
  }

  return {
    results: results.slice(parsedInput.offset, parsedInput.offset + parsedInput.limit),
    embeddedComments: backfill.embedded,
    hasMore: results.length > parsedInput.offset + parsedInput.limit,
  };
}

function createFilters(input: ReturnType<typeof CommentSearchInputSchema.parse>) {
  const conditions: string[] = [];
  const args: InValue[] = [];
  const { filters } = input;

  if (!filters.includeWithoutReplay) {
    conditions.push("b.video_source_type = 'library' AND b.video_relative_path IS NOT NULL");
  }
  if (filters.fencers.length > 0) {
    const placeholders = filters.fencers.map(() => "?").join(", ");
    conditions.push(`(lower(b.left_fencer) IN (${placeholders}) OR lower(b.right_fencer) IN (${placeholders}))`);
    const fencers = filters.fencers.map((value) => value.toLowerCase());
    args.push(...fencers, ...fencers);
  }
  addMultiFilter(conditions, args, "t.action", filters.actions);
  addMultiFilter(conditions, args, "t.mistake", filters.mistakes);
  addMultiFilter(conditions, args, "t.match_period", filters.periods);
  addMultiFilter(conditions, args, "t.strip_zone", filters.stripZones);
  if (filters.dateFrom) {
    conditions.push("b.bout_date_iso >= ?");
    args.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("b.bout_date_iso <= ?");
    args.push(filters.dateTo);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    args,
  };
}

async function executeFilterSearch(
  input: ReturnType<typeof CommentSearchInputSchema.parse>,
  limit: number,
): Promise<CommentSearchResult[]> {
  const filters = createFilters(input);
  const result = await databaseClient.execute({
    sql: `
      ${resultSelect()}
      FROM tags AS t
      INNER JOIN comments AS c ON c.tag_row_id = t.row_id
      INNER JOIN bouts AS b ON b.id = t.bout_id
      ${filters.whereClause}
      ORDER BY b.last_modified DESC, t.created_at DESC, c.id DESC
      LIMIT ?
    `,
    args: [...filters.args, limit],
  });
  return result.rows.map(mapResult);
}

async function executeSemanticSearch(
  input: ReturnType<typeof CommentSearchInputSchema.parse>,
  queryVector: string,
  candidateCount: number,
  limit: number,
): Promise<CommentSearchResult[]> {
  const filters = createFilters(input);
  const result = await databaseClient.execute({
    sql: `
      WITH nearest AS (
        SELECT id FROM vector_top_k('comment_embeddings_vector_idx', vector32(?), ?)
      )
      ${resultSelect("vector_distance_cos(ce.embedding, vector32(?)) AS distance,")}
      FROM nearest
      INNER JOIN comment_embeddings AS ce ON ce.comment_id = nearest.id
      INNER JOIN comments AS c ON c.id = ce.comment_id
      INNER JOIN tags AS t ON t.row_id = c.tag_row_id
      INNER JOIN bouts AS b ON b.id = t.bout_id
      ${filters.whereClause}
      ORDER BY distance ASC, c.id ASC
      LIMIT ?
    `,
    args: [queryVector, candidateCount, queryVector, ...filters.args, limit],
  });
  return result.rows.map(mapResult);
}

function resultSelect(extra = "") {
  return `SELECT
    ${extra}
    c.id AS comment_id, c.body AS comment, c.content_hash AS comment_hash,
    t.id AS tag_id, t.bout_id, t.timestamp, t.side, t.action, t.mistake,
    t.match_period, t.match_clock, t.strip_zone,
    b.left_fencer, b.right_fencer, b.bout_date, b.bout_date_iso,
    b.video_relative_path, b.video_source_type`;
}

function mapResult(row: Record<string, unknown>): CommentSearchResult {
  const replayAvailable = row.video_source_type === "library" && row.video_relative_path != null;
  const taggedFencer = row.side === "L" ? row.left_fencer : row.side === "R" ? row.right_fencer : undefined;
  const opponent = row.side === "L" ? row.right_fencer : row.side === "R" ? row.left_fencer : undefined;
  const distance = row.distance == null ? undefined : Number(row.distance);

  return {
    commentId: Number(row.comment_id),
    comment: String(row.comment),
    commentHash: String(row.comment_hash),
    tagId: String(row.tag_id),
    boutId: String(row.bout_id),
    replayAvailable,
    ...(row.timestamp != null && { timestamp: Number(row.timestamp) }),
    ...(row.action != null && { action: String(row.action) as CommentSearchResult["action"] }),
    ...(row.mistake != null && { mistake: String(row.mistake) as CommentSearchResult["mistake"] }),
    ...(row.match_period != null && { period: String(row.match_period) as CommentSearchResult["period"] }),
    ...(row.match_clock != null && { matchClock: String(row.match_clock) }),
    ...(row.strip_zone != null && { stripZone: String(row.strip_zone) as CommentSearchResult["stripZone"] }),
    ...(taggedFencer != null && { taggedFencer: String(taggedFencer) }),
    ...(opponent != null && { opponent: String(opponent) }),
    ...(row.left_fencer != null && { leftFencer: String(row.left_fencer) }),
    ...(row.right_fencer != null && { rightFencer: String(row.right_fencer) }),
    ...(row.bout_date != null && { boutDate: String(row.bout_date) }),
    ...(row.bout_date_iso != null && { boutDateIso: String(row.bout_date_iso) }),
    ...(row.video_relative_path != null && { videoRelativePath: String(row.video_relative_path) }),
    ...(distance != null && {
      cosineDistance: distance,
      cosineSimilarity: Math.max(-1, Math.min(1, 1 - distance)),
    }),
  };
}

function addMultiFilter(
  conditions: string[],
  args: InValue[],
  column: string,
  values: readonly string[],
): void {
  if (values.length === 0) return;
  conditions.push(`${column} IN (${values.map(() => "?").join(", ")})`);
  args.push(...values);
}
