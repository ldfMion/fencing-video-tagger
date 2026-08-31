import "server-only";

import { getDatabaseStore } from "@/lib/server/database";
import type {
  SessionMutationResult,
  SessionRepository,
} from "@/lib/server/session-repository";
import type { VideoSession } from "@/lib/types";

export function createJsonFileSessionRepository(): SessionRepository {
  const store = getDatabaseStore();

  async function listSessions(): Promise<VideoSession[]> {
    return (await store.read()).sessions;
  }

  async function getSessionById(sessionId: string): Promise<VideoSession | null> {
    return (await listSessions()).find((session) => session.id === sessionId) ?? null;
  }

  async function createSession(session: VideoSession): Promise<VideoSession> {
    return mutateSessions((sessions) => {
      if (sessions.some((current) => current.id === session.id)) {
        throw new Error(`Session ${session.id} already exists`);
      }
      return { sessions: [...sessions, session], result: session };
    });
  }

  async function updateSession(session: VideoSession): Promise<VideoSession> {
    return mutateSessions((sessions) => {
      const index = sessions.findIndex((current) => current.id === session.id);
      if (index === -1) {
        throw new Error(`Session ${session.id} was not found`);
      }
      return {
        sessions: sessions.map((current, currentIndex) =>
          currentIndex === index ? session : current,
        ),
        result: session,
      };
    });
  }

  async function deleteSession(sessionId: string): Promise<boolean> {
    return mutateSessions((sessions) => {
      const nextSessions = sessions.filter((session) => session.id !== sessionId);
      return {
        sessions: nextSessions.length === sessions.length ? sessions : nextSessions,
        result: nextSessions.length !== sessions.length,
      };
    });
  }

  async function importSessions(sessions: VideoSession[]) {
    return mutateSessions((currentSessions) => {
      const existingIds = new Set(currentSessions.map((session) => session.id));
      const importedSessions = sessions.filter((session) => !existingIds.has(session.id));
      return {
        sessions: importedSessions.length === 0
          ? currentSessions
          : [...currentSessions, ...importedSessions],
        result: {
          imported: importedSessions.length,
          skipped: sessions.length - importedSessions.length,
        },
      };
    });
  }

  async function replaceSessions(sessions: VideoSession[]): Promise<void> {
    await mutateSessions(() => ({ sessions, result: undefined }));
  }

  async function mutateSessions<T>(
    mutator: (
      sessions: VideoSession[],
    ) => SessionMutationResult<T> | Promise<SessionMutationResult<T>>,
  ): Promise<T> {
    return store.mutate(async (database) => {
      const mutation = await mutator(database.sessions);
      return {
        data: mutation.sessions === database.sessions
          ? database
          : { ...database, sessions: mutation.sessions },
        result: mutation.result,
      };
    });
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
