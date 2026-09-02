import { defineConfig } from "drizzle-kit";

const databasePath = process.env.SESSION_DATABASE_FILE ||
  ".data/fencing-tags.sqlite";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databasePath.startsWith("file:") ? databasePath : `file:${databasePath}`,
  },
});
