"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export const PLAYBACK_SPEEDS = [0.2, 0.4, 0.5, 0.7, 1, 2, 3] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const ZOOM_LEVELS = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3,
] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

// Default frame rate for frame stepping (can be overridden)
const DEFAULT_FRAME_RATE = 30;
const SKIP_DURATION = 5;
// Pan step size as percentage of viewport (10% per keypress)
const PAN_STEP = 10;

export interface UseVideoOptions {
  frameRate?: number;
}

export interface UseVideoReturn {
  setVideoElement: (el: HTMLVideoElement | null) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isSeeking: boolean;
  playbackSpeed: PlaybackSpeed;
  zoomLevel: ZoomLevel;
  panX: number;
  panY: number;
  error: string | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  stepFrame: (direction: "forward" | "backward") => void;
  skip: (direction: "forward" | "backward") => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoomLevel: (level: ZoomLevel) => void;
  panUp: () => void;
  panDown: () => void;
  panLeft: () => void;
  panRight: () => void;
  centerPan: () => void;
  clearError: () => void;
}

export function useVideo(options: UseVideoOptions = {}): UseVideoReturn {
  const { frameRate = DEFAULT_FRAME_RATE } = options;
  const frameDuration = 1 / frameRate;

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoElementTrigger, setVideoElementTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(1);
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const setVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoElementRef.current = el;
    setVideoElementTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    const videoElement = videoElementRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => setCurrentTime(videoElement.currentTime);
    const handleDurationChange = () => {
      if (isFinite(videoElement.duration)) {
        setDuration(videoElement.duration);
      }
    };
    const handleLoadedMetadata = () => {
      if (isFinite(videoElement.duration)) {
        setDuration(videoElement.duration);
      }
      setCurrentTime(videoElement.currentTime);
      setIsPlaying(!videoElement.paused);
      // Apply current playback speed to new video element
      videoElement.playbackRate = playbackSpeed;
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleSeeking = () => {
      setIsSeeking(true);
    };
    const handleSeeked = () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      setIsSeeking(false);
    };
    const handleCanPlay = () => {
      // If we were seeking and can now play, clear seeking state
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      setIsSeeking(false);
    };
    const handleError = () => {
      const mediaError = videoElement.error;
      if (!mediaError) return;

      // Ignore errors that occur during seeking - these are often transient
      // The browser may report decode errors while seeking that resolve themselves
      if (isSeeking) {
        return;
      }

      // MEDIA_ERR_ABORTED (1) is often not a real error - user or browser aborted loading
      if (mediaError.code === 1) {
        return;
      }

      setIsPlaying(false);
      const errorMessages: Record<number, string> = {
        1: "Video loading aborted",
        2: "Network error while loading video",
        3: "Video decoding failed - the video file may be corrupted or use an unsupported codec",
        4: "Video format not supported",
      };
      setError(
        errorMessages[mediaError.code] || `Video error: ${mediaError.message}`,
      );
    };

    const handleLoadStart = () => {
      // Clear error when starting to load new video
      setError(null);
      setIsSeeking(false);
    };

    // Set initial values only if video metadata is already loaded (readyState >= 1)
    if (videoElement.readyState >= 1) {
      if (isFinite(videoElement.duration)) {
        setDuration(videoElement.duration);
      }
      setCurrentTime(videoElement.currentTime);
      setIsPlaying(!videoElement.paused);
      videoElement.playbackRate = playbackSpeed;
    }

    videoElement.addEventListener("timeupdate", handleTimeUpdate);
    videoElement.addEventListener("durationchange", handleDurationChange);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("ended", handleEnded);
    videoElement.addEventListener("seeking", handleSeeking);
    videoElement.addEventListener("seeked", handleSeeked);
    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("error", handleError);
    videoElement.addEventListener("loadstart", handleLoadStart);

    return () => {
      videoElement.removeEventListener("timeupdate", handleTimeUpdate);
      videoElement.removeEventListener("durationchange", handleDurationChange);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("ended", handleEnded);
      videoElement.removeEventListener("seeking", handleSeeking);
      videoElement.removeEventListener("seeked", handleSeeked);
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("error", handleError);
      videoElement.removeEventListener("loadstart", handleLoadStart);
    };
  }, [videoElementTrigger, playbackSpeed, isSeeking]);

  const play = useCallback(() => {
    const videoElement = videoElementRef.current;
    if (!videoElement) return;

    videoElement.play().catch((err) => {
      if (err.name === "AbortError") {
        // Retry play after a short delay - this happens when play is interrupted by seek
        setTimeout(() => {
          videoElement.play().catch((retryErr) => {
            if (retryErr.name !== "AbortError") {
              setError(`Failed to play video: ${retryErr.message}`);
            }
          });
        }, 100);
      } else {
        setError(`Failed to play video: ${err.message}`);
      }
    });
  }, []);

  const pause = useCallback(() => {
    videoElementRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const videoElement = videoElementRef.current;
    if (!videoElement) return;

    if (videoElement.paused) {
      videoElement.play().catch((err) => {
        if (err.name === "AbortError") {
          // Retry play after a short delay
          setTimeout(() => {
            videoElement.play().catch((retryErr) => {
              if (retryErr.name !== "AbortError") {
                setError(`Failed to play video: ${retryErr.message}`);
              }
            });
          }, 100);
        } else {
          setError(`Failed to play video: ${err.message}`);
        }
      });
    } else {
      videoElement.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const videoElement = videoElementRef.current;
    if (videoElement) {
      const videoDuration = isFinite(videoElement.duration)
        ? videoElement.duration
        : Infinity;
      const targetTime = Math.max(0, Math.min(time, videoDuration));

      // Clear any existing seek timeout
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }

      // Use fastSeek if available - it seeks to nearest keyframe which is more reliable
      // for videos with sparse keyframes or when using blob URLs
      if (typeof videoElement.fastSeek === "function") {
        videoElement.fastSeek(targetTime);
      } else {
        videoElement.currentTime = targetTime;
      }

      // Set a timeout to clear seeking state if seeked event never fires
      // This can happen with certain video files/codecs (e.g., Firefox with some files)
      seekTimeoutRef.current = setTimeout(() => {
        setIsSeeking(false);
      }, 3000);
    }
  }, []);

  const setPlaybackSpeed = useCallback((speed: PlaybackSpeed) => {
    if (videoElementRef.current) {
      videoElementRef.current.playbackRate = speed;
    }
    setPlaybackSpeedState(speed);
  }, []);

  const stepFrame = useCallback(
    (direction: "forward" | "backward") => {
      const videoElement = videoElementRef.current;
      if (videoElement) {
        // Pause video when stepping frames
        videoElement.pause();
        const delta = direction === "forward" ? frameDuration : -frameDuration;
        const videoDuration = isFinite(videoElement.duration)
          ? videoElement.duration
          : Infinity;
        videoElement.currentTime = Math.max(
          0,
          Math.min(videoElement.currentTime + delta, videoDuration),
        );
      }
    },
    [frameDuration],
  );

  const skip = useCallback((direction: "forward" | "backward") => {
    const videoElement = videoElementRef.current;
    if (videoElement) {
      const delta = direction === "forward" ? SKIP_DURATION : -SKIP_DURATION;
      const videoDuration = isFinite(videoElement.duration)
        ? videoElement.duration
        : Infinity;
      videoElement.currentTime = Math.max(
        0,
        Math.min(videoElement.currentTime + delta, videoDuration),
      );
    }
  }, []);

  // Calculate max pan distance for a given zoom level
  const getMaxPanForZoom = useCallback((zoom: number) => {
    if (zoom <= 1) return 0;
    return (zoom - 1) * 50;
  }, []);

  // Clamp pan values to valid bounds for a given zoom level
  const clampPan = useCallback(
    (currentPanX: number, currentPanY: number, newZoom: number) => {
      const maxPan = getMaxPanForZoom(newZoom);
      return {
        x: Math.max(-maxPan, Math.min(maxPan, currentPanX)),
        y: Math.max(-maxPan, Math.min(maxPan, currentPanY)),
      };
    },
    [getMaxPanForZoom],
  );

  const zoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      const newZoom = ZOOM_LEVELS[currentIndex + 1];
      setZoomLevelState(newZoom);
      // Clamp pan to new valid bounds
      const clamped = clampPan(panX, panY, newZoom);
      setPanX(clamped.x);
      setPanY(clamped.y);
    }
  }, [zoomLevel, panX, panY, clampPan]);

  const zoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      const newZoom = ZOOM_LEVELS[currentIndex - 1];
      setZoomLevelState(newZoom);
      // Clamp pan to new valid bounds
      const clamped = clampPan(panX, panY, newZoom);
      setPanX(clamped.x);
      setPanY(clamped.y);
    }
  }, [zoomLevel, panX, panY, clampPan]);

  const resetZoom = useCallback(() => {
    setZoomLevelState(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const setZoomLevel = useCallback(
    (level: ZoomLevel) => {
      setZoomLevelState(level);
      // Clamp pan to new valid bounds
      const clamped = clampPan(panX, panY, level);
      setPanX(clamped.x);
      setPanY(clamped.y);
    },
    [panX, panY, clampPan],
  );

  const panUp = useCallback(() => {
    const maxPan = getMaxPanForZoom(zoomLevel);
    setPanY((prev) => Math.min(maxPan, prev + PAN_STEP));
  }, [getMaxPanForZoom, zoomLevel]);

  const panDown = useCallback(() => {
    const maxPan = getMaxPanForZoom(zoomLevel);
    setPanY((prev) => Math.max(-maxPan, prev - PAN_STEP));
  }, [getMaxPanForZoom, zoomLevel]);

  const panLeft = useCallback(() => {
    const maxPan = getMaxPanForZoom(zoomLevel);
    setPanX((prev) => Math.min(maxPan, prev + PAN_STEP));
  }, [getMaxPanForZoom, zoomLevel]);

  const panRight = useCallback(() => {
    const maxPan = getMaxPanForZoom(zoomLevel);
    setPanX((prev) => Math.max(-maxPan, prev - PAN_STEP));
  }, [getMaxPanForZoom, zoomLevel]);

  const centerPan = useCallback(() => {
    setPanX(0);
    setPanY(0);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    setVideoElement,
    currentTime,
    duration,
    isPlaying,
    isSeeking,
    playbackSpeed,
    zoomLevel,
    panX,
    panY,
    error,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackSpeed,
    stepFrame,
    skip,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoomLevel,
    panUp,
    panDown,
    panLeft,
    panRight,
    centerPan,
    clearError,
  };
}
