import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface JsonMutation<T> {
  data: unknown;
  result: T;
}

export interface JsonFileStore {
  read(): Promise<unknown>;
  mutate<T>(
    mutator: (data: unknown) => JsonMutation<T> | Promise<JsonMutation<T>>,
  ): Promise<T>;
}

/**
 * Atomic, serialized access to one JSON file.
 *
 * This adapter deliberately treats the document as unknown. Validation and all
 * knowledge of the records in the document belong to repositories.
 */
export function createJsonFileStore(
  filePath: string,
  createInitialData: () => unknown,
): JsonFileStore {
  let writeChain: Promise<void> = Promise.resolve();

  async function read(): Promise<unknown> {
    await ensureFileExists();

    try {
      return JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch (error) {
      throw new Error(
        `Failed to read JSON file at ${filePath}: ${getErrorMessage(error)}`,
      );
    }
  }

  async function mutate<T>(
    mutator: (data: unknown) => JsonMutation<T> | Promise<JsonMutation<T>>,
  ): Promise<T> {
    return enqueueWrite(async () => {
      const currentData = await read();
      const { data, result } = await mutator(currentData);

      if (data !== currentData) {
        await write(data);
      }

      return result;
    });
  }

  async function ensureFileExists(): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      const handle = await fs.open(filePath, "wx");
      try {
        await handle.writeFile(`${JSON.stringify(createInitialData(), null, 2)}\n`);
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (!isFileAlreadyExistsError(error)) {
        throw error;
      }
    }
  }

  async function write(data: unknown): Promise<void> {
    const directory = path.dirname(filePath);
    const temporaryPath = path.join(
      directory,
      `${path.basename(filePath)}.${randomUUID()}.tmp`,
    );

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  }

  async function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const result = writeChain.then(task, task);
    writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return { read, mutate };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isFileAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}
