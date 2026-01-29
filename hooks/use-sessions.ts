"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Tag, VideoSession } from "@/lib/types";

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

function loadFromStorage(): VideoSession[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
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

  const addTag = useCallback(
    (fileName: string, text: string, timestamp: number): Tag => {
      const tag: Tag = {
        id: generateId(),
        timestamp,
        text,
        createdAt: Date.now(),
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

  return {
    sessions: currentSessions,
    getSession,
    getOrCreateSession,
    addTag,
    deleteTag,
    deleteSession,
  };
}
