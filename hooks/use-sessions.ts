"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  addTag,
  createSession,
  createSessionWithVideo,
  deleteSession,
  deleteTag,
  importSessions,
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
      createSessionWithVideo,
      createSession,
      addTag,
      updateTag,
      deleteTag,
      deleteSession,
      updateSession,
      exportToCSV: () => exportSessionsToCsv(sessions),
      importSessions,
    }),
    [sessions],
  );
}
