import path from "node:path";
import {
  AutoModel,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";

export const EMBEDDING_MODEL_ID = "google/embeddinggemma-300m";
export const EMBEDDING_MODEL_REVISION =
  "57c266a740f537b4dc058e1b0cda161fd15afa75";
export const EMBEDDING_ARTIFACT_ID =
  "onnx-community/embeddinggemma-300m-ONNX";
export const EMBEDDING_ARTIFACT_REVISION =
  "5090578d9565bb06545b4552f76e6bc2c93e4a66";
export const EMBEDDING_PROMPT_VERSION = "embeddinggemma-retrieval-v1";
export const EMBEDDING_DIMENSIONS = 256;
export const EMBEDDING_CACHE_DIRECTORY = ".data/models";

const QUERY_PREFIX = "task: search result | query: ";
const DOCUMENT_PREFIX = "title: none | text: ";

interface EmbeddingRuntime {
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
}

let runtimePromise: Promise<EmbeddingRuntime> | null = null;

export async function loadEmbeddingModel(
  allowRemoteModels = false,
): Promise<EmbeddingRuntime> {
  runtimePromise ??= createEmbeddingRuntime(allowRemoteModels).catch((error) => {
    runtimePromise = null;
    throw error;
  });
  return runtimePromise;
}

export async function embedQuery(query: string): Promise<number[]> {
  return embedTexts([`${QUERY_PREFIX}${query}`]).then((vectors) => vectors[0]);
}

export async function embedComments(comments: string[]): Promise<number[][]> {
  if (comments.length === 0) {
    return [];
  }
  return embedTexts(comments.map((comment) => `${DOCUMENT_PREFIX}${comment}`));
}

export function truncateAndNormalizeEmbedding(values: ArrayLike<number>): number[] {
  if (values.length < EMBEDDING_DIMENSIONS) {
    throw new Error(
      `EmbeddingGemma returned ${values.length} dimensions; expected at least ${EMBEDDING_DIMENSIONS}.`,
    );
  }

  const truncated = Array.from(values).slice(0, EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(truncated.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("EmbeddingGemma returned an invalid zero-length embedding.");
  }
  return truncated.map((value) => value / norm);
}

async function createEmbeddingRuntime(
  allowRemoteModels: boolean,
): Promise<EmbeddingRuntime> {
  const cacheDirectory = path.resolve(
    process.env.EMBEDDING_MODEL_CACHE?.trim() || EMBEDDING_CACHE_DIRECTORY,
  );
  env.cacheDir = cacheDirectory;
  env.allowLocalModels = true;
  env.allowRemoteModels = allowRemoteModels;

  const modelReference = allowRemoteModels
    ? EMBEDDING_ARTIFACT_ID
    : path.join(
      cacheDirectory,
      EMBEDDING_ARTIFACT_ID,
      EMBEDDING_ARTIFACT_REVISION,
    );
  const options = {
    cache_dir: cacheDirectory,
    ...(allowRemoteModels && { revision: EMBEDDING_ARTIFACT_REVISION }),
    local_files_only: !allowRemoteModels,
  } as const;

  try {
    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(modelReference, options),
      AutoModel.from_pretrained(modelReference, {
        ...options,
        dtype: "fp32",
      }),
    ]);
    return { tokenizer, model };
  } catch (error) {
    if (!allowRemoteModels) {
      throw new Error(
        "The local EmbeddingGemma model is not provisioned. Run `pnpm embeddings:provision` once, then retry.",
        { cause: error },
      );
    }
    throw error;
  }
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const { tokenizer, model } = await loadEmbeddingModel(false);
  const inputs = await tokenizer(texts, { padding: true, truncation: true });
  const output = await model(inputs);
  const sentenceEmbedding = output.sentence_embedding;
  if (!sentenceEmbedding) {
    throw new Error("EmbeddingGemma did not return sentence_embedding output.");
  }

  const rows = sentenceEmbedding.tolist() as number[][];
  return rows.map(truncateAndNormalizeEmbedding);
}
