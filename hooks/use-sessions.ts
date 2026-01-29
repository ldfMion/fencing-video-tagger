"use client";

import { useState, useEffect, useCallback } from "react";
import type { Tag, VideoSession } from "@/lib/types";

const STORAGE_KEY = "fencing-tags-sessions";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function loadSessions(): VideoSession[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: VideoSession[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function useSessions() {
  const [sessions, setSessions] = useState<VideoSession[]>([]);

  // Load sessions from localStorage on mount
  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const getSession = useCallback(
    (fileName: string): VideoSession | undefined => {
      return sessions.find((s) => s.fileName === fileName);
    },
    [sessions]
  );

  const getOrCreateSession = useCallback(
    (fileName: string): VideoSession => {
      const existing = sessions.find((s) => s.fileName === fileName);
      if (existing) return existing;

      const newSession: VideoSession = {
        id: generateId(),
        fileName,
        tags: [],
        lastModified: Date.now(),
      };

      const updated = [...sessions, newSession];
      setSessions(updated);
      saveSessions(updated);
      return newSession;
    },
    [sessions]
  );

  const addTag = useCallback(
    (fileName: string, text: string, timestamp: number): Tag => {
      const tag: Tag = {
        id: generateId(),
        timestamp,
        text,
        createdAt: Date.now(),
      };

      setSessions((prev) => {
        const sessionIndex = prev.findIndex((s) => s.fileName === fileName);
        let updated: VideoSession[];

        if (sessionIndex === -1) {
          // Create new session with this tag
          const newSession: VideoSession = {
            id: generateId(),
            fileName,
            tags: [tag],
            lastModified: Date.now(),
          };
          updated = [...prev, newSession];
        } else {
          // Add tag to existing session
          updated = prev.map((s, i) =>
            i === sessionIndex
              ? { ...s, tags: [...s.tags, tag], lastModified: Date.now() }
              : s
          );
        }

        saveSessions(updated);
        return updated;
      });

      return tag;
    },
    []
  );

  const deleteTag = useCallback((fileName: string, tagId: string): void => {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.fileName === fileName
          ? {
              ...s,
              tags: s.tags.filter((t) => t.id !== tagId),
              lastModified: Date.now(),
            }
          : s
      );
      saveSessions(updated);
      return updated;
    });
  }, []);

  const deleteSession = useCallback((fileName: string): void => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.fileName !== fileName);
      saveSessions(updated);
      return updated;
    });
  }, []);

  return {
    sessions,
    getSession,
    getOrCreateSession,
    addTag,
    deleteTag,
    deleteSession,
  };
}
