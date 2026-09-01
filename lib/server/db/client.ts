import "server-only";

import { openDatabase } from "@/lib/server/db/connection";

function createDatabase() {
  return openDatabase().database;
}

const globalForDatabase = globalThis as typeof globalThis & {
  fencingDatabase?: ReturnType<typeof createDatabase>;
};

export const db = globalForDatabase.fencingDatabase ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.fencingDatabase = db;
}
