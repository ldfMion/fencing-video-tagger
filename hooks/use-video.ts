"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export const PLAYBACK_SPEEDS = [0.2, 0.4, 0.5, 0.7, 1, 2, 3] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// Assume 30fps for frame stepping (common for most videos)
const FRAME_DURATION = 1 / 30;
const SKIP_DURATION = 5;

export interface UseVideoReturn {
  setVideoElement: (el: HTMLVideoElement | null) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  stepFrame: (direction: "forward" | "backward") => void;
  skip: (direction: "forward" | "backward") => void;
}

export function useVideo(): UseVideoReturn {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [videoElementTrigger, setVideoElementTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<PlaybackSpeed>(1);

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
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    // Set initial values if video is already loaded
    if (isFinite(videoElement.duration)) {
      setDuration(videoElement.duration);
    }
    setCurrentTime(videoElement.currentTime);
    setIsPlaying(!videoElement.paused);

    videoElement.addEventListener("timeupdate", handleTimeUpdate);
    videoElement.addEventListener("durationchange", handleDurationChange);
    videoElement.addEventListener("loadedmetadata", handleDurationChange);
    videoElement.addEventListener("play", handlePlay);
    videoElement.addEventListener("pause", handlePause);
    videoElement.addEventListener("ended", handleEnded);

    return () => {
      videoElement.removeEventListener("timeupdate", handleTimeUpdate);
      videoElement.removeEventListener("durationchange", handleDurationChange);
      videoElement.removeEventListener("loadedmetadata", handleDurationChange);
      videoElement.removeEventListener("play", handlePlay);
      videoElement.removeEventListener("pause", handlePause);
      videoElement.removeEventListener("ended", handleEnded);
    };
  }, [videoElementTrigger]);

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

  const seek = useCallback(
    (time: number) => {
      if (videoElementRef.current) {
        videoElementRef.current.currentTime = Math.max(
          0,
          Math.min(time, duration),
        );
      }
    },
    [duration],
  );

  const setPlaybackSpeed = useCallback((speed: PlaybackSpeed) => {
    if (videoElementRef.current) {
      videoElementRef.current.playbackRate = speed;
    }
    setPlaybackSpeedState(speed);
  }, []);

  const stepFrame = useCallback(
    (direction: "forward" | "backward") => {
      if (videoElementRef.current) {
        // Pause video when stepping frames
        videoElementRef.current.pause();
        const delta =
          direction === "forward" ? FRAME_DURATION : -FRAME_DURATION;
        videoElementRef.current.currentTime = Math.max(
          0,
          Math.min(videoElementRef.current.currentTime + delta, duration),
        );
      }
    },
    [duration],
  );

  const skip = useCallback(
    (direction: "forward" | "backward") => {
      if (videoElementRef.current) {
        const delta = direction === "forward" ? SKIP_DURATION : -SKIP_DURATION;
        videoElementRef.current.currentTime = Math.max(
          0,
          Math.min(videoElementRef.current.currentTime + delta, duration),
        );
      }
    },
    [duration],
  );

  return {
    setVideoElement,
    currentTime,
    duration,
    isPlaying,
    playbackSpeed,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackSpeed,
    stepFrame,
    skip,
  };
}
