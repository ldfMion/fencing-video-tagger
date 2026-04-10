"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface VideoState {
  sessionId: string | null;
  videoUrl: string | null;
  fileName: string | null;
  urlSource: "blob" | "server" | null;
}

interface VideoContextType extends VideoState {
  playServerVideo: (sessionId: string, url: string, fileName: string) => void;
  playTemporaryVideo: (sessionId: string, file: File) => void;
  clearVideo: () => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: ReactNode }) {
  const blobUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<VideoState>({
    sessionId: null,
    videoUrl: null,
    fileName: null,
    urlSource: null,
  });

  useEffect(() => {
    blobUrlRef.current = state.urlSource === "blob" ? state.videoUrl : null;
  }, [state.urlSource, state.videoUrl]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const setVideo = useCallback(
    (
      sessionId: string,
      url: string,
      fileName: string,
      urlSource: "blob" | "server" = "blob",
    ) => {
      setState((prev) => {
        if (prev.videoUrl && prev.urlSource === "blob") {
          URL.revokeObjectURL(prev.videoUrl);
        }

        return { sessionId, videoUrl: url, fileName, urlSource };
      });
    },
    [],
  );

  const playServerVideo = useCallback(
    (sessionId: string, url: string, fileName: string) => {
      setVideo(sessionId, url, fileName, "server");
    },
    [setVideo],
  );

  const playTemporaryVideo = useCallback(
    (sessionId: string, file: File) => {
      const url = URL.createObjectURL(file);
      setVideo(sessionId, url, file.name, "blob");
    },
    [setVideo],
  );

  const clearVideo = useCallback(() => {
    setState((prev) => {
      if (prev.videoUrl && prev.urlSource === "blob") {
        URL.revokeObjectURL(prev.videoUrl);
      }

      return { sessionId: null, videoUrl: null, fileName: null, urlSource: null };
    });
  }, []);

  return (
    <VideoContext.Provider
      value={{
        ...state,
        playServerVideo,
        playTemporaryVideo,
        clearVideo,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
}

export function useVideoContext() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error("useVideoContext must be used within a VideoProvider");
  }
  return context;
}
