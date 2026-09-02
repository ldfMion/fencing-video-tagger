import assert from "node:assert/strict";
import test from "node:test";
import {
  EMBEDDING_DIMENSIONS,
  truncateAndNormalizeEmbedding,
} from "../lib/server/embeddings/model";

test("truncates EmbeddingGemma output to 256 dimensions and normalizes it", () => {
  const source = Array.from({ length: 768 }, (_, index) => index + 1);
  const vector = truncateAndNormalizeEmbedding(source);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  assert.equal(vector.length, EMBEDDING_DIMENSIONS);
  assert.ok(Math.abs(norm - 1) < 1e-12);
});

test("rejects malformed model output", () => {
  assert.throws(() => truncateAndNormalizeEmbedding([1, 2, 3]));
  assert.throws(() => truncateAndNormalizeEmbedding(new Array(768).fill(0)));
});
