import { openDatabase } from "@/lib/server/db/connection";

function createDatabase() {
  return openDatabase();
}

const globalForDatabase = globalThis as typeof globalThis & {
  fencingDatabase?: ReturnType<typeof createDatabase>;
};

const connection = globalForDatabase.fencingDatabase ?? createDatabase();

export const db = connection.database;
export const databaseClient = connection.client;
export const databaseReady = connection.ready;

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.fencingDatabase = connection;
}
