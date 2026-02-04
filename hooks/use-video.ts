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
  playbackSpeed: PlaybackSpeed;
  zoomLevel: ZoomLevel;
  panX: number;
  panY: number;
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
}

export function useVideo(options: UseVideoOptions = {}): UseVideoReturn {
  const { frameRate = DEFAULT_FRAME_RATE } = options;
  const frameDuration = 1 / frameRate;

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [videoElementTrigger, setVideoElementTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(1);
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

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

    return () => {
      videoElement.removeEventListener("timeupdate", handleTimeUpdate);
      videoElement.removeEventListener("durationchange", handleDurationChange);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("ended", handleEnded);
    };
  }, [videoElementTrigger, playbackSpeed]);

  const play = useCallback(() => {
    videoElementRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoElementRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (videoElementRef.current?.paused) {
      videoElementRef.current.play();
    } else {
      videoElementRef.current?.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const videoElement = videoElementRef.current;
    if (videoElement) {
      // Use video element's duration directly to avoid issues when state hasn't loaded yet
      const videoDuration = isFinite(videoElement.duration)
        ? videoElement.duration
        : Infinity;
      videoElement.currentTime = Math.max(0, Math.min(time, videoDuration));
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

  return {
    setVideoElement,
    currentTime,
    duration,
    isPlaying,
    playbackSpeed,
    zoomLevel,
    panX,
    panY,
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
  };
}
