import {
  EMBEDDING_ARTIFACT_ID,
  EMBEDDING_ARTIFACT_REVISION,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_REVISION,
  loadEmbeddingModel,
  truncateAndNormalizeEmbedding,
} from "../lib/server/embeddings/model";

async function main(): Promise<void> {
  console.log(`Provisioning ${EMBEDDING_ARTIFACT_ID}@${EMBEDDING_ARTIFACT_REVISION}...`);
  const { tokenizer, model } = await loadEmbeddingModel(true);
  const inputs = await tokenizer(["title: none | text: teste local"], {
    padding: true,
    truncation: true,
  });
  const output = await model(inputs);
  const sentenceEmbedding = output.sentence_embedding;
  if (!sentenceEmbedding) {
    throw new Error("Provisioned model did not return sentence_embedding output.");
  }
  const vector = truncateAndNormalizeEmbedding(
    (sentenceEmbedding.tolist() as number[][])[0],
  );
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions.`);
  }

  console.log(
    `Provisioned ${EMBEDDING_MODEL_ID}@${EMBEDDING_MODEL_REVISION} locally (${vector.length} dimensions).`,
  );
}

void main();
