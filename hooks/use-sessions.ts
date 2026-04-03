"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  addTag,
  attachLibraryVideo,
  clearLibraryVideo,
  createSession,
  createSessionWithLibraryVideo,
  createSessionWithVideo,
  deleteSession,
  deleteTag,
  importSessions,
  setTemporaryVideoMetadata,
  type AddTagParams,
  type UpdateSessionParams,
  updateSession,
  updateTag,
} from "@/lib/session-service";
import { exportSessionsToCsv } from "@/lib/session-export";
import {
  getAllFencerNames,
  getSessionByFileName,
  getSessionById,
} from "@/lib/session-selectors";
import {
  getSessionStoreServerSnapshot,
  getSessionStoreSnapshot,
  subscribeToSessionStore,
} from "@/lib/session-store";

export type { AddTagParams, UpdateSessionParams };

export function useSessions() {
  const sessions = useSyncExternalStore(
    subscribeToSessionStore,
    getSessionStoreSnapshot,
    getSessionStoreServerSnapshot,
  );

  return useMemo(
    () => ({
      sessions,
      allFencerNames: getAllFencerNames(sessions),
      getSession: (fileName: string) => getSessionByFileName(sessions, fileName),
      getSessionById: (id: string) => getSessionById(sessions, id),
      createSessionWithLibraryVideo,
      createSessionWithVideo,
      createSession,
      addTag,
      updateTag,
      deleteTag,
      deleteSession,
      attachLibraryVideo,
      clearLibraryVideo,
      setTemporaryVideoMetadata,
      updateSession,
      exportToCSV: () => exportSessionsToCsv(sessions),
      importSessions,
    }),
    [sessions],
  );
}
