import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createStorageEnvelope } from "@/lib/session-service";
import type {
  SessionMutationResult,
  SessionRepository,
} from "@/lib/server/session-repository";
import {
  StorageEnvelopeSchema,
  type StorageEnvelope,
  type VideoSession,
} from "@/lib/types";

const DEFAULT_SESSION_STORE_FILE = ".data/fencing-tags-sessions.json";

export function createJsonFileSessionRepository(
  filePath = resolveSessionStoreFilePath(),
): SessionRepository {
  let writeChain: Promise<void> = Promise.resolve();

  async function listSessions(): Promise<VideoSession[]> {
    const envelope = await readEnvelope();
    return envelope.sessions;
  }

  async function getSessionById(sessionId: string): Promise<VideoSession | null> {
    const envelope = await readEnvelope();
    return envelope.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async function createSession(session: VideoSession): Promise<VideoSession> {
    return mutateSessions((sessions) => {
      const existingSession = sessions.find(
        (currentSession) => currentSession.id === session.id,
      );

      if (existingSession) {
        throw new Error(`Session ${session.id} already exists`);
      }

      return {
        sessions: [...sessions, session],
        result: session,
      };
    });
  }

  async function updateSession(session: VideoSession): Promise<VideoSession> {
    return mutateSessions((sessions) => {
      const sessionIndex = sessions.findIndex(
        (currentSession) => currentSession.id === session.id,
      );

      if (sessionIndex === -1) {
        throw new Error(`Session ${session.id} was not found`);
      }

      return {
        sessions: sessions.map((currentSession, index) =>
          index === sessionIndex ? session : currentSession,
        ),
        result: session,
      };
    });
  }

  async function deleteSession(sessionId: string): Promise<boolean> {
    return mutateSessions((sessions) => {
      const nextSessions = sessions.filter((session) => session.id !== sessionId);
      const deleted = nextSessions.length !== sessions.length;

      return {
        sessions: deleted ? nextSessions : sessions,
        result: deleted,
      };
    });
  }

  async function importSessions(
    sessions: VideoSession[],
  ): Promise<{ imported: number; skipped: number }> {
    return mutateSessions((currentSessions) => {
      const existingIds = new Set(currentSessions.map((session) => session.id));
      const newSessions = sessions.filter((session) => !existingIds.has(session.id));

      return {
        sessions:
          newSessions.length > 0
            ? [...currentSessions, ...newSessions]
            : currentSessions,
        result: {
          imported: newSessions.length,
          skipped: sessions.length - newSessions.length,
        },
      };
    });
  }

  async function replaceSessions(sessions: VideoSession[]): Promise<void> {
    await enqueueWrite(async () => {
      await writeEnvelope(sessions);
    });
  }

  async function mutateSessions<T>(
    mutator: (
      sessions: VideoSession[],
    ) =>
      | SessionMutationResult<T>
      | Promise<SessionMutationResult<T>>,
  ): Promise<T> {
    return enqueueWrite(async () => {
      const envelope = await readEnvelope();
      const { sessions, result } = await mutator(envelope.sessions);

      if (sessions !== envelope.sessions) {
        await writeEnvelope(sessions);
      }

      return result;
    });
  }

  async function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const result = writeChain.then(task, task);
    writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function ensureStoreFileExists(): Promise<void> {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });

    try {
      await fs.access(filePath);
    } catch {
      let handle;

      try {
        handle = await fs.open(filePath, "wx");
      } catch (error) {
        if (isFileAlreadyExistsError(error)) {
          return;
        }

        throw error;
      }

      try {
        await handle.writeFile(
          `${JSON.stringify(createStorageEnvelope([]), null, 2)}\n`,
        );
      } finally {
        await handle.close();
      }
    }
  }

  async function readEnvelope(): Promise<StorageEnvelope> {
    await ensureStoreFileExists();

    let rawText: string;

    try {
      rawText = await fs.readFile(filePath, "utf8");
    } catch (error) {
      throw new Error(
        `Failed to read session store file at ${filePath}: ${getErrorMessage(error)}`,
      );
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawText);
    } catch (error) {
      throw new Error(
        `Session store file at ${filePath} contains invalid JSON: ${getErrorMessage(error)}`,
      );
    }

    const parsedEnvelope = StorageEnvelopeSchema.safeParse(parsedJson);

    if (!parsedEnvelope.success) {
      throw new Error(
        `Session store file at ${filePath} is corrupt: ${parsedEnvelope.error.message}`,
      );
    }

    return parsedEnvelope.data;
  }

  async function writeEnvelope(sessions: VideoSession[]): Promise<void> {
    const envelope = createStorageEnvelope(sessions);
    const directory = path.dirname(filePath);
    const tempFilePath = path.join(
      directory,
      `${path.basename(filePath)}.${randomUUID()}.tmp`,
    );

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(tempFilePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
    await fs.rename(tempFilePath, filePath);
  }

  return {
    listSessions,
    getSessionById,
    createSession,
    updateSession,
    deleteSession,
    importSessions,
    replaceSessions,
    mutateSessions,
  };
}

function resolveSessionStoreFilePath(): string {
  const configuredPath = process.env.SESSION_STORE_FILE?.trim();

  if (!configuredPath) {
    return path.join(process.cwd(), DEFAULT_SESSION_STORE_FILE);
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isFileAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}
