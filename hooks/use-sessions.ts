"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  Tag,
  VideoSession,
  Side,
  ActionCode,
  MistakeType,
} from "@/lib/types";

const STORAGE_KEY = "fencing-tags-sessions";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// In-memory store that syncs with localStorage
let sessions: VideoSession[] = [];
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// Old tag format for migration
interface LegacyTag {
  id: string;
  timestamp: number;
  text?: string;
  comment?: string;
  createdAt: number;
  side?: Side;
  action?: ActionCode;
  mistake?: MistakeType;
}

// Migrate old tag format (text -> comment)
function migrateTag(tag: LegacyTag): Tag {
  return {
    id: tag.id,
    timestamp: tag.timestamp,
    createdAt: tag.createdAt,
    comment: tag.comment ?? tag.text ?? "",
    side: tag.side,
    action: tag.action,
    mistake: tag.mistake,
  };
}

// Migrate session data from old format
function migrateSession(
  session: Omit<VideoSession, "tags"> & { tags: LegacyTag[] },
): VideoSession {
  return {
    ...session,
    tags: session.tags.map(migrateTag),
  };
}

function loadFromStorage(): VideoSession[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data) as VideoSession[];
    // Migrate old data format
    return parsed.map(migrateSession);
  } catch {
    return [];
  }
}

function saveToStorage(data: VideoSession[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

// Helper to format time for CSV
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Helper to escape CSV values
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface AddTagParams {
  comment: string;
  timestamp: number;
  side?: Side;
  action?: ActionCode;
  mistake?: MistakeType;
}

export interface UpdateSessionParams {
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string;
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

  const getOrCreateSession = useCallback(
    (fileName: string): VideoSession => {
      const existing = currentSessions.find((s) => s.fileName === fileName);
      if (existing) return existing;

      const newSession: VideoSession = {
        id: generateId(),
        fileName,
        tags: [],
        lastModified: Date.now(),
      };

      updateSessions((prev) => [...prev, newSession]);
      return newSession;
    },
    [currentSessions],
  );

  const addTag = useCallback((fileName: string, params: AddTagParams): Tag => {
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
      const sessionIndex = prev.findIndex((s) => s.fileName === fileName);

      if (sessionIndex === -1) {
        const newSession: VideoSession = {
          id: generateId(),
          fileName,
          tags: [tag],
          lastModified: Date.now(),
        };
        return [...prev, newSession];
      }

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
      fileName: string,
      tagId: string,
      updates: Partial<Omit<Tag, "id" | "createdAt">>,
    ): void => {
      updateSessions((prev) =>
        prev.map((s) =>
          s.fileName === fileName
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

  const deleteTag = useCallback((fileName: string, tagId: string): void => {
    updateSessions((prev) =>
      prev.map((s) =>
        s.fileName === fileName
          ? {
              ...s,
              tags: s.tags.filter((t) => t.id !== tagId),
              lastModified: Date.now(),
            }
          : s,
      ),
    );
  }, []);

  const deleteSession = useCallback((fileName: string): void => {
    updateSessions((prev) => prev.filter((s) => s.fileName !== fileName));
  }, []);

  const updateSession = useCallback(
    (fileName: string, updates: UpdateSessionParams): void => {
      updateSessions((prev) => {
        const exists = prev.some((s) => s.fileName === fileName);
        if (!exists) {
          // Create new session with the metadata
          const newSession: VideoSession = {
            id: generateId(),
            fileName,
            tags: [],
            lastModified: Date.now(),
            ...updates,
          };
          return [...prev, newSession];
        }
        return prev.map((s) =>
          s.fileName === fileName
            ? { ...s, ...updates, lastModified: Date.now() }
            : s,
        );
      });
    },
    [],
  );

  const exportToCSV = useCallback((): string => {
    const headers = [
      "bout_id",
      "file_name",
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
    ];

    const rows: string[][] = [headers];

    for (const session of currentSessions) {
      for (const tag of session.tags) {
        rows.push([
          session.id,
          escapeCSV(session.fileName),
          escapeCSV(session.leftFencer ?? ""),
          escapeCSV(session.rightFencer ?? ""),
          session.boutDate ?? "",
          tag.id,
          String(tag.timestamp),
          formatTime(tag.timestamp),
          tag.side ?? "",
          tag.action ?? "",
          escapeCSV(tag.comment),
          tag.mistake ?? "",
        ]);
      }
    }

    return rows.map((row) => row.join(",")).join("\n");
  }, [currentSessions]);

  return {
    sessions: currentSessions,
    getSession,
    getOrCreateSession,
    addTag,
    updateTag,
    deleteTag,
    deleteSession,
    updateSession,
    exportToCSV,
  };
}
