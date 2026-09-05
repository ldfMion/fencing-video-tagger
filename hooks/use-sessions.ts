"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  addTag as addTagOnServer,
  createSession as createSessionOnServer,
  deleteSession as deleteSessionOnServer,
  deleteTag as deleteTagOnServer,
  importSessions as importSessionsOnServer,
  updateSession as updateSessionOnServer,
  updateTag as updateTagOnServer,
} from "@/lib/server/session-service";
import {
  sessionQueryKey,
  sessionsQueryKey,
  useSessionQuery,
  useSessionsQuery,
} from "@/hooks/use-sessions-query";
import {
  exportSessionToCsv,
  exportSessionsToJson,
  exportSessionsToNormalizedCsvZip,
} from "@/lib/session-export";
import {
  assertTagMetadataMatchesSession,
  assertTaggingOptionsAreMutable,
} from "@/lib/tagging";
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
import type { Tag, TaggingOptions, VideoSession } from "@/lib/types";

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

interface SessionDetailQueryOptions {
  sessionId: string;
  initialSession?: VideoSession | null;
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

export function useSessions(
  initialSessions?: VideoSession[],
  detailQuery?: SessionDetailQueryOptions,
) {
  const queryClient = useQueryClient();
  const listQuery = useSessionsQuery(initialSessions, !detailQuery);
  const detailResult = useSessionQuery(
    detailQuery?.sessionId ?? "",
    detailQuery?.initialSession,
    Boolean(detailQuery),
  );
  const sessions = useMemo(
    () => detailQuery
      ? detailResult.data
        ? [detailResult.data]
        : []
      : listQuery.sessions,
    [detailQuery, detailResult.data, listQuery.sessions],
  );
  const { status, error } = detailQuery ? detailResult : listQuery;

  const getCachedSessions = useCallback(
    () =>
      (detailQuery
        ? optionalSessionAsArray(
            queryClient.getQueryData<VideoSession | null>(
              sessionQueryKey(detailQuery.sessionId),
            ),
          )
        : queryClient.getQueryData<VideoSession[]>(sessionsQueryKey)) ??
      initialSessions ??
      [],
    [detailQuery, initialSessions, queryClient],
  );

  const setCachedSessions = useCallback(
    (
      updater:
        | VideoSession[]
        | ((previousSessions: VideoSession[]) => VideoSession[]),
    ) => {
      queryClient.setQueryData<VideoSession[]>(sessionsQueryKey, (previousSessions) => {
        if (detailQuery && !previousSessions) {
          return previousSessions;
        }
        const currentSessions = previousSessions ?? initialSessions ?? [];
        return typeof updater === "function"
          ? updater(currentSessions)
          : updater;
      });

      if (detailQuery) {
        queryClient.setQueryData<VideoSession | null>(
          sessionQueryKey(detailQuery.sessionId),
          (previousSession) => {
            const currentSessions = optionalSessionAsArray(
              previousSession ?? detailQuery.initialSession,
            );
            const nextSessions = typeof updater === "function"
              ? updater(currentSessions)
              : updater;
            return selectSessionById(nextSessions, detailQuery.sessionId) ?? null;
          },
        );
      }
    },
    [detailQuery, initialSessions, queryClient],
  );

  const cancelSessionsQuery = useCallback(
    () =>
      Promise.all([
        queryClient.cancelQueries({ queryKey: sessionsQueryKey, exact: true }),
        ...(detailQuery
          ? [queryClient.cancelQueries({ queryKey: sessionQueryKey(detailQuery.sessionId) })]
          : []),
      ]),
    [detailQuery, queryClient],
  );

  const syncCachedSessionDetail = useCallback(
    (session: VideoSession) => {
      const queryKey = sessionQueryKey(session.id);

      if (queryClient.getQueryState(queryKey)) {
        queryClient.setQueryData<VideoSession | null>(queryKey, session);
      }
    },
    [queryClient],
  );

  const refetchSessions = useCallback(async () => {
    if (detailQuery) {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: sessionQueryKey(detailQuery.sessionId),
        }),
        queryClient.invalidateQueries({
          queryKey: sessionsQueryKey,
          exact: true,
          refetchType: "all",
        }),
      ]);
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: sessionsQueryKey,
      exact: true,
    });
    await queryClient.refetchQueries({
      queryKey: sessionsQueryKey,
      exact: true,
    });
  }, [detailQuery, queryClient]);

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
      createSessionOnServer({
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
      syncCachedSessionDetail(serverSession);
    },
  });

  const sessionPatchMutation = useMutation({
    mutationFn: async ({
      sessionId,
      updates,
    }: UpdateSessionMutationVariables) =>
      updateSessionOnServer({
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
      syncCachedSessionDetail(serverSession);
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async ({
      sessionId,
      params,
      optimisticTag,
    }: AddTagMutationVariables) =>
      addTagOnServer({
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
      syncCachedSessionDetail(serverSession);
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({
      sessionId,
      tagId,
      updates,
    }: UpdateTagMutationVariables) =>
      updateTagOnServer({
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
      syncCachedSessionDetail(serverSession);
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async ({ sessionId, tagId }: DeleteTagMutationVariables) =>
      deleteTagOnServer({
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
      syncCachedSessionDetail(serverSession);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async ({ sessionId }: DeleteSessionMutationVariables) =>
      deleteSessionOnServer({
        sessionId,
      }),
    onMutate: async ({ sessionId }) => {
      await cancelSessionsQuery();
      setCachedSessions((currentSessions) =>
        currentSessions.filter((session) => session.id !== sessionId),
      );
      queryClient.setQueryData<VideoSession | null>(
        sessionQueryKey(sessionId),
        null,
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
      importSessionsOnServer({
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

      assertTaggingOptionsAreMutable(currentSession, optimisticSession.taggingOptions);

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

      const optimisticTag = createTagRecord(params, currentSession, {
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

      const updatedTag = optimisticSession.tags.find((tag) => tag.id === tagId);

      if (!updatedTag) {
        throw new Error(`Tag ${tagId} was not found in session ${sessionId}`);
      }

      assertTagMetadataMatchesSession(currentSession, updatedTag);

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

  const exportAllToJson = useCallback(
    () => exportSessionsToJson(sessions),
    [sessions],
  );

  const exportAllToNormalizedCsvZip = useCallback(
    () => exportSessionsToNormalizedCsvZip(sessions),
    [sessions],
  );

  const exportSessionCsv = useCallback(
    (sessionId: string) => {
      const session = getSessionById(sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} was not found`);
      }

      return exportSessionToCsv(session);
    },
    [getSessionById],
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
      exportAllToJson,
      exportAllToNormalizedCsvZip,
      exportSessionCsv,
      importSessions,
    }),
    [
      addTag,
      createSessionEntry,
      deleteSession,
      deleteTag,
      error,
      exportAllToJson,
      exportAllToNormalizedCsvZip,
      exportSessionCsv,
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

function optionalSessionAsArray(
  session: VideoSession | null | undefined,
): VideoSession[] {
  return session ? [session] : [];
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

  if ("taggingOptions" in params) {
    updates.taggingOptions = (params.taggingOptions as TaggingOptions | undefined) ?? null;
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

  if (
    JSON.stringify(previousSession.taggingOptions ?? null) !==
    JSON.stringify(nextSession.taggingOptions ?? null)
  ) {
    updates.taggingOptions = nextSession.taggingOptions ?? null;
  }

  return updates;
}
