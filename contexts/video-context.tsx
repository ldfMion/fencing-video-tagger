"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface VideoState {
  videoUrl: string | null;
  fileName: string | null;
}

interface VideoContextType extends VideoState {
  setVideo: (url: string, fileName: string) => void;
  setFileName: (fileName: string) => void;
  clearVideo: () => void;
}

const VideoContext = createContext<VideoContextType | null>(null);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VideoState>({
    videoUrl: null,
    fileName: null,
  });

  const setVideo = useCallback((url: string, fileName: string) => {
    setState((prev) => {
      // Revoke previous URL to avoid memory leak
      if (prev.videoUrl) {
        URL.revokeObjectURL(prev.videoUrl);
      }
      return { videoUrl: url, fileName };
    });
  }, []);

  const setFileName = useCallback((fileName: string) => {
    setState((prev) => ({ ...prev, fileName }));
  }, []);

  const clearVideo = useCallback(() => {
    setState((prev) => {
      if (prev.videoUrl) {
        URL.revokeObjectURL(prev.videoUrl);
      }
      return { videoUrl: null, fileName: null };
    });
  }, []);

  return (
    <VideoContext.Provider
      value={{
        ...state,
        setVideo,
        setFileName,
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
