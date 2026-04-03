"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  addTag,
  attachLibraryVideo,
  clearSessionVideo,
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
import type { VideoLibraryItem } from "@/lib/video-library";

export type { AddTagParams, UpdateSessionParams };

export interface SessionDraftParams {
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string;
  externalSource?: string;
}

export type SessionVideoSelection =
  | { kind: "none" }
  | { kind: "library"; video: VideoLibraryItem }
  | { kind: "temporary"; file: File };

export type PersistedSessionVideoSelection = Exclude<
  SessionVideoSelection,
  { kind: "temporary" }
>;

const NO_VIDEO_SELECTION: PersistedSessionVideoSelection = { kind: "none" };

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
      createSessionEntry: (
        params: SessionDraftParams = {},
        videoSelection: SessionVideoSelection = NO_VIDEO_SELECTION,
      ) => {
        switch (videoSelection.kind) {
          case "library":
            return createSessionWithLibraryVideo(videoSelection.video, params);
          case "temporary":
            return createSessionWithVideo(
              videoSelection.file.name,
              videoSelection.file.lastModified,
              params,
            );
          case "none":
          default:
            return createSession(params);
        }
      },
      updateSessionEntry: (
        sessionId: string,
        params: UpdateSessionParams,
        videoSelection?: PersistedSessionVideoSelection,
      ) => {
        updateSession(sessionId, params);

        if (videoSelection) {
          switch (videoSelection.kind) {
            case "library":
              attachLibraryVideo(sessionId, videoSelection.video);
              break;
            case "none":
            default:
              clearSessionVideo(sessionId);
              break;
          }
        }
      },
      setSessionVideoSelection: (
        sessionId: string,
        videoSelection: SessionVideoSelection | PersistedSessionVideoSelection,
      ) => {
        switch (videoSelection.kind) {
          case "library":
            attachLibraryVideo(sessionId, videoSelection.video);
            break;
          case "temporary":
            setTemporaryVideoMetadata(
              sessionId,
              videoSelection.file.name,
              videoSelection.file.lastModified,
            );
            break;
          case "none":
          default:
            clearSessionVideo(sessionId);
            break;
        }
      },
      addTag,
      updateTag,
      deleteTag,
      deleteSession,
      exportToCSV: () => exportSessionsToCsv(sessions),
      importSessions,
    }),
    [sessions],
  );
}
