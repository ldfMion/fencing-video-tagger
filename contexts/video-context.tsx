"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface VideoState {
  sessionId: string | null;
  videoUrl: string | null;
  fileName: string | null;
  urlSource: "blob" | "server" | null;
}

interface VideoContextType extends VideoState {
  setVideo: (
    sessionId: string,
    url: string,
    fileName: string,
    urlSource?: "blob" | "server",
  ) => void;
  clearVideo: () => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VideoState>({
    sessionId: null,
    videoUrl: null,
    fileName: null,
    urlSource: null,
  });

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
        setVideo,
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
