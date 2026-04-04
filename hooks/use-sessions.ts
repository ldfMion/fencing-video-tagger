"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
import { useSessionsQuery, sessionsQueryKey } from "@/hooks/use-sessions-query";
import { exportSessionsToCsv } from "@/lib/session-export";
import {
  type AddTagParams,
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
  type UpdateSessionParams,
} from "@/lib/session-service";
import {
  getAllFencerNames,
  getSessionById as selectSessionById,
} from "@/lib/session-selectors";
import type { Tag, VideoSession } from "@/lib/types";

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

interface CreateSessionMutationVariables {
  params: SessionDraftParams;
  videoSelection: SessionVideoSelection;
  sessionId: string;
  optimisticSession: VideoSession;
}

interface UpdateSessionMutationVariables {
  sessionId: string;
  updates: UpdateSessionParams;
  optimisticSession: VideoSession;
}

interface AddTagMutationVariables {
  sessionId: string;
  params: AddTagParams;
  optimisticSession: VideoSession;
  optimisticTag: Tag;
}

interface UpdateTagMutationVariables {
  sessionId: string;
  tagId: string;
  updates: Partial<Omit<Tag, "id" | "createdAt">>;
  optimisticSession: VideoSession;
}

interface DeleteTagMutationVariables {
  sessionId: string;
  tagId: string;
  optimisticSession: VideoSession;
  deletedTag: Tag;
  deletedTagIndex: number;
}

interface DeleteSessionMutationVariables {
  sessionId: string;
  previousSession: VideoSession;
  previousIndex: number;
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

  const cancelSessionsQuery = useCallback(
    () =>
      queryClient.cancelQueries({
        queryKey: sessionsQueryKey,
      }),
    [queryClient],
  );

  const refetchSessions = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: sessionsQueryKey,
    });
    await queryClient.refetchQueries({
      queryKey: sessionsQueryKey,
    });
  }, [queryClient]);

  const getSessionById = useCallback(
    (sessionId: string) => selectSessionById(getCachedSessions(), sessionId),
    [getCachedSessions],
  );

  const createSessionMutation = useMutation({
    mutationFn: async ({
      params,
      videoSelection,
      sessionId,
    }: CreateSessionMutationVariables) =>
      createSessionAction({
        sessionId,
        params,
        videoSelection: serializeVideoSelection(videoSelection),
      }),
    onMutate: async ({ optimisticSession }) => {
      await cancelSessionsQuery();
      setCachedSessions((currentSessions) => [...currentSessions, optimisticSession]);
    },
    onError: (_error, { sessionId }) => {
      setCachedSessions((currentSessions) =>
        currentSessions.filter((session) => session.id !== sessionId),
      );
    },
    onSuccess: (serverSession, { sessionId }) => {
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, serverSession),
      );
    },
  });

  const sessionPatchMutation = useMutation({
    mutationFn: async ({
      sessionId,
      updates,
    }: UpdateSessionMutationVariables) =>
      updateSessionAction({
        sessionId,
        updates,
      }),
    onMutate: async ({ sessionId, optimisticSession }) => {
      await cancelSessionsQuery();
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );
    },
    onError: async () => {
      await refetchSessions();
    },
    onSuccess: (serverSession, { sessionId }) => {
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, serverSession),
      );
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async ({
      sessionId,
      params,
      optimisticTag,
    }: AddTagMutationVariables) =>
      addTagAction({
        sessionId,
        tagId: optimisticTag.id,
        createdAt: optimisticTag.createdAt,
        params,
      }),
    onMutate: async ({ sessionId, optimisticSession }) => {
      await cancelSessionsQuery();
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );
    },
    onError: (_error, { sessionId, optimisticTag }) => {
      setCachedSessions((currentSessions) =>
        removeTagFromSession(currentSessions, sessionId, optimisticTag.id),
      );
    },
    onSuccess: (serverSession, { sessionId }) => {
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, serverSession),
      );
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({
      sessionId,
      tagId,
      updates,
    }: UpdateTagMutationVariables) =>
      updateTagAction({
        sessionId,
        tagId,
        updates,
      }),
    onMutate: async ({ sessionId, optimisticSession }) => {
      await cancelSessionsQuery();
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );
    },
    onError: async () => {
      await refetchSessions();
    },
    onSuccess: (serverSession, { sessionId }) => {
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, serverSession),
      );
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async ({ sessionId, tagId }: DeleteTagMutationVariables) =>
      deleteTagAction({
        sessionId,
        tagId,
      }),
    onMutate: async ({ sessionId, optimisticSession }) => {
      await cancelSessionsQuery();
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, optimisticSession),
      );
    },
    onError: (_error, { sessionId, deletedTag, deletedTagIndex }) => {
      setCachedSessions((currentSessions) =>
        restoreDeletedTag(
          currentSessions,
          sessionId,
          deletedTag,
          deletedTagIndex,
        ),
      );
    },
    onSuccess: (serverSession, { sessionId }) => {
      setCachedSessions((currentSessions) =>
        replaceSession(currentSessions, sessionId, serverSession),
      );
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async ({ sessionId }: DeleteSessionMutationVariables) =>
      deleteSessionAction({
        sessionId,
      }),
    onMutate: async ({ sessionId }) => {
      await cancelSessionsQuery();
      setCachedSessions((currentSessions) =>
        currentSessions.filter((session) => session.id !== sessionId),
      );
    },
    onError: (_error, { previousSession, previousIndex }) => {
      setCachedSessions((currentSessions) =>
        restoreDeletedSession(
          currentSessions,
          previousSession,
          previousIndex,
        ),
      );
    },
  });

  const importSessionsMutation = useMutation({
    mutationFn: async (incomingSessions: VideoSession[]) =>
      importSessionsAction({
        sessions: incomingSessions,
      }),
    onSuccess: async () => {
      await refetchSessions();
    },
  });

  const createSessionEntry = useCallback(
    async (
      params: SessionDraftParams = {},
      videoSelection: SessionVideoSelection = NO_VIDEO_SELECTION,
      options?: CreateSessionEntryOptions,
    ) => {
      const sessionId = options?.sessionId ?? crypto.randomUUID();
      const optimisticSession = createOptimisticSession(
        params,
        videoSelection,
        sessionId,
      );

      return createSessionMutation.mutateAsync({
        params,
        videoSelection,
        sessionId,
        optimisticSession,
      });
    },
    [createSessionMutation],
  );

  const updateSessionEntry = useCallback(
    async (
      sessionId: string,
      params: SessionDraftParams,
      videoSelection?: PersistedSessionVideoSelection,
    ) => {
      const currentSession = getSessionById(sessionId);

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

      return sessionPatchMutation.mutateAsync({
        sessionId,
        updates,
        optimisticSession,
      });
    },
    [getSessionById, sessionPatchMutation],
  );

  const setSessionVideoSelection = useCallback(
    async (
      sessionId: string,
      videoSelection: SessionVideoSelection | PersistedSessionVideoSelection,
    ) => {
      const currentSession = getSessionById(sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const optimisticSession = applyVideoSelection(currentSession, videoSelection);
      const updates = deriveSessionUpdates(currentSession, optimisticSession);

      if (Object.keys(updates).length === 0) {
        return currentSession;
      }

      return sessionPatchMutation.mutateAsync({
        sessionId,
        updates,
        optimisticSession,
      });
    },
    [getSessionById, sessionPatchMutation],
  );

  const addTag = useCallback(
    async (sessionId: string, params: AddTagParams) => {
      const currentSession = getSessionById(sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const optimisticTag = createTagRecord(params, {
        tagId: crypto.randomUUID(),
        createdAt: Date.now(),
        seq: computeNextTagSequence(currentSession),
      });
      const optimisticSession = {
        ...currentSession,
        tags: [...currentSession.tags, optimisticTag],
        lastModified: Date.now(),
      };

      return addTagMutation.mutateAsync({
        sessionId,
        params,
        optimisticSession,
        optimisticTag,
      });
    },
    [addTagMutation, getSessionById],
  );

  const updateTag = useCallback(
    async (
      sessionId: string,
      tagId: string,
      updates: Partial<Omit<Tag, "id" | "createdAt">>,
    ) => {
      const currentSession = getSessionById(sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const optimisticSession = {
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

      return updateTagMutation.mutateAsync({
        sessionId,
        tagId,
        updates,
        optimisticSession,
      });
    },
    [getSessionById, updateTagMutation],
  );

  const deleteTag = useCallback(
    async (sessionId: string, tagId: string) => {
      const currentSession = getSessionById(sessionId);

      if (!currentSession) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      const deletedTagIndex = currentSession.tags.findIndex((tag) => tag.id === tagId);

      if (deletedTagIndex === -1) {
        throw new Error(`Tag ${tagId} was not found in session ${sessionId}`);
      }

      const deletedTag = currentSession.tags[deletedTagIndex];
      const optimisticSession = {
        ...currentSession,
        tags: currentSession.tags.filter((tag) => tag.id !== tagId),
        lastModified: Date.now(),
      };

      return deleteTagMutation.mutateAsync({
        sessionId,
        tagId,
        optimisticSession,
        deletedTag,
        deletedTagIndex,
      });
    },
    [deleteTagMutation, getSessionById],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      const currentSessions = getCachedSessions();
      const previousIndex = currentSessions.findIndex(
        (session) => session.id === sessionId,
      );

      if (previousIndex === -1) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      return deleteSessionMutation.mutateAsync({
        sessionId,
        previousSession: currentSessions[previousIndex],
        previousIndex,
      });
    },
    [deleteSessionMutation, getCachedSessions],
  );

  const importSessions = useCallback(
    async (incomingSessions: VideoSession[]) =>
      importSessionsMutation.mutateAsync(incomingSessions),
    [importSessionsMutation],
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

function restoreDeletedSession(
  sessions: VideoSession[],
  deletedSession: VideoSession,
  deletedSessionIndex: number,
): VideoSession[] {
  if (sessions.some((session) => session.id === deletedSession.id)) {
    return sessions;
  }

  const nextSessions = [...sessions];
  nextSessions.splice(
    Math.min(deletedSessionIndex, nextSessions.length),
    0,
    deletedSession,
  );
  return nextSessions;
}

function removeTagFromSession(
  sessions: VideoSession[],
  sessionId: string,
  tagId: string,
): VideoSession[] {
  return sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          tags: session.tags.filter((tag) => tag.id !== tagId),
        }
      : session,
  );
}

function restoreDeletedTag(
  sessions: VideoSession[],
  sessionId: string,
  deletedTag: Tag,
  deletedTagIndex: number,
): VideoSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    if (session.tags.some((tag) => tag.id === deletedTag.id)) {
      return session;
    }

    const nextTags = [...session.tags];
    nextTags.splice(Math.min(deletedTagIndex, nextTags.length), 0, deletedTag);

    return {
      ...session,
      tags: nextTags,
    };
  });
}

function applySessionDraftUpdates(
  session: VideoSession,
  params: SessionDraftParams,
): VideoSession {
  const updates: UpdateSessionParams = {};

  if ("leftFencer" in params) {
    updates.leftFencer = params.leftFencer ?? null;
  }

  if ("rightFencer" in params) {
    updates.rightFencer = params.rightFencer ?? null;
  }

  if ("boutDate" in params) {
    updates.boutDate = params.boutDate ?? null;
  }

  if ("externalSource" in params) {
    updates.externalSource = params.externalSource ?? null;
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
