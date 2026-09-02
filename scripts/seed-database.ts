import { readFileSync } from "node:fs";
import path from "node:path";
import { count } from "drizzle-orm";
import { normalizeBoutDate } from "../lib/bout-date";
import { StorageEnvelopeSchema } from "../lib/database-models";
import {
  hashComment,
  openDatabase,
  resolveDatabasePath,
} from "../lib/server/db/connection";
import {
  boutsTable,
  commentsTable,
  tagsTable,
} from "../lib/server/db/schema";

const DEFAULT_INPUT_FILE = ".data/fencing-tags-sessions.json";

async function main(): Promise<void> {
  const { inputPath, databasePath } = parseArguments(process.argv.slice(2));
  const sourcePath = path.resolve(inputPath);

  let rawInput: unknown;
  try {
    rawInput = JSON.parse(readFileSync(sourcePath, "utf8"));
  } catch (error) {
    fail(`Could not read ${sourcePath}: ${getErrorMessage(error)}`);
  }

  const envelope = StorageEnvelopeSchema.safeParse(rawInput);
  if (!envelope.success) {
    fail(`Invalid seed file: ${envelope.error.message}`);
  }

  const resolvedDatabasePath = resolveDatabasePath(databasePath);
  const { database, client, ready } = openDatabase(resolvedDatabasePath);

  try {
    await ready;
    const sessionCount = (await database.select({ value: count() })
      .from(boutsTable).get())?.value ?? 0;
    const tagCount = (await database.select({ value: count() })
      .from(tagsTable).get())?.value ?? 0;

    if (sessionCount > 0 || tagCount > 0) {
      fail(`Database ${resolvedDatabasePath} is not empty; seeding was cancelled.`);
    }

    await database.transaction(async (transaction) => {
      for (const session of envelope.data.sessions) {
        await transaction.insert(boutsTable).values({
          id: session.id,
          fileName: session.fileName ?? null,
          videoRelativePath: session.videoRelativePath ?? null,
          videoMimeType: session.videoMimeType ?? null,
          videoSourceType: session.videoSourceType ?? null,
          lastModified: session.lastModified,
          leftFencer: session.leftFencer ?? null,
          rightFencer: session.rightFencer ?? null,
          boutDate: session.boutDate ?? null,
          boutDateIso: normalizeBoutDate(session.boutDate) ?? null,
          boutType: session.boutType ?? null,
          externalSource: session.externalSource ?? null,
          matchClockEnabled: session.taggingOptions?.matchClockEnabled ?? null,
          stripZoneEnabled: session.taggingOptions?.stripZoneEnabled ?? null,
        });

        for (const [position, tag] of session.tags.entries()) {
          const inserted = await transaction.insert(tagsTable).values({
            boutId: session.id,
            id: tag.id,
            position,
            timestamp: tag.timestamp ?? null,
            seq: tag.seq ?? null,
            createdAt: tag.createdAt,
            side: tag.side ?? null,
            action: tag.action ?? null,
            mistake: tag.mistake ?? null,
            matchPeriod: tag.matchPeriod ?? null,
            matchClock: tag.matchClock ?? null,
            stripZone: tag.stripZone ?? null,
          }).returning({ rowId: tagsTable.rowId }).get();
          await transaction.insert(commentsTable).values({
            tagRowId: inserted.rowId,
            body: tag.comment,
            contentHash: hashComment(tag.comment),
          });
        }
      }
    });

    const seededTags = envelope.data.sessions.reduce(
      (total, session) => total + session.tags.length,
      0,
    );
    console.log(
      `Seeded ${envelope.data.sessions.length} session(s) and ${seededTags} tag(s) into ${resolvedDatabasePath}.`,
    );
  } finally {
    client.close();
  }
}

function parseArguments(args: string[]) {
  const databaseFlagIndex = args.indexOf("--database");
  const databasePath = databaseFlagIndex >= 0
    ? args[databaseFlagIndex + 1]
    : undefined;

  if (databaseFlagIndex >= 0 && !databasePath) {
    fail("--database requires a file path.");
  }

  const positionalArgs = args.filter((_argument, index) =>
    databaseFlagIndex < 0 ||
    (index !== databaseFlagIndex && index !== databaseFlagIndex + 1)
  );
  if (positionalArgs.length > 1 || positionalArgs[0]?.startsWith("--")) {
    fail("Usage: pnpm db:seed [sessions.json] [--database database.sqlite]");
  }

  return {
    inputPath: positionalArgs[0] ?? DEFAULT_INPUT_FILE,
    databasePath,
  };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

void main();
