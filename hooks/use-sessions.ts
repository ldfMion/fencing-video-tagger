"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  type Tag,
  type VideoSession,
  type Side,
  type ActionCode,
  type MistakeType,
  TagSchema,
  VideoSessionSchema,
  StorageEnvelopeSchema,
  CURRENT_SCHEMA_VERSION,
} from "@/lib/types";
import { formatTime } from "@/lib/utils";

const STORAGE_KEY = "fencing-tags-sessions";

function generateId(): string {
  return crypto.randomUUID();
}

// In-memory store that syncs with localStorage
let sessions: VideoSession[] = [];
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// --- v0 legacy schemas (bare array with tag.text instead of tag.comment) ---

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

// --- Migration pipeline ---

function migrateV0(raw: unknown): VideoSession[] {
  const result = z.array(LegacySessionSchema).safeParse(raw);
  return result.success ? result.data : [];
}

function loadFromStorage(): VideoSession[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const raw = JSON.parse(data);

    // Try versioned envelope first
    const envelope = StorageEnvelopeSchema.safeParse(raw);
    if (envelope.success) {
      return envelope.data.sessions;
    }

    // Bare array → v0 legacy format
    if (Array.isArray(raw)) {
      const migrated = migrateV0(raw);
      // Re-save in versioned envelope format
      saveToStorage(migrated);
      return migrated;
    }

    return [];
  } catch {
    return [];
  }
}

function saveToStorage(data: VideoSession[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: CURRENT_SCHEMA_VERSION, sessions: data }),
  );
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): VideoSession[] {
  return sessions;
}

// variable to satisfy the "The result of getServerSnapshot should be cached to avoid an infinite loop" error
const emptyArray: VideoSession[] = [];

function getServerSnapshot(): VideoSession[] {
  return emptyArray;
}

// Initialize from localStorage on client
if (typeof window !== "undefined") {
  sessions = loadFromStorage();
}

function updateSessions(updater: (prev: VideoSession[]) => VideoSession[]) {
  sessions = updater(sessions);
  saveToStorage(sessions);
  emitChange();
}

// Helper to escape CSV values
function escapeCSV(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export interface AddTagParams {
  comment: string;
  timestamp?: number;
  side?: Side;
  action?: ActionCode;
  mistake?: MistakeType;
}

export interface UpdateSessionParams {
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string;
  externalSource?: string;
}

export function useSessions() {
  const currentSessions = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const getSession = useCallback(
    (fileName: string): VideoSession | undefined => {
      return currentSessions.find((s) => s.fileName === fileName);
    },
    [currentSessions],
  );

  const getSessionById = useCallback(
    (id: string): VideoSession | undefined => {
      return currentSessions.find((s) => s.id === id);
    },
    [currentSessions],
  );

  const getOrCreateSession = useCallback(
    (fileName: string, fileLastModified?: number): VideoSession => {
      const existing = currentSessions.find((s) => s.fileName === fileName);
      if (existing) return existing;

      const newSession: VideoSession = {
        id: generateId(),
        fileName,
        tags: [],
        lastModified: Date.now(),
        ...(fileLastModified != null && {
          boutDate: new Date(fileLastModified).toISOString().split("T")[0],
        }),
      };

      updateSessions((prev) => [...prev, newSession]);
      return newSession;
    },
    [currentSessions],
  );

  const createSession = useCallback(
    (
      params?: Partial<
        Pick<
          VideoSession,
          "leftFencer" | "rightFencer" | "boutDate" | "externalSource"
        >
      >
    ): VideoSession => {
      const newSession: VideoSession = {
        id: generateId(),
        tags: [],
        lastModified: Date.now(),
        ...params,
      };

      updateSessions((prev) => [...prev, newSession]);
      return newSession;
    },
    []
  );

  const addTag = useCallback((sessionId: string, params: AddTagParams): Tag => {
    // Compute seq from existing tags
    const computeSeq = (session: VideoSession) => {
      const existingSeqs = session.tags
        .map((t) => t.seq)
        .filter((s) => s != null) as number[];
      return existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : 1;
    };

    let newSeq: number | undefined;

    const tag: Tag = {
      id: generateId(),
      timestamp: params.timestamp,
      comment: params.comment,
      createdAt: Date.now(),
      side: params.side,
      action: params.action,
      mistake: params.mistake,
    };

    updateSessions((prev) => {
      const sessionIndex = prev.findIndex((s) => s.id === sessionId);

      if (sessionIndex === -1) {
        return prev; // Session not found, no-op
      }

      const session = prev[sessionIndex];
      newSeq = computeSeq(session);
      tag.seq = newSeq;

      return prev.map((s, i) =>
        i === sessionIndex
          ? { ...s, tags: [...s.tags, tag], lastModified: Date.now() }
          : s,
      );
    });

    return tag;
  }, []);

  const updateTag = useCallback(
    (
      sessionId: string,
      tagId: string,
      updates: Partial<Omit<Tag, "id" | "createdAt">>,
    ): void => {
      updateSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                tags: s.tags.map((t) =>
                  t.id === tagId ? { ...t, ...updates } : t,
                ),
                lastModified: Date.now(),
              }
            : s,
        ),
      );
    },
    [],
  );

  const deleteTag = useCallback((sessionId: string, tagId: string): void => {
    updateSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              tags: s.tags.filter((t) => t.id !== tagId),
              lastModified: Date.now(),
            }
          : s,
      ),
    );
  }, []);

  const deleteSession = useCallback((sessionId: string): void => {
    updateSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const updateSession = useCallback(
    (sessionId: string, updates: UpdateSessionParams): void => {
      updateSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, ...updates, lastModified: Date.now() }
            : s,
        ),
      );
    },
    [],
  );

  const exportToCSV = useCallback((): string => {
    const headers = [
      "bout_id",
      "file_name",
      "external_source",
      "left_fencer",
      "right_fencer",
      "bout_date",
      "touch_id",
      "timestamp",
      "timestamp_formatted",
      "side",
      "action",
      "comment",
      "mistake",
      "created_at",
    ];

    const rows: string[][] = [headers];

    for (const session of currentSessions) {
      for (const tag of session.tags) {
        rows.push([
          escapeCSV(session.id),
          escapeCSV(session.fileName ?? ""),
          escapeCSV(session.externalSource ?? ""),
          escapeCSV(session.leftFencer ?? ""),
          escapeCSV(session.rightFencer ?? ""),
          escapeCSV(session.boutDate ?? ""),
          escapeCSV(tag.id),
          escapeCSV(tag.timestamp != null ? String(tag.timestamp) : ""),
          escapeCSV(tag.timestamp != null ? formatTime(tag.timestamp) : ""),
          escapeCSV(tag.side ?? ""),
          escapeCSV(tag.action ?? ""),
          escapeCSV(tag.comment),
          escapeCSV(tag.mistake ?? ""),
          escapeCSV(tag.createdAt ? new Date(tag.createdAt).toISOString() : ""),
        ]);
      }
    }

    return rows.map((row) => row.join(",")).join("\n");
  }, [currentSessions]);

  const allFencerNames = useMemo(() => {
    const names = new Set<string>();
    for (const session of currentSessions) {
      if (session.leftFencer?.trim()) names.add(session.leftFencer.trim());
      if (session.rightFencer?.trim()) names.add(session.rightFencer.trim());
    }
    return Array.from(names).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [currentSessions]);

  return {
    sessions: currentSessions,
    allFencerNames,
    getSession,
    getSessionById,
    getOrCreateSession,
    createSession,
    addTag,
    updateTag,
    deleteTag,
    deleteSession,
    updateSession,
    exportToCSV,
  };
}
