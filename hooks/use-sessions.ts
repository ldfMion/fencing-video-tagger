"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  addTagAction,
  createSessionAction,
  deleteSessionAction,
  deleteTagAction,
  importSessionsAction,
  updateSessionAction,
  updateTagAction,
} from "@/app/actions/session-actions";
import { exportSessionsToCsv } from "@/lib/session-export";
import {
  AddTagParams,
  applySessionUpdates,
  attachLibraryVideoToSession,
  clearSessionVideoFromSession,
  computeNextTagSequence,
  createSessionRecord,
  createSessionRecordWithLibraryVideo,
  createSessionRecordWithTemporaryVideo,
  createTagRecord,
  type PersistedSessionVideoSelection,
  type SessionDraftParams,
  type SessionVideoSelection,
  setTemporaryVideoMetadataOnSession,
  type ServerSessionVideoSelection,
  UpdateSessionParams,
} from "@/lib/session-service";
import {
  getAllFencerNames,
  getSessionById as selectSessionById,
} from "@/lib/session-selectors";
import type { VideoSession } from "@/lib/types";
import { useSessionsQuery, sessionsQueryKey } from "@/hooks/use-sessions-query";

export type {
  AddTagParams,
  PersistedSessionVideoSelection,
  SessionDraftParams,
  SessionVideoSelection,
  UpdateSessionParams,
};

const NO_VIDEO_SELECTION: PersistedSessionVideoSelection = { kind: "none" };

interface CreateSessionEntryOptions {
  sessionId?: string;
}

export function useSessions(initialSessions?: VideoSession[]) {
  const queryClient = useQueryClient();
  const { sessions, status, error } = useSessionsQuery(initialSessions);

  const getCachedSessions = useCallback(
    () =>
      queryClient.getQueryData<VideoSession[]>(sessionsQueryKey) ??
      initialSessions ??
      [],
    [initialSessions, queryClient],
  );

  const setCachedSessions = useCallback(
    (
      updater:
        | VideoSession[]
        | ((previousSessions: VideoSession[]) => VideoSession[]),
    ) => {
      queryClient.setQueryData<VideoSession[]>(sessionsQueryKey, (previousSessions) => {
        const currentSessions = previousSessions ?? initialSessions ?? [];
        return typeof updater === "function"
          ? updater(currentSessions)
          : updater;
      });
    },
    [initialSessions, queryClient],
  );

  const getSessionById = useCallback(
    (sessionId: string) => selectSessionById(getCachedSessions(), sessionId),
    [getCachedSessions],
  );

  const createSessionEntry = useCallback(
    async (
      params: SessionDraftParams = {},
      videoSelection: SessionVideoSelection = NO_VIDEO_SELECTION,
      options?: CreateSessionEntryOptions,
    ) => {
      const previousSessions = getCachedSessions();
      const optimisticSessionId = options?.sessionId ?? crypto.randomUUID();
      const optimisticSession = createOptimisticSession(
        params,
        videoSelection,
        optimisticSessionId,
      );

      setCachedSessions((currentSessions) => [...currentSessions, optimisticSession]);

      try {
        const serverSession = await createSessionAction({
          sessionId: optimisticSessionId,
          params,
          videoSelection: serializeVideoSelection(videoSelection),
        });

        setCachedSessions((currentSessions) =>
          replaceSession(currentSessions, optimisticSessionId, serverSession),
        );

        return serverSession;
      } catch (mutationError) {
        setCachedSessions(previousSessions);
        throw mutationError;
      }
    },
    [getCachedSessions, setCachedSessions],
  );

  const updateSessionEntry = useCallback(
    async (
      sessionId: string,
      params: SessionDraftParams,
      videoSelection?: PersistedSessionVideoSelection,
    ) => {
      const previousSessions = getCachedSessions();
      const currentSession = selectSessionById(previousSessions, sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      let optimisticSession = applySessionDraftUpdates(currentSession, params);

      if (videoSelection) {
        optimisticSession = applyPersistedVideoSelection(
          optimisticSession,
          videoSelection,
        );
      }

      const updates = deriveSessionUpdates(currentSession, optimisticSession);

      if (Object.keys(updates).length === 0) {
        return currentSession;
      }

      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );

      try {
        const serverSession = await updateSessionAction({
          sessionId,
          updates,
        });

        setCachedSessions((currentSessions) =>
          replaceSession(currentSessions, sessionId, serverSession),
        );

        return serverSession;
      } catch (mutationError) {
        setCachedSessions(previousSessions);
        throw mutationError;
      }
    },
    [getCachedSessions, setCachedSessions],
  );

  const setSessionVideoSelection = useCallback(
    async (
      sessionId: string,
      videoSelection: SessionVideoSelection | PersistedSessionVideoSelection,
    ) => {
      const previousSessions = getCachedSessions();
      const currentSession = selectSessionById(previousSessions, sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const optimisticSession = applyVideoSelection(currentSession, videoSelection);
      const updates = deriveSessionUpdates(currentSession, optimisticSession);

      if (Object.keys(updates).length === 0) {
        return currentSession;
      }

      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );

      try {
        const serverSession = await updateSessionAction({
          sessionId,
          updates,
        });

        setCachedSessions((currentSessions) =>
          replaceSession(currentSessions, sessionId, serverSession),
        );

        return serverSession;
      } catch (mutationError) {
        setCachedSessions(previousSessions);
        throw mutationError;
      }
    },
    [getCachedSessions, setCachedSessions],
  );

  const addTag = useCallback(
    async (sessionId: string, params: AddTagParams) => {
      const previousSessions = getCachedSessions();
      const currentSession = selectSessionById(previousSessions, sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const optimisticTag = createTagRecord(params, {
        tagId: crypto.randomUUID(),
        createdAt: Date.now(),
        seq: computeNextTagSequence(currentSession),
      });
      const optimisticSession: VideoSession = {
        ...currentSession,
        tags: [...currentSession.tags, optimisticTag],
        lastModified: Date.now(),
      };

      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );

      try {
        const serverSession = await addTagAction({
          sessionId,
          tagId: optimisticTag.id,
          createdAt: optimisticTag.createdAt,
          params,
        });

        setCachedSessions((currentSessions) =>
          replaceSession(currentSessions, sessionId, serverSession),
        );

        return serverSession;
      } catch (mutationError) {
        setCachedSessions(previousSessions);
        throw mutationError;
      }
    },
    [getCachedSessions, setCachedSessions],
  );

  const updateTag = useCallback(
    async (
      sessionId: string,
      tagId: string,
      updates: Partial<Omit<VideoSession["tags"][number], "id" | "createdAt">>,
    ) => {
      const previousSessions = getCachedSessions();
      const currentSession = selectSessionById(previousSessions, sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const optimisticSession: VideoSession = {
        ...currentSession,
        tags: currentSession.tags.map((tag) =>
          tag.id === tagId
            ? {
                ...tag,
                ...updates,
              }
            : tag,
        ),
        lastModified: Date.now(),
      };

      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );

      try {
        const serverSession = await updateTagAction({
          sessionId,
          tagId,
          updates,
        });

        setCachedSessions((currentSessions) =>
          replaceSession(currentSessions, sessionId, serverSession),
        );

        return serverSession;
      } catch (mutationError) {
        setCachedSessions(previousSessions);
        throw mutationError;
      }
    },
    [getCachedSessions, setCachedSessions],
  );

  const deleteTag = useCallback(
    async (sessionId: string, tagId: string) => {
      const previousSessions = getCachedSessions();
      const currentSession = selectSessionById(previousSessions, sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const optimisticSession: VideoSession = {
        ...currentSession,
        tags: currentSession.tags.filter((tag) => tag.id !== tagId),
        lastModified: Date.now(),
      };

      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );

      try {
        const serverSession = await deleteTagAction({
          sessionId,
          tagId,
        });

        setCachedSessions((currentSessions) =>
          replaceSession(currentSessions, sessionId, serverSession),
        );

        return serverSession;
      } catch (mutationError) {
        setCachedSessions(previousSessions);
        throw mutationError;
      }
    },
    [getCachedSessions, setCachedSessions],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const previousSessions = getCachedSessions();
      setCachedSessions((currentSessions) =>
        currentSessions.filter((session) => session.id !== sessionId),
      );

      try {
        const deletedSession = await deleteSessionAction({ sessionId });
        return deletedSession;
      } catch (mutationError) {
        setCachedSessions(previousSessions);
        throw mutationError;
      }
    },
    [getCachedSessions, setCachedSessions],
  );

  const importSessions = useCallback(
    async (incomingSessions: VideoSession[]) => {
      const result = await importSessionsAction({
        sessions: incomingSessions,
      });

      await queryClient.invalidateQueries({
        queryKey: sessionsQueryKey,
      });
      await queryClient.refetchQueries({
        queryKey: sessionsQueryKey,
      });

      return result;
    },
    [queryClient],
  );

  return useMemo(
    () => ({
      sessions,
      status,
      error,
      allFencerNames: getAllFencerNames(sessions),
      getSessionById,
      createSessionEntry,
      updateSessionEntry,
      setSessionVideoSelection,
      addTag,
      updateTag,
      deleteTag,
      deleteSession,
      exportToCSV: () => exportSessionsToCsv(sessions),
      importSessions,
    }),
    [
      addTag,
      createSessionEntry,
      deleteSession,
      deleteTag,
      error,
      getSessionById,
      importSessions,
      sessions,
      setSessionVideoSelection,
      status,
      updateSessionEntry,
      updateTag,
    ],
  );
}

function createOptimisticSession(
  params: SessionDraftParams,
  videoSelection: SessionVideoSelection,
  sessionId: string,
): VideoSession {
  switch (videoSelection.kind) {
    case "library":
      return createSessionRecordWithLibraryVideo(videoSelection.video, params, {
        sessionId,
      });
    case "temporary":
      return createSessionRecordWithTemporaryVideo(
        videoSelection.file.name,
        videoSelection.file.lastModified,
        params,
        {
          sessionId,
        },
      );
    case "none":
    default:
      return createSessionRecord(params, {
        sessionId,
      });
  }
}

function serializeVideoSelection(
  videoSelection: SessionVideoSelection,
): ServerSessionVideoSelection {
  switch (videoSelection.kind) {
    case "library":
      return {
        kind: "library",
        video: videoSelection.video,
      };
    case "temporary":
      return {
        kind: "temporary",
        fileName: videoSelection.file.name,
        fileLastModified: videoSelection.file.lastModified,
      };
    case "none":
    default:
      return { kind: "none" };
  }
}

function replaceSession(
  sessions: VideoSession[],
  sessionId: string,
  nextSession: VideoSession,
): VideoSession[] {
  let found = false;

  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    found = true;
    return nextSession;
  });

  return found ? nextSessions : [...nextSessions, nextSession];
}

function applySessionDraftUpdates(
  session: VideoSession,
  params: SessionDraftParams,
): VideoSession {
  const updates: UpdateSessionParams = {};

  for (const fieldKey of [
    "leftFencer",
    "rightFencer",
    "boutDate",
    "externalSource",
  ] as const) {
    if (!(fieldKey in params)) {
      continue;
    }

    updates[fieldKey] = params[fieldKey] ?? null;
  }

  return Object.keys(updates).length > 0
    ? applySessionUpdates(session, updates)
    : session;
}

function applyPersistedVideoSelection(
  session: VideoSession,
  videoSelection: PersistedSessionVideoSelection,
): VideoSession {
  switch (videoSelection.kind) {
    case "library":
      return attachLibraryVideoToSession(session, videoSelection.video);
    case "none":
    default:
      return clearSessionVideoFromSession(session);
  }
}

function applyVideoSelection(
  session: VideoSession,
  videoSelection: SessionVideoSelection | PersistedSessionVideoSelection,
): VideoSession {
  switch (videoSelection.kind) {
    case "library":
      return attachLibraryVideoToSession(session, videoSelection.video);
    case "temporary":
      return setTemporaryVideoMetadataOnSession(
        session,
        videoSelection.file.name,
        videoSelection.file.lastModified,
      );
    case "none":
    default:
      return clearSessionVideoFromSession(session);
  }
}

function deriveSessionUpdates(
  previousSession: VideoSession,
  nextSession: VideoSession,
): UpdateSessionParams {
  const updates: UpdateSessionParams = {};

  if (previousSession.fileName !== nextSession.fileName) {
    updates.fileName = nextSession.fileName ?? null;
  }

  if (previousSession.videoRelativePath !== nextSession.videoRelativePath) {
    updates.videoRelativePath = nextSession.videoRelativePath ?? null;
  }

  if (previousSession.videoMimeType !== nextSession.videoMimeType) {
    updates.videoMimeType = nextSession.videoMimeType ?? null;
  }

  if (previousSession.videoSourceType !== nextSession.videoSourceType) {
    updates.videoSourceType = nextSession.videoSourceType ?? null;
  }

  if (previousSession.leftFencer !== nextSession.leftFencer) {
    updates.leftFencer = nextSession.leftFencer ?? null;
  }

  if (previousSession.rightFencer !== nextSession.rightFencer) {
    updates.rightFencer = nextSession.rightFencer ?? null;
  }

  if (previousSession.boutDate !== nextSession.boutDate) {
    updates.boutDate = nextSession.boutDate ?? null;
  }

  if (previousSession.externalSource !== nextSession.externalSource) {
    updates.externalSource = nextSession.externalSource ?? null;
  }

  return updates;
}
