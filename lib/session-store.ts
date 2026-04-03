import { z } from "zod";
import {
  type Tag,
  type VideoSession,
  CURRENT_SCHEMA_VERSION,
  StorageEnvelopeSchema,
  TagSchema,
  VideoSessionSchema,
} from "@/lib/types";

const STORAGE_KEY = "fencing-tags-sessions";
const EMPTY_SESSIONS: VideoSession[] = [];

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

type StoreListener = () => void;

let currentSessions: VideoSession[] = EMPTY_SESSIONS;
let listeners: StoreListener[] = [];
let initialized = false;
let storageListenerAttached = false;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function migrateV0(raw: unknown): VideoSession[] {
  const result = z.array(LegacySessionSchema).safeParse(raw);
  return result.success ? result.data : [];
}

function parseSessionsFromRaw(
  raw: unknown,
): { sessions: VideoSession[]; migrated: boolean } {
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

function writeSessionsToStorage(sessions: VideoSession[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: CURRENT_SCHEMA_VERSION,
      sessions,
    }),
  );
}

function readSessionsFromStorage(): VideoSession[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = parseSessionsFromRaw(JSON.parse(stored));

    if (parsed.migrated) {
      writeSessionsToStorage(parsed.sessions);
    }

    return parsed.sessions;
  } catch {
    return [];
  }
}

function syncSessionsFromStorageValue(newValue: string | null) {
  try {
    const nextSessions =
      newValue == null
        ? []
        : parseSessionsFromRaw(JSON.parse(newValue)).sessions;

    currentSessions = nextSessions;
    emitChange();
  } catch {
    currentSessions = [];
    emitChange();
  }
}

function ensureInitialized() {
  if (typeof window === "undefined") {
    return;
  }

  if (!initialized) {
    currentSessions = readSessionsFromStorage();
    initialized = true;
  }

  if (!storageListenerAttached) {
    window.addEventListener("storage", (event) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (event.key !== STORAGE_KEY) {
        return;
      }

      syncSessionsFromStorageValue(event.newValue);
    });

    storageListenerAttached = true;
  }
}

export function subscribeToSessionStore(listener: StoreListener) {
  ensureInitialized();
  listeners = [...listeners, listener];

  return () => {
    listeners = listeners.filter((currentListener) => currentListener !== listener);
  };
}

export function getSessionStoreSnapshot(): VideoSession[] {
  ensureInitialized();
  return currentSessions;
}

export function getSessionStoreServerSnapshot(): VideoSession[] {
  return EMPTY_SESSIONS;
}

export function updateSessionStore(
  updater: (previousSessions: VideoSession[]) => VideoSession[],
): VideoSession[] {
  ensureInitialized();

  const nextSessions = updater(currentSessions);

  if (nextSessions === currentSessions) {
    return currentSessions;
  }

  currentSessions = nextSessions;
  writeSessionsToStorage(currentSessions);
  emitChange();

  return currentSessions;
}
