import type {
  Tag,
  VideoSession,
  Side,
  ActionCode,
  MistakeType,
  VideoSourceType,
} from "@/lib/types";
import { deriveBoutDateFromFileMetadata } from "@/lib/date-utils";
import { getSessionStoreSnapshot, updateSessionStore } from "@/lib/session-store";
import type { VideoLibraryItem } from "@/lib/video-library";

type SessionMetadataParams = Partial<
  Pick<
    VideoSession,
    | "fileName"
    | "videoRelativePath"
    | "videoMimeType"
    | "videoSourceType"
    | "leftFencer"
    | "rightFencer"
    | "boutDate"
    | "externalSource"
  >
>;

function generateId(): string {
  return crypto.randomUUID();
}

function withDefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, itemValue]) => itemValue !== undefined),
  ) as Partial<T>;
}

function createSessionRecord(params?: SessionMetadataParams): VideoSession {
  return {
    id: generateId(),
    tags: [],
    lastModified: Date.now(),
    ...withDefinedValues(params ?? {}),
  };
}

function createSessionRecordWithTemporaryVideo(
  fileName: string,
  fileLastModified?: number,
  params?: SessionMetadataParams,
): VideoSession {
  const derivedBoutDate = deriveBoutDateFromFileMetadata(fileLastModified);

  return createSessionRecord({
    ...params,
    fileName,
    videoSourceType: "temporary",
    boutDate: params?.boutDate ?? derivedBoutDate,
  });
}

function createSessionRecordWithLibraryVideo(
  video: VideoLibraryItem,
  params?: SessionMetadataParams,
): VideoSession {
  return createSessionRecord({
    ...params,
    fileName: video.fileName,
    videoRelativePath: video.relativePath,
    videoMimeType: video.mimeType,
    videoSourceType: "library",
  });
}

function computeNextTagSequence(session: VideoSession): number {
  const sequences = session.tags
    .map((tag) => tag.seq)
    .filter((seq): seq is number => seq != null);

  return sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
}

export interface AddTagParams {
  comment: string;
  timestamp?: number;
  side?: Side;
  action?: ActionCode;
  mistake?: MistakeType;
}

export interface UpdateSessionParams {
  fileName?: string | null;
  videoRelativePath?: string | null;
  videoMimeType?: string | null;
  videoSourceType?: VideoSourceType | null;
  leftFencer?: string | null;
  rightFencer?: string | null;
  boutDate?: string | null;
  externalSource?: string | null;
}

export function createSession(
  params?: SessionMetadataParams,
): VideoSession {
  const session = createSessionRecord(params);

  updateSessionStore((previousSessions) => [...previousSessions, session]);

  return session;
}

export function createSessionWithTemporaryVideo(
  fileName: string,
  fileLastModified?: number,
  params?: SessionMetadataParams,
): VideoSession {
  const session = createSessionRecordWithTemporaryVideo(
    fileName,
    fileLastModified,
    params,
  );

  updateSessionStore((previousSessions) => [...previousSessions, session]);

  return session;
}

export function createSessionWithLibraryVideo(
  video: VideoLibraryItem,
  params?: SessionMetadataParams,
): VideoSession {
  const session = createSessionRecordWithLibraryVideo(video, params);

  updateSessionStore((previousSessions) => [...previousSessions, session]);

  return session;
}

export const createSessionWithVideo = createSessionWithTemporaryVideo;

export function addTag(sessionId: string, params: AddTagParams): Tag {
  let newTag: Tag = {
    id: generateId(),
    timestamp: params.timestamp,
    comment: params.comment,
    createdAt: Date.now(),
    side: params.side,
    action: params.action,
    mistake: params.mistake,
  };

  updateSessionStore((previousSessions) => {
    const sessionIndex = previousSessions.findIndex((session) => session.id === sessionId);

    if (sessionIndex === -1) {
      return previousSessions;
    }

    const session = previousSessions[sessionIndex];
    newTag = {
      ...newTag,
      seq: computeNextTagSequence(session),
    };

    return previousSessions.map((currentSession, index) =>
      index === sessionIndex
        ? {
            ...currentSession,
            tags: [...currentSession.tags, newTag],
            lastModified: Date.now(),
          }
        : currentSession,
    );
  });

  return newTag;
}

export function updateTag(
  sessionId: string,
  tagId: string,
  updates: Partial<Omit<Tag, "id" | "createdAt">>,
): void {
  updateSessionStore((previousSessions) =>
    previousSessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            tags: session.tags.map((tag) =>
              tag.id === tagId ? { ...tag, ...updates } : tag,
            ),
            lastModified: Date.now(),
          }
        : session,
    ),
  );
}

export function deleteTag(sessionId: string, tagId: string): void {
  updateSessionStore((previousSessions) =>
    previousSessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            tags: session.tags.filter((tag) => tag.id !== tagId),
            lastModified: Date.now(),
          }
        : session,
    ),
  );
}

export function deleteSession(sessionId: string): void {
  updateSessionStore((previousSessions) =>
    previousSessions.filter((session) => session.id !== sessionId),
  );
}

export function updateSession(
  sessionId: string,
  updates: UpdateSessionParams,
): void {
  updateSessionStore((previousSessions) =>
    previousSessions.map((session) =>
      session.id === sessionId ? applySessionUpdates(session, updates) : session,
    ),
  );
}

function applySessionUpdates(
  session: VideoSession,
  updates: UpdateSessionParams,
): VideoSession {
  const nextSession = {
    ...session,
    lastModified: Date.now(),
  } as VideoSession & Record<string, unknown>;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }

    if (value === null) {
      delete nextSession[key];
      continue;
    }

    nextSession[key] = value;
  }

  return nextSession;
}

export function attachLibraryVideo(
  sessionId: string,
  video: VideoLibraryItem,
): void {
  updateSession(sessionId, {
    fileName: video.fileName,
    videoRelativePath: video.relativePath,
    videoMimeType: video.mimeType,
    videoSourceType: "library",
  });
}

export function clearLibraryVideo(sessionId: string): void {
  updateSession(sessionId, {
    fileName: null,
    videoRelativePath: null,
    videoMimeType: null,
    videoSourceType: null,
  });
}

export function setTemporaryVideoMetadata(
  sessionId: string,
  fileName: string,
  fileLastModified?: number,
): void {
  const session = getSessionStoreSnapshot().find((current) => current.id === sessionId);

  if (!session || session.videoRelativePath) {
    return;
  }

  updateSession(sessionId, {
    fileName,
    videoSourceType: "temporary",
    boutDate: session.boutDate ?? deriveBoutDateFromFileMetadata(fileLastModified),
  });
}

export function importSessions(
  incomingSessions: VideoSession[],
): { imported: number; skipped: number } {
  let result = { imported: 0, skipped: incomingSessions.length };

  updateSessionStore((previousSessions) => {
    const existingIds = new Set(previousSessions.map((session) => session.id));
    const newSessions = incomingSessions.filter(
      (session) => !existingIds.has(session.id),
    );

    result = {
      imported: newSessions.length,
      skipped: incomingSessions.length - newSessions.length,
    };

    return newSessions.length > 0
      ? [...previousSessions, ...newSessions]
      : previousSessions;
  });

  return result;
}

export function getCurrentSessions(): VideoSession[] {
  return getSessionStoreSnapshot();
}
