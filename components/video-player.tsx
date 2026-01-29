"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import type { UseVideoReturn } from "@/hooks/use-video";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface VideoPlayerProps {
  videoUrl: string | null;
  video: UseVideoReturn;
}

export function VideoPlayer({ videoUrl, video }: VideoPlayerProps) {
  const {
    setVideoElement,
    currentTime,
    duration,
    isPlaying,
    togglePlay,
    seek,
  } = video;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      seek(percent * duration);
    },
    [duration, seek],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!videoUrl) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Select a video file to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <video
        ref={setVideoElement}
        src={videoUrl}
        className="w-full aspect-video bg-black rounded-lg"
        onClick={togglePlay}
      />

      {/* Progress bar */}
      <div
        className="h-2 bg-muted rounded-full cursor-pointer"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={togglePlay}>
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <span className="text-sm text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
