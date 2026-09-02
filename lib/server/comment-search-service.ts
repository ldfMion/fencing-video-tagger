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

export async function searchComments(
  input: CommentSearchInput,
): Promise<CommentSearchResponse> {
  await databaseReady;
  const parsedInput = CommentSearchInputSchema.parse(input);
  const backfill = await backfillCommentEmbeddings();
  const queryEmbedding = await embedQuery(parsedInput.query);
  const queryVector = JSON.stringify(queryEmbedding);
  const totalResult = await databaseClient.execute(
    "SELECT count(*) AS count FROM comment_embeddings",
  );
  const totalEmbeddings = Number(totalResult.rows[0]?.count ?? 0);

  if (totalEmbeddings === 0) {
    return { results: [], embeddedComments: backfill.embedded };
  }

  let candidateCount = Math.min(
    totalEmbeddings,
    Math.max(parsedInput.limit * 10, 50),
  );
  let results: CommentSearchResult[] = [];

  while (true) {
    results = await executeSearch(
      parsedInput,
      queryVector,
      candidateCount,
    );
    if (results.length >= parsedInput.limit || candidateCount >= totalEmbeddings) {
      break;
    }
    candidateCount = Math.min(totalEmbeddings, candidateCount * 2);
  }

  return {
    results,
    embeddedComments: backfill.embedded,
  };
}

async function executeSearch(
  input: ReturnType<typeof CommentSearchInputSchema.parse>,
  queryVector: string,
  candidateCount: number,
): Promise<CommentSearchResult[]> {
  const conditions: string[] = [];
  const filterArgs: InValue[] = [];
  const { filters } = input;

  if (filters.fencer) {
    conditions.push("(lower(b.left_fencer) = lower(?) OR lower(b.right_fencer) = lower(?))");
    filterArgs.push(filters.fencer, filters.fencer);
  }
  addFilter(conditions, filterArgs, "t.side", filters.side);
  addFilter(conditions, filterArgs, "t.action", filters.action);
  addFilter(conditions, filterArgs, "t.mistake", filters.mistake);
  addFilter(conditions, filterArgs, "t.match_period", filters.period);
  addFilter(conditions, filterArgs, "t.strip_zone", filters.stripZone);
  if (filters.dateFrom) {
    conditions.push("b.bout_date_iso >= ?");
    filterArgs.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("b.bout_date_iso <= ?");
    filterArgs.push(filters.dateTo);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  const result = await databaseClient.execute({
    sql: `
      WITH nearest AS (
        SELECT id
        FROM vector_top_k('comment_embeddings_vector_idx', vector32(?), ?)
      )
      SELECT
        c.id AS comment_id,
        c.body AS comment,
        c.content_hash AS comment_hash,
        t.id AS tag_id,
        t.bout_id,
        t.timestamp,
        t.side,
        t.action,
        t.mistake,
        t.match_period,
        t.strip_zone,
        b.left_fencer,
        b.right_fencer,
        b.bout_date,
        b.bout_date_iso,
        vector_distance_cos(ce.embedding, vector32(?)) AS distance
      FROM nearest
      INNER JOIN comment_embeddings AS ce ON ce.comment_id = nearest.id
      INNER JOIN comments AS c ON c.id = ce.comment_id
      INNER JOIN tags AS t ON t.row_id = c.tag_row_id
      INNER JOIN bouts AS b ON b.id = t.bout_id
      ${whereClause}
      ORDER BY distance ASC, c.id ASC
      LIMIT ?
    `,
    args: [
      queryVector,
      candidateCount,
      queryVector,
      ...filterArgs,
      input.limit,
    ],
  });

  return result.rows.map((row) => {
    const cosineDistance = Number(row.distance);
    return {
      commentId: Number(row.comment_id),
      comment: String(row.comment),
      commentHash: String(row.comment_hash),
      tagId: String(row.tag_id),
      boutId: String(row.bout_id),
      ...(row.timestamp != null && { timestamp: Number(row.timestamp) }),
      ...(row.side != null && { side: String(row.side) as CommentSearchResult["side"] }),
      ...(row.action != null && {
        action: String(row.action) as CommentSearchResult["action"],
      }),
      ...(row.mistake != null && {
        mistake: String(row.mistake) as CommentSearchResult["mistake"],
      }),
      ...(row.match_period != null && {
        period: String(row.match_period) as CommentSearchResult["period"],
      }),
      ...(row.strip_zone != null && {
        stripZone: String(row.strip_zone) as CommentSearchResult["stripZone"],
      }),
      ...(row.left_fencer != null && { leftFencer: String(row.left_fencer) }),
      ...(row.right_fencer != null && { rightFencer: String(row.right_fencer) }),
      ...(row.bout_date != null && { boutDate: String(row.bout_date) }),
      ...(row.bout_date_iso != null && { boutDateIso: String(row.bout_date_iso) }),
      cosineDistance,
      cosineSimilarity: Math.max(-1, Math.min(1, 1 - cosineDistance)),
    };
  });
}

function addFilter(
  conditions: string[],
  args: InValue[],
  column: string,
  value: string | undefined,
): void {
  if (value != null) {
    conditions.push(`${column} = ?`);
    args.push(value);
  }
}
