import "server-only";

import type { VideoSession } from "@/lib/types";
import { createJsonFileSessionRepository } from "@/lib/server/json-session-repository";

export interface SessionMutationResult<T> {
  sessions: VideoSession[];
  result: T;
}

export interface SessionRepository {
  listSessions(): Promise<VideoSession[]>;
  getSessionById(sessionId: string): Promise<VideoSession | null>;
  createSession(session: VideoSession): Promise<VideoSession>;
  updateSession(session: VideoSession): Promise<VideoSession>;
  deleteSession(sessionId: string): Promise<boolean>;
  importSessions(
    sessions: VideoSession[],
  ): Promise<{ imported: number; skipped: number }>;
  replaceSessions(sessions: VideoSession[]): Promise<void>;
  mutateSessions<T>(
    mutator: (
      sessions: VideoSession[],
    ) =>
      | SessionMutationResult<T>
      | Promise<SessionMutationResult<T>>,
  ): Promise<T>;
}

let repository: SessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
  if (!repository) {
    repository = createJsonFileSessionRepository();
  }

  return repository;
}
