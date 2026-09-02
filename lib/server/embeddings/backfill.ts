import { databaseClient, databaseReady } from "@/lib/server/db/client";
import {
  EMBEDDING_ARTIFACT_ID,
  EMBEDDING_ARTIFACT_REVISION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_PROMPT_VERSION,
  embedComments,
} from "@/lib/server/embeddings/model";

const DEFAULT_BATCH_SIZE = 8;

export interface EmbeddingBackfillResult {
  embedded: number;
  remaining: number;
}

interface StaleComment {
  id: number;
  body: string;
  contentHash: string;
}

export async function backfillCommentEmbeddings(options: {
  batchSize?: number;
  limit?: number;
} = {}): Promise<EmbeddingBackfillResult> {
  await databaseReady;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const staleComments = await listStaleComments(options.limit);
  let embedded = 0;

  for (let offset = 0; offset < staleComments.length; offset += batchSize) {
    const batch = staleComments.slice(offset, offset + batchSize);
    const embeddings = await embedComments(batch.map((comment) => comment.body));
    const transaction = await databaseClient.transaction("write");
    try {
      for (const [index, comment] of batch.entries()) {
        await transaction.execute({
          sql: `
            INSERT INTO comment_embeddings (
              comment_id, embedding, model_id, model_revision, artifact_id,
              artifact_revision, prompt_version, dimensions, comment_hash, generated_at
            ) VALUES (?, vector32(?), ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(comment_id) DO UPDATE SET
              embedding = excluded.embedding,
              model_id = excluded.model_id,
              model_revision = excluded.model_revision,
              artifact_id = excluded.artifact_id,
              artifact_revision = excluded.artifact_revision,
              prompt_version = excluded.prompt_version,
              dimensions = excluded.dimensions,
              comment_hash = excluded.comment_hash,
              generated_at = excluded.generated_at
          `,
          args: [
            comment.id,
            JSON.stringify(embeddings[index]),
            EMBEDDING_MODEL_ID,
            EMBEDDING_MODEL_REVISION,
            EMBEDDING_ARTIFACT_ID,
            EMBEDDING_ARTIFACT_REVISION,
            EMBEDDING_PROMPT_VERSION,
            EMBEDDING_DIMENSIONS,
            comment.contentHash,
            Date.now(),
          ],
        });
      }
      await transaction.commit();
      embedded += batch.length;
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }

  return {
    embedded,
    remaining: await countStaleComments(),
  };
}

export async function countStaleComments(): Promise<number> {
  await databaseReady;
  const result = await databaseClient.execute({
    sql: `${staleCommentSelect("count(*) AS count")}`,
    args: embeddingMetadataArgs(),
  });
  return Number(result.rows[0]?.count ?? 0);
}

async function listStaleComments(limit?: number): Promise<StaleComment[]> {
  const result = await databaseClient.execute({
    sql: `${staleCommentSelect("c.id, c.body, c.content_hash")}
      ORDER BY c.id
      ${limit == null ? "" : "LIMIT ?"}`,
    args: [...embeddingMetadataArgs(), ...(limit == null ? [] : [limit])],
  });
  return result.rows.map((row) => ({
    id: Number(row.id),
    body: String(row.body),
    contentHash: String(row.content_hash),
  }));
}

function staleCommentSelect(columns: string): string {
  return `
    SELECT ${columns}
    FROM comments AS c
    LEFT JOIN comment_embeddings AS ce ON ce.comment_id = c.id
    WHERE trim(c.body) <> '' AND (
      ce.comment_id IS NULL
      OR ce.comment_hash <> c.content_hash
      OR ce.model_id <> ?
      OR ce.model_revision <> ?
      OR ce.artifact_id <> ?
      OR ce.artifact_revision <> ?
      OR ce.prompt_version <> ?
      OR ce.dimensions <> ?
    )
  `;
}

function embeddingMetadataArgs() {
  return [
    EMBEDDING_MODEL_ID,
    EMBEDDING_MODEL_REVISION,
    EMBEDDING_ARTIFACT_ID,
    EMBEDDING_ARTIFACT_REVISION,
    EMBEDDING_PROMPT_VERSION,
    EMBEDDING_DIMENSIONS,
  ];
}
