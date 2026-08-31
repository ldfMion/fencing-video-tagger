import "server-only";

import { getSessionRepository } from "@/lib/server/session-repository";
import type { Tag, VideoSession } from "@/lib/types";

export interface TouchRepository {
  listTouches(sessionId: string): Promise<Tag[]>;
  getTouchById(sessionId: string, touchId: string): Promise<Tag | null>;
  createTouch(sessionId: string, touch: Tag): Promise<VideoSession>;
  updateTouch(sessionId: string, touch: Tag): Promise<VideoSession>;
  deleteTouch(sessionId: string, touchId: string): Promise<VideoSession>;
  mutateTouches(
    sessionId: string,
    mutator: (session: VideoSession, touches: Tag[]) => Tag[],
  ): Promise<VideoSession>;
}

let repository: TouchRepository | null = null;

export function getTouchRepository(): TouchRepository {
  repository ??= createTouchRepository();
  return repository;
}

function createTouchRepository(): TouchRepository {
  const sessions = getSessionRepository();

  async function listTouches(sessionId: string): Promise<Tag[]> {
    return (await requireSession(sessionId)).tags;
  }

  async function getTouchById(
    sessionId: string,
    touchId: string,
  ): Promise<Tag | null> {
    return (await listTouches(sessionId)).find((touch) => touch.id === touchId) ?? null;
  }

  async function createTouch(sessionId: string, touch: Tag): Promise<VideoSession> {
    return mutateTouches(sessionId, (_session, touches) => {
      if (touches.some((current) => current.id === touch.id)) {
        throw new Error(`Tag ${touch.id} already exists in session ${sessionId}`);
      }
      return [...touches, touch];
    });
  }

  async function updateTouch(sessionId: string, touch: Tag): Promise<VideoSession> {
    return mutateTouches(sessionId, (_session, touches) => {
      if (!touches.some((current) => current.id === touch.id)) {
        throw new Error(`Tag ${touch.id} was not found in session ${sessionId}`);
      }
      return touches.map((current) => current.id === touch.id ? touch : current);
    });
  }

  async function deleteTouch(
    sessionId: string,
    touchId: string,
  ): Promise<VideoSession> {
    return mutateTouches(sessionId, (_session, touches) => {
      const nextTouches = touches.filter((touch) => touch.id !== touchId);
      if (nextTouches.length === touches.length) {
        throw new Error(`Tag ${touchId} was not found in session ${sessionId}`);
      }
      return nextTouches;
    });
  }

  async function mutateTouches(
    sessionId: string,
    mutator: (session: VideoSession, touches: Tag[]) => Tag[],
  ): Promise<VideoSession> {
    return sessions.mutateSessions((records) => {
      const { index, session } = findSession(records, sessionId);
      const nextTouches = mutator(session, session.tags);
      return replace(records, index, {
        ...session,
        tags: nextTouches,
        lastModified: Date.now(),
      });
    });
  }

  async function requireSession(sessionId: string): Promise<VideoSession> {
    const session = await sessions.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} was not found`);
    }
    return session;
  }

  return {
    listTouches,
    getTouchById,
    createTouch,
    updateTouch,
    deleteTouch,
    mutateTouches,
  };
}

function findSession(records: VideoSession[], sessionId: string) {
  const index = records.findIndex((session) => session.id === sessionId);
  if (index === -1) {
    throw new Error(`Session ${sessionId} was not found`);
  }
  return { index, session: records[index] };
}

function replace(records: VideoSession[], index: number, session: VideoSession) {
  return {
    sessions: records.map((current, currentIndex) =>
      currentIndex === index ? session : current,
    ),
    result: session,
  };
}
