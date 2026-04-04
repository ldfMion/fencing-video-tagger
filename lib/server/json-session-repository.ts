import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createStorageEnvelope } from "@/lib/session-service";
import { StorageEnvelopeSchema, type StorageEnvelope, type VideoSession } from "@/lib/types";
import type { SessionRepository } from "@/lib/server/session-repository";

const DEFAULT_SESSION_STORE_FILE = ".data/fencing-tags-sessions.json";

export class JsonFileSessionRepository implements SessionRepository {
  private readonly filePath: string;

  private writeChain: Promise<void> = Promise.resolve();

  constructor(filePath = resolveSessionStoreFilePath()) {
    this.filePath = filePath;
  }

  async listSessions(): Promise<VideoSession[]> {
    const envelope = await this.readEnvelope();
    return envelope.sessions;
  }

  async getSessionById(sessionId: string): Promise<VideoSession | null> {
    const envelope = await this.readEnvelope();
    return envelope.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async createSession(session: VideoSession): Promise<VideoSession> {
    return this.enqueueWrite(async () => {
      const envelope = await this.readEnvelope();
      const existingSession = envelope.sessions.find(
        (currentSession) => currentSession.id === session.id,
      );

      if (existingSession) {
        throw new Error(`Session ${session.id} already exists`);
      }

      await this.writeEnvelope([...envelope.sessions, session]);
      return session;
    });
  }

  async updateSession(session: VideoSession): Promise<VideoSession> {
    return this.enqueueWrite(async () => {
      const envelope = await this.readEnvelope();
      const sessionIndex = envelope.sessions.findIndex(
        (currentSession) => currentSession.id === session.id,
      );

      if (sessionIndex === -1) {
        throw new Error(`Session ${session.id} was not found`);
      }

      const nextSessions = envelope.sessions.map((currentSession, index) =>
        index === sessionIndex ? session : currentSession,
      );

      await this.writeEnvelope(nextSessions);
      return session;
    });
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      const envelope = await this.readEnvelope();
      const nextSessions = envelope.sessions.filter(
        (session) => session.id !== sessionId,
      );

      if (nextSessions.length === envelope.sessions.length) {
        return false;
      }

      await this.writeEnvelope(nextSessions);
      return true;
    });
  }

  async importSessions(
    sessions: VideoSession[],
  ): Promise<{ imported: number; skipped: number }> {
    return this.enqueueWrite(async () => {
      const envelope = await this.readEnvelope();
      const existingIds = new Set(envelope.sessions.map((session) => session.id));
      const newSessions = sessions.filter((session) => !existingIds.has(session.id));

      if (newSessions.length > 0) {
        await this.writeEnvelope([...envelope.sessions, ...newSessions]);
      }

      return {
        imported: newSessions.length,
        skipped: sessions.length - newSessions.length,
      };
    });
  }

  async replaceSessions(sessions: VideoSession[]): Promise<void> {
    await this.enqueueWrite(async () => {
      await this.writeEnvelope(sessions);
    });
  }

  private async enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const result = this.writeChain.then(task, task);
    this.writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async ensureStoreFileExists(): Promise<void> {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      let handle;

      try {
        handle = await fs.open(this.filePath, "wx");
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
      } catch (error) {
        await handle.close();
        throw error;
      }

      await handle.close();
    }
  }

  private async readEnvelope(): Promise<StorageEnvelope> {
    await this.ensureStoreFileExists();

    let rawText: string;

    try {
      rawText = await fs.readFile(this.filePath, "utf8");
    } catch (error) {
      throw new Error(
        `Failed to read session store file at ${this.filePath}: ${getErrorMessage(error)}`,
      );
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawText);
    } catch (error) {
      throw new Error(
        `Session store file at ${this.filePath} contains invalid JSON: ${getErrorMessage(error)}`,
      );
    }

    const parsedEnvelope = StorageEnvelopeSchema.safeParse(parsedJson);

    if (!parsedEnvelope.success) {
      throw new Error(
        `Session store file at ${this.filePath} is corrupt: ${parsedEnvelope.error.message}`,
      );
    }

    return parsedEnvelope.data;
  }

  private async writeEnvelope(sessions: VideoSession[]): Promise<void> {
    const envelope = createStorageEnvelope(sessions);
    const directory = path.dirname(this.filePath);
    const tempFilePath = path.join(
      directory,
      `${path.basename(this.filePath)}.${randomUUID()}.tmp`,
    );

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(tempFilePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
    await fs.rename(tempFilePath, this.filePath);
  }
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
