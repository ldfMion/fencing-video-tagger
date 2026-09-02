import { databaseClient } from "../lib/server/db/client";
import { backfillCommentEmbeddings } from "../lib/server/embeddings/backfill";

async function main(): Promise<void> {
  try {
    let totalEmbedded = 0;
    while (true) {
      const result = await backfillCommentEmbeddings({ limit: 100 });
      totalEmbedded += result.embedded;
      console.log(
        `Embedded ${totalEmbedded} comment(s); ${result.remaining} stale or missing.`,
      );
      if (result.remaining === 0) {
        break;
      }
    }
  } finally {
    databaseClient.close();
  }
}

void main();
