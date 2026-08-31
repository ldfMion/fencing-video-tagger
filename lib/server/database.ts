import "server-only";

import path from "node:path";
import {
  createEmptyDatabase,
  DatabaseSchema,
  type Database,
} from "@/lib/database-models";
import { createJsonFileStore } from "@/lib/server/json-file-store";
import {
  createValidatedStore,
  type ValidatedStore,
} from "@/lib/server/validated-store";

const DEFAULT_DATABASE_FILE = ".data/fencing-tags-sessions.json";

let store: ValidatedStore<Database> | null = null;

export function getDatabaseStore(): ValidatedStore<Database> {
  if (!store) {
    const jsonStore = createJsonFileStore(
      resolveDatabaseFilePath(),
      createEmptyDatabase,
    );
    store = createValidatedStore(jsonStore, DatabaseSchema, "Database");
  }

  return store;
}

function resolveDatabaseFilePath(): string {
  const configuredPath = process.env.SESSION_STORE_FILE?.trim();

  if (!configuredPath) {
    return path.join(process.cwd(), DEFAULT_DATABASE_FILE);
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
}
