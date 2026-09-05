"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Loader2,
} from "lucide-react";
import {
  PLAYBACK_SPEEDS,
  ZOOM_LEVELS,
  type PlaybackSpeed,
  type UseVideoReturn,
} from "@/hooks/use-video";
import { formatTime } from "@/lib/utils";

// Map keyboard numbers to speed values
const SPEED_KEY_MAP: Record<string, PlaybackSpeed> = {
  "1": 0.2,
  "2": 0.4,
  "3": 0.5,
  "4": 0.7,
  "5": 1,
  "6": 2,
  "7": 3,
};

interface VideoPlayerProps {
  videoUrl: string | null;
  video: UseVideoReturn;
  maximized?: boolean;
  playbackWindow?: {
    start: number;
    end: number;
    autoPlay?: boolean;
  };
}

export function VideoPlayer({
  videoUrl,
  video,
  maximized = false,
  playbackWindow,
}: VideoPlayerProps) {
  const {
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
    playAt,
    pause,
    togglePlay,
    seek,
    setPlaybackSpeed,
    stepFrame,
    skip,
    zoomIn,
    zoomOut,
    resetZoom,
    panUp,
    panDown,
    panLeft,
    panRight,
    centerPan,
    clearError,
  } = video;
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const windowStart = playbackWindow?.start ?? 0;
  const windowEnd = playbackWindow?.end ?? duration;
  const handleVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoElementRef.current = element;
    setVideoElement(element);
  }, [setVideoElement]);

  const seekWithinWindow = useCallback(
    (time: number) => {
      seek(playbackWindow ? Math.max(windowStart, Math.min(time, windowEnd)) : time);
    },
    [playbackWindow, seek, windowEnd, windowStart],
  );

  const toggleWindowPlayback = useCallback(() => {
    if (!playbackWindow) {
      togglePlay();
      return;
    }
    if (isPlaying) {
      pause();
      return;
    }
    const actualCurrentTime = videoElementRef.current?.currentTime ?? currentTime;
    if (actualCurrentTime < windowStart || actualCurrentTime >= windowEnd - 0.05) {
      playAt(windowStart);
      return;
    }
    play();
  }, [currentTime, isPlaying, pause, play, playAt, playbackWindow, togglePlay, windowEnd, windowStart]);

  const stepWithinWindow = useCallback(
    (direction: "forward" | "backward") => {
      if (!playbackWindow) {
        stepFrame(direction);
        return;
      }
      pause();
      seekWithinWindow(currentTime + (direction === "forward" ? 1 / 30 : -1 / 30));
    },
    [currentTime, pause, playbackWindow, seekWithinWindow, stepFrame],
  );

  const skipWithinWindow = useCallback(
    (direction: "forward" | "backward") => {
      if (!playbackWindow) {
        skip(direction);
        return;
      }
      seekWithinWindow(currentTime + (direction === "forward" ? 5 : -5));
    },
    [currentTime, playbackWindow, seekWithinWindow, skip],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore video shortcuts while an editable or dropdown control is active.
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement &&
          e.target.closest('[data-slot^="select-"]'))
      ) {
        return;
      }

      switch (e.key) {
        case " ": // Space - play/pause
          e.preventDefault();
          toggleWindowPlayback();
          break;
        case "ArrowLeft": // Left arrow - frame back or skip back/pan left with shift
          e.preventDefault();
          if (e.shiftKey && zoomLevel > 1) {
            panLeft();
          } else if (e.shiftKey) {
            skipWithinWindow("backward");
          } else {
            stepWithinWindow("backward");
          }
          break;
        case "ArrowRight": // Right arrow - frame forward or skip forward/pan right with shift
          e.preventDefault();
          if (e.shiftKey && zoomLevel > 1) {
            panRight();
          } else if (e.shiftKey) {
            skipWithinWindow("forward");
          } else {
            stepWithinWindow("forward");
          }
          break;
        case "ArrowUp": // Up arrow - pan up with shift when zoomed
          if (e.shiftKey && zoomLevel > 1) {
            e.preventDefault();
            panUp();
          }
          break;
        case "ArrowDown": // Down arrow - pan down with shift when zoomed
          if (e.shiftKey && zoomLevel > 1) {
            e.preventDefault();
            panDown();
          }
          break;
        case "j": // j - skip backward
          e.preventDefault();
          skipWithinWindow("backward");
          break;
        case "l": // l - skip forward
          e.preventDefault();
          skipWithinWindow("forward");
          break;
        case "k": // k - play/pause (YouTube style)
          e.preventDefault();
          toggleWindowPlayback();
          break;
        case "+":
        case "=": // Plus/equals - zoom in
          e.preventDefault();
          zoomIn();
          break;
        case "-": // Minus - zoom out
          e.preventDefault();
          zoomOut();
          break;
        case "0": // Zero - reset zoom and pan
          e.preventDefault();
          resetZoom();
          break;
        case "w":
        case "W": // W - pan up when zoomed
          if (zoomLevel > 1) {
            e.preventDefault();
            panUp();
          }
          break;
        case "a":
        case "A": // A - pan left when zoomed
          if (zoomLevel > 1) {
            e.preventDefault();
            panLeft();
          }
          break;
        case "s":
        case "S": // S - pan down when zoomed
          if (zoomLevel > 1) {
            e.preventDefault();
            panDown();
          }
          break;
        case "d":
        case "D": // D - pan right when zoomed
          if (zoomLevel > 1) {
            e.preventDefault();
            panRight();
          }
          break;
        case "c":
        case "C": // C - center pan when zoomed
          if (zoomLevel > 1) {
            e.preventDefault();
            centerPan();
          }
          break;
        default:
          // Number keys for speed
          if (SPEED_KEY_MAP[e.key]) {
            e.preventDefault();
            setPlaybackSpeed(SPEED_KEY_MAP[e.key]);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleWindowPlayback,
    stepWithinWindow,
    skipWithinWindow,
    setPlaybackSpeed,
    zoomIn,
    zoomOut,
    resetZoom,
    panUp,
    panDown,
    panLeft,
    panRight,
    centerPan,
    zoomLevel,
  ]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      seekWithinWindow(playbackWindow
        ? windowStart + (percent * (windowEnd - windowStart))
        : percent * duration);
    },
    [duration, playbackWindow, seekWithinWindow, windowEnd, windowStart],
  );

  const displayDuration = playbackWindow ? windowEnd - windowStart : duration;
  const displayCurrentTime = playbackWindow
    ? Math.max(0, Math.min(currentTime - windowStart, displayDuration))
    : currentTime;
  const progress = displayDuration > 0 ? (displayCurrentTime / displayDuration) * 100 : 0;

  if (!videoUrl) {
    return (
      <div
        className={`${maximized ? "h-full" : "aspect-video"} bg-muted rounded-lg flex items-center justify-center`}
      >
        <p className="text-muted-foreground">Select a video file to begin</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${maximized ? "h-full" : "aspect-video"} bg-muted rounded-lg flex flex-col items-center justify-center gap-4`}
      >
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={clearError}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={
          maximized ? "h-full min-h-0" : ""
        }
      >
        <div
          className={`${maximized ? "h-full min-h-0" : "aspect-video"} video-frame bg-black overflow-hidden flex items-center justify-center relative`}
        >
          <video
            ref={handleVideoElement}
            src={videoUrl}
            preload="auto"
            className="w-full h-full object-contain"
            style={{
              transform: `scale(${zoomLevel}) translate(${panX}%, ${panY}%)`,
              transition: "transform 0.1s ease-out",
            }}
            onClick={toggleWindowPlayback}
            onLoadedMetadata={(event) => {
              if (!playbackWindow) return;
              event.currentTarget.currentTime = windowStart;
              if (playbackWindow.autoPlay) {
                void event.currentTarget.play().catch(() => undefined);
              }
            }}
            onTimeUpdate={(event) => {
              if (playbackWindow && event.currentTarget.currentTime >= windowEnd) {
                event.currentTarget.pause();
              }
            }}
          />
          {isSeeking && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-12 w-12 text-white animate-spin" />
            </div>
          )}

          <div className="video-control-overlay absolute inset-x-3 bottom-3 z-10 space-y-2 px-0.5">
            {/* Progress bar */}
            <div
              className="video-scrubber h-1.5 cursor-pointer rounded-full"
              onClick={handleProgressClick}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Controls */}
            <div className="video-controls flex shrink-0 flex-wrap items-center gap-1.5">
          {/* Frame back */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous frame"
                onClick={() => stepWithinWindow("backward")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Previous frame (←)</p>
            </TooltipContent>
          </Tooltip>

          {/* Skip back 5s */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Back 5 seconds"
                onClick={() => skipWithinWindow("backward")}
              >
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Back 5 seconds (J or Shift+←)</p>
            </TooltipContent>
          </Tooltip>

          {/* Play/Pause */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={isPlaying ? "Pause" : "Play"}
                onClick={toggleWindowPlayback}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPlaying ? "Pause" : "Play"} (Space or K)</p>
            </TooltipContent>
          </Tooltip>

          {/* Skip forward 5s */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Forward 5 seconds"
                onClick={() => skipWithinWindow("forward")}
              >
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Forward 5 seconds (L or Shift+→)</p>
            </TooltipContent>
          </Tooltip>

          {/* Frame forward */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next frame"
                onClick={() => stepWithinWindow("forward")}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Next frame (→)</p>
            </TooltipContent>
          </Tooltip>

          {/* Time display */}
          <span className="px-1.5 text-xs text-muted-foreground">
            {formatTime(displayCurrentTime)} / {formatTime(displayDuration)}
          </span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom out"
                  onClick={zoomOut}
                  disabled={zoomLevel === ZOOM_LEVELS[0]}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom out (-)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={resetZoom}
                  className="min-w-[3.25rem] px-1.5"
                >
                  {Math.round(zoomLevel * 100)}%
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset zoom & pan (0)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Zoom in"
                  onClick={zoomIn}
                  disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Zoom in (+)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Pan controls - only show when zoomed in */}
          {zoomLevel > 1 && (
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">Pan:</span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Pan up" onClick={panUp}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan up (W or Shift+↑)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Pan left" onClick={panLeft}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan left (A or Shift+←)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Pan down" onClick={panDown}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan down (S or Shift+↓)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Pan right" onClick={panRight}>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan right (D or Shift+→)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Center pan" onClick={centerPan}>
                    <Crosshair className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Center pan (C)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Speed selector */}
          <div className="ml-auto flex items-center">
            <Select
              value={String(playbackSpeed)}
              onValueChange={(value) => {
                const speed = Number(value) as PlaybackSpeed;

                if (PLAYBACK_SPEEDS.includes(speed)) {
                  setPlaybackSpeed(speed);
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="video-speed-trigger w-[3.75rem]"
                aria-label="Playback speed"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[6rem]">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {speed}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}
