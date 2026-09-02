import { createHash } from "node:crypto";
import { constants, copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client/node";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { normalizeBoutDate } from "@/lib/bout-date";
import {
  boutsTable,
  commentsTable,
  databaseSchema,
} from "@/lib/server/db/schema";

export const DEFAULT_DATABASE_FILE = ".data/fencing-tags.sqlite";
export const LEGACY_BACKUP_SUFFIX = ".pre-relational-libsql.bak";

export function resolveDatabasePath(configuredPath?: string): string {
  const databasePath = configuredPath?.trim() ||
    process.env.SESSION_DATABASE_FILE?.trim() ||
    DEFAULT_DATABASE_FILE;

  return path.isAbsolute(databasePath)
    ? databasePath
    : path.join(process.cwd(), databasePath);
}

export function toLocalLibsqlUrl(databasePath: string): string {
  return `file:${databasePath}`;
}

export function openDatabase(configuredPath?: string) {
  const databasePath = resolveDatabasePath(configuredPath);
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const client = createClient({ url: toLocalLibsqlUrl(databasePath) });
  const database = drizzle(client, { schema: databaseSchema });
  const ready = initializeDatabase(client, database, databasePath);

  return { database, client, databasePath, ready };
}

type Database = ReturnType<typeof drizzle<typeof databaseSchema>>;

async function initializeDatabase(
  client: Client,
  database: Database,
  databasePath: string,
): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA busy_timeout = 5000");
  await createLegacyBackupIfNeeded(client, databasePath);
  await migrate(database, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  await finalizeRelationalData(database);
}

async function createLegacyBackupIfNeeded(
  client: Client,
  databasePath: string,
): Promise<void> {
  if (!existsSync(databasePath) || !await hasLegacyPayloadSchema(client)) {
    return;
  }

  const backupPath = `${databasePath}${LEGACY_BACKUP_SUFFIX}`;
  if (existsSync(backupPath)) {
    return;
  }

  await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  copyFileSync(databasePath, backupPath, constants.COPYFILE_EXCL);
}

async function hasLegacyPayloadSchema(client: Client): Promise<boolean> {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'",
  );
  if (tables.rows.length === 0) {
    return false;
  }

  const columns = await client.execute("PRAGMA table_info(sessions)");
  return columns.rows.some((row) => row.name === "payload");
}

async function finalizeRelationalData(database: Database): Promise<void> {
  const bouts = await database.select({
    id: boutsTable.id,
    boutDate: boutsTable.boutDate,
  }).from(boutsTable).where(isNull(boutsTable.boutDateIso));
  const comments = await database.select({
    id: commentsTable.id,
    body: commentsTable.body,
  }).from(commentsTable).where(eq(commentsTable.contentHash, ""));

  if (comments.length === 0 && bouts.length === 0) {
    return;
  }

  await database.transaction(async (transaction) => {
    for (const bout of bouts) {
      const boutDateIso = normalizeBoutDate(bout.boutDate);
      if (boutDateIso) {
        await transaction.update(boutsTable).set({ boutDateIso }).where(
          eq(boutsTable.id, bout.id),
        );
      }
    }
    for (const comment of comments) {
      await transaction.update(commentsTable).set({
        contentHash: hashComment(comment.body),
      }).where(eq(commentsTable.id, comment.id));
    }
  });
}

export function hashComment(comment: string): string {
  return createHash("sha256").update(comment, "utf8").digest("hex");
}
