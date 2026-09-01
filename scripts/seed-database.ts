import { readFileSync } from "node:fs";
import path from "node:path";
import { count } from "drizzle-orm";
import { StorageEnvelopeSchema } from "../lib/database-models";
import {
  openDatabase,
  resolveDatabasePath,
} from "../lib/server/db/connection";
import { sessionsTable, tagsTable } from "../lib/server/db/schema";
import { VideoSessionSchema } from "../lib/types";

const DEFAULT_INPUT_FILE = ".data/fencing-tags-sessions.json";
const SessionPayloadSchema = VideoSessionSchema.omit({ tags: true });

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
const { database, sqlite } = openDatabase(resolvedDatabasePath);

try {
  const sessionCount = database.select({ value: count() })
    .from(sessionsTable).get()?.value ?? 0;
  const tagCount = database.select({ value: count() })
    .from(tagsTable).get()?.value ?? 0;

  if (sessionCount > 0 || tagCount > 0) {
    fail(
      `Database ${resolvedDatabasePath} is not empty; seeding was cancelled.`,
    );
  }

  database.transaction((transaction) => {
    for (const session of envelope.data.sessions) {
      const sessionPayload = SessionPayloadSchema.parse(session);
      transaction.insert(sessionsTable).values({
        id: session.id,
        payload: JSON.stringify(sessionPayload),
      }).run();

      if (session.tags.length > 0) {
        transaction.insert(tagsTable).values(
          session.tags.map((tag, position) => ({
            sessionId: session.id,
            id: tag.id,
            position,
            payload: JSON.stringify(tag),
          })),
        ).run();
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
  sqlite.close();
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
    fail(
      "Usage: pnpm db:seed [sessions.json] [--database database.sqlite]",
    );
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
