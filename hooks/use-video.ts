"use client";

import { useState, useCallback, useEffect } from "react";

export interface UseVideoReturn {
  setVideoElement: (el: HTMLVideoElement | null) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
}

export function useVideo(): UseVideoReturn {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
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
  }, [videoElement]);

  const play = useCallback(() => {
    videoElement?.play();
  }, [videoElement]);

  const pause = useCallback(() => {
    videoElement?.pause();
  }, [videoElement]);

  const togglePlay = useCallback(() => {
    if (videoElement?.paused) {
      videoElement.play();
    } else {
      videoElement?.pause();
    }
  }, [videoElement]);

  const seek = useCallback(
    (time: number) => {
      if (videoElement) {
        videoElement.currentTime = time;
      }
    },
    [videoElement],
  );

  return {
    setVideoElement,
    currentTime,
    duration,
    isPlaying,
    play,
    pause,
    togglePlay,
    seek,
  };
}
