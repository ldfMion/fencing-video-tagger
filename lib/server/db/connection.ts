import { mkdirSync } from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sessionsTable, tagsTable } from "@/lib/server/db/schema";

export const DEFAULT_DATABASE_FILE = ".data/fencing-tags.sqlite";

export function resolveDatabasePath(configuredPath?: string): string {
  const databasePath = configuredPath?.trim() ||
    process.env.SESSION_DATABASE_FILE?.trim() ||
    DEFAULT_DATABASE_FILE;

  return path.isAbsolute(databasePath)
    ? databasePath
    : path.join(process.cwd(), databasePath);
}

export function openDatabase(configuredPath?: string) {
  const databasePath = resolveDatabasePath(configuredPath);
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new BetterSqlite3(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const database = drizzle(sqlite, { schema: { sessionsTable, tagsTable } });
  migrate(database, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  return { database, sqlite };
}

