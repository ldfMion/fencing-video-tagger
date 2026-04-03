"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useVideoContext } from "@/contexts/video-context";
import type {
  SessionVideoSelection,
  PersistedSessionVideoSelection,
} from "@/hooks/use-sessions";
import { useSessions } from "@/hooks/use-sessions";
import type { VideoSession } from "@/lib/types";
import { buildSessionVideoUrl } from "@/lib/video-library";

type LibraryVideoState = "idle" | "checking" | "available" | "missing";

interface UseBoutVideoOptions {
  onSourceChange?: () => void;
  session?: VideoSession;
}

export function useBoutVideo({ onSourceChange, session }: UseBoutVideoOptions) {
  const {
    sessionId: contextSessionId,
    videoUrl,
    fileName,
    urlSource,
    playServerVideo,
    playTemporaryVideo,
    clearVideo,
  } = useVideoContext();
  const { setSessionVideoSelection } = useSessions();
  const [libraryVideoCheck, setLibraryVideoCheck] = useState<{
    relativePath: string;
    status: Exclude<LibraryVideoState, "idle" | "checking">;
  } | null>(null);

  const sessionFileName = session?.fileName ?? null;
  const sessionVideoRelativePath = session?.videoRelativePath ?? null;
  const sessionVideoUrl = useMemo(
    () =>
      session && sessionVideoRelativePath
        ? buildSessionVideoUrl({
            id: session.id,
            videoRelativePath: sessionVideoRelativePath,
          })
        : null,
    [session, sessionVideoRelativePath],
  );
  const contextMatchesSession = contextSessionId === session?.id;
  const hasTemporaryOverride =
    Boolean(videoUrl) && contextMatchesSession && urlSource === "blob";
  const libraryVideoState: LibraryVideoState = !sessionVideoRelativePath
    ? "idle"
    : libraryVideoCheck?.relativePath === sessionVideoRelativePath
      ? libraryVideoCheck.status
      : "checking";

  useEffect(() => {
    if (!session?.id || !sessionVideoRelativePath || !sessionVideoUrl) {
      return;
    }

    let isCancelled = false;

    fetch(sessionVideoUrl, {
      method: "HEAD",
      cache: "no-store",
    })
      .then((response) => {
        if (!isCancelled) {
          setLibraryVideoCheck({
            relativePath: sessionVideoRelativePath,
            status: response.ok ? "available" : "missing",
          });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLibraryVideoCheck({
            relativePath: sessionVideoRelativePath,
            status: "missing",
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [session?.id, sessionVideoRelativePath, sessionVideoUrl]);

  useEffect(() => {
    if (!session?.id || !sessionVideoUrl) {
      if (contextMatchesSession && urlSource === "server") {
        clearVideo();
      }
      return;
    }

    if (hasTemporaryOverride || libraryVideoState !== "available") {
      return;
    }

    if (
      contextMatchesSession &&
      urlSource === "server" &&
      videoUrl === sessionVideoUrl &&
      fileName === sessionFileName
    ) {
      return;
    }

    playServerVideo(session.id, sessionVideoUrl, sessionFileName ?? "Attached video");
  }, [
    clearVideo,
    contextMatchesSession,
    fileName,
    hasTemporaryOverride,
    libraryVideoState,
    playServerVideo,
    session?.id,
    sessionFileName,
    sessionVideoUrl,
    urlSource,
    videoUrl,
  ]);

  const activeVideoUrl = hasTemporaryOverride
    ? videoUrl
    : libraryVideoState === "available"
      ? sessionVideoUrl
      : null;
  const activeVideoFileName = hasTemporaryOverride ? fileName : sessionFileName;
  const activeVideoBadge = hasTemporaryOverride ? "Temporary file" : "Library video";
  const isTemporaryOnly =
    !sessionVideoRelativePath && session?.videoSourceType === "temporary";
  const hasAttachedLibraryVideo = Boolean(sessionVideoRelativePath);
  const showUnavailableState =
    hasAttachedLibraryVideo &&
    libraryVideoState === "missing" &&
    !hasTemporaryOverride;
  const showLibraryLoadingState =
    hasAttachedLibraryVideo &&
    libraryVideoState === "checking" &&
    !hasTemporaryOverride;

  const handlePersistedVideoSelection = useCallback(
    (selection: PersistedSessionVideoSelection) => {
      if (!session) {
        return;
      }

      onSourceChange?.();

      if (selection.kind === "none") {
        if (contextMatchesSession && urlSource === "server") {
          clearVideo();
        }
        return;
      }

      if (contextMatchesSession && urlSource === "blob") {
        clearVideo();
      }
    },
    [
      clearVideo,
      contextMatchesSession,
      onSourceChange,
      session,
      urlSource,
    ],
  );

  const loadTemporaryVideo = useCallback(
    (file: File) => {
      if (!session) {
        return;
      }

      onSourceChange?.();
      playTemporaryVideo(session.id, file);
      setSessionVideoSelection(session.id, {
        kind: "temporary",
        file,
      } satisfies SessionVideoSelection);
    },
    [onSourceChange, playTemporaryVideo, session, setSessionVideoSelection],
  );

  return {
    activeVideoBadge,
    activeVideoFileName,
    activeVideoUrl,
    handlePersistedVideoSelection,
    hasAttachedLibraryVideo,
    hasTemporaryOverride,
    isTemporaryOnly,
    libraryVideoState,
    selectedLibraryRelativePath: sessionVideoRelativePath,
    loadTemporaryVideo,
    showLibraryLoadingState,
    showUnavailableState,
  };
}
