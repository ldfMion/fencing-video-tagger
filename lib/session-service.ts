import { z } from "zod";
import { deriveBoutDateFromFileMetadata } from "@/lib/date-utils";
import type { VideoLibraryItem } from "@/lib/video-library";
import {
  type ActionCode,
  CURRENT_SCHEMA_VERSION,
  type MistakeType,
  StorageEnvelopeSchema,
  type StorageEnvelope,
  type Tag,
  TagSchema,
  type Side,
  type VideoSession,
  VideoSessionSchema,
  type VideoSourceType,
} from "@/lib/types";

export const SESSION_STORAGE_KEY = "fencing-tags-sessions";
export const SESSION_MIGRATION_FLAG_KEY = "fencing-tags-session-migration-state";

const LegacyTagSchema = z
  .object({
    id: z.string(),
    timestamp: z.number(),
    createdAt: z.number(),
    text: z.string().optional(),
    comment: z.string().optional(),
    side: z.enum(["L", "R"]).optional(),
    action: z.string().optional(),
    mistake: z.enum(["tactical", "execution"]).optional(),
  })
  .transform(
    (tag): z.input<typeof TagSchema> => ({
      id: tag.id,
      timestamp: tag.timestamp,
      createdAt: tag.createdAt,
      comment: tag.comment ?? tag.text ?? "",
      side: tag.side,
      action: tag.action as Tag["action"],
      mistake: tag.mistake,
    }),
  );

const LegacySessionSchema = z
  .object({
    id: z.string(),
    fileName: z.string(),
    tags: z.array(LegacyTagSchema),
    lastModified: z.number(),
    leftFencer: z.string().optional(),
    rightFencer: z.string().optional(),
    boutDate: z.string().optional(),
  })
  .transform(
    (session): z.input<typeof VideoSessionSchema> => ({
      ...session,
    }),
  );

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

export interface SessionDraftParams {
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string;
  externalSource?: string;
}

export type SessionMetadataParams = Partial<
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

export type SessionVideoSelection =
  | { kind: "none" }
  | { kind: "library"; video: VideoLibraryItem }
  | { kind: "temporary"; file: File };

export type PersistedSessionVideoSelection = Exclude<
  SessionVideoSelection,
  { kind: "temporary" }
>;

export type ServerSessionVideoSelection =
  | PersistedSessionVideoSelection
  | { kind: "temporary"; fileName: string; fileLastModified?: number };

export interface ParsedStoredSessions {
  sessions: VideoSession[];
  migrated: boolean;
}

interface CreateSessionRecordOptions {
  now?: number;
  sessionId?: string;
}

interface CreateTagRecordOptions {
  createdAt?: number;
  seq?: number;
  tagId?: string;
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function generateTagId(): string {
  return crypto.randomUUID();
}

export function createStorageEnvelope(
  sessions: VideoSession[],
): StorageEnvelope {
  return {
    version: CURRENT_SCHEMA_VERSION,
    sessions,
  };
}

export function withDefinedValues<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, itemValue]) => itemValue !== undefined),
  ) as Partial<T>;
}

export function createSessionRecord(
  params?: SessionMetadataParams,
  options?: CreateSessionRecordOptions,
): VideoSession {
  return {
    id: options?.sessionId ?? generateSessionId(),
    tags: [],
    lastModified: options?.now ?? Date.now(),
    ...withDefinedValues(params ?? {}),
  };
}

export function createSessionRecordWithTemporaryVideo(
  fileName: string,
  fileLastModified?: number,
  params?: SessionMetadataParams,
  options?: CreateSessionRecordOptions,
): VideoSession {
  const derivedBoutDate = deriveBoutDateFromFileMetadata(fileLastModified);

  return createSessionRecord(
    {
      ...params,
      fileName,
      videoSourceType: "temporary",
      boutDate: params?.boutDate ?? derivedBoutDate,
    },
    options,
  );
}

export function createSessionRecordWithLibraryVideo(
  video: VideoLibraryItem,
  params?: SessionMetadataParams,
  options?: CreateSessionRecordOptions,
): VideoSession {
  return createSessionRecord(
    {
      ...params,
      fileName: video.fileName,
      videoRelativePath: video.relativePath,
      videoMimeType: video.mimeType,
      videoSourceType: "library",
    },
    options,
  );
}

export function createTagRecord(
  params: AddTagParams,
  options?: CreateTagRecordOptions,
): Tag {
  return {
    id: options?.tagId ?? generateTagId(),
    timestamp: params.timestamp,
    seq: options?.seq,
    comment: params.comment,
    createdAt: options?.createdAt ?? Date.now(),
    side: params.side,
    action: params.action,
    mistake: params.mistake,
  };
}

export function computeNextTagSequence(session: VideoSession): number {
  const sequences = session.tags
    .map((tag) => tag.seq)
    .filter((seq): seq is number => seq != null);

  return sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
}

export function applySessionUpdates(
  session: VideoSession,
  updates: UpdateSessionParams,
  now = Date.now(),
): VideoSession {
  const nextSession = {
    ...session,
    lastModified: now,
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

export function attachLibraryVideoToSession(
  session: VideoSession,
  video: VideoLibraryItem,
  now = Date.now(),
): VideoSession {
  return applySessionUpdates(
    session,
    {
      fileName: video.fileName,
      videoRelativePath: video.relativePath,
      videoMimeType: video.mimeType,
      videoSourceType: "library",
    },
    now,
  );
}

export function clearSessionVideoFromSession(
  session: VideoSession,
  now = Date.now(),
): VideoSession {
  return applySessionUpdates(
    session,
    {
      fileName: null,
      videoRelativePath: null,
      videoMimeType: null,
      videoSourceType: null,
    },
    now,
  );
}

export function setTemporaryVideoMetadataOnSession(
  session: VideoSession,
  fileName: string,
  fileLastModified?: number,
  now = Date.now(),
): VideoSession {
  if (session.videoRelativePath) {
    return session;
  }

  return applySessionUpdates(
    session,
    {
      fileName,
      videoSourceType: "temporary",
      boutDate: session.boutDate ?? deriveBoutDateFromFileMetadata(fileLastModified),
    },
    now,
  );
}

function migrateV0(raw: unknown): VideoSession[] {
  const result = z.array(LegacySessionSchema).safeParse(raw);
  return result.success ? result.data : [];
}

export function parseStoredSessionsFromRaw(raw: unknown): ParsedStoredSessions {
  const envelope = StorageEnvelopeSchema.safeParse(raw);

  if (envelope.success) {
    return {
      sessions: envelope.data.sessions,
      migrated: false,
    };
  }

  if (Array.isArray(raw)) {
    return {
      sessions: migrateV0(raw),
      migrated: true,
    };
  }

  return {
    sessions: [],
    migrated: false,
  };
}
