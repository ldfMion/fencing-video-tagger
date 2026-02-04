"use client";

import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  PLAYBACK_SPEEDS,
  ZOOM_LEVELS,
  type PlaybackSpeed,
  type UseVideoReturn,
} from "@/hooks/use-video";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

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

// Reverse map for tooltip display
const SPEED_SHORTCUT_MAP: Record<PlaybackSpeed, string> = {
  0.2: "1",
  0.4: "2",
  0.5: "3",
  0.7: "4",
  1: "5",
  2: "6",
  3: "7",
};

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
    playbackSpeed,
    zoomLevel,
    panX,
    panY,
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
  } = video;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ": // Space - play/pause
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft": // Left arrow - frame back or skip back/pan left with shift
          e.preventDefault();
          if (e.shiftKey && zoomLevel > 1) {
            panLeft();
          } else if (e.shiftKey) {
            skip("backward");
          } else {
            stepFrame("backward");
          }
          break;
        case "ArrowRight": // Right arrow - frame forward or skip forward/pan right with shift
          e.preventDefault();
          if (e.shiftKey && zoomLevel > 1) {
            panRight();
          } else if (e.shiftKey) {
            skip("forward");
          } else {
            stepFrame("forward");
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
          skip("backward");
          break;
        case "l": // l - skip forward
          e.preventDefault();
          skip("forward");
          break;
        case "k": // k - play/pause (YouTube style)
          e.preventDefault();
          togglePlay();
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
    togglePlay,
    stepFrame,
    skip,
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
    <TooltipProvider delayDuration={300}>
      <div className="space-y-2">
        <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
          <video
            ref={setVideoElement}
            src={videoUrl}
            className="w-full h-full object-contain"
            style={{
              transform: `scale(${zoomLevel}) translate(${panX}%, ${panY}%)`,
              transition: "transform 0.1s ease-out",
            }}
            onClick={togglePlay}
          />
        </div>

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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Frame back */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => stepFrame("backward")}
              >
                <ChevronLeft className="h-4 w-4" />
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
                size="icon"
                onClick={() => skip("backward")}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Back 5 seconds (J or Shift+←)</p>
            </TooltipContent>
          </Tooltip>

          {/* Play/Pause */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={togglePlay}>
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
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
                size="icon"
                onClick={() => skip("forward")}
              >
                <SkipForward className="h-4 w-4" />
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
                size="icon"
                onClick={() => stepFrame("forward")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Next frame (→)</p>
            </TooltipContent>
          </Tooltip>

          {/* Time display */}
          <span className="text-sm text-muted-foreground px-2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={zoomOut}
                  disabled={zoomLevel === ZOOM_LEVELS[0]}
                >
                  <ZoomOut className="h-4 w-4" />
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
                  size="sm"
                  onClick={resetZoom}
                  className="px-2 h-8 min-w-[3.5rem]"
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
                  size="icon"
                  onClick={zoomIn}
                  disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                >
                  <ZoomIn className="h-4 w-4" />
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
              <span className="text-sm text-muted-foreground mr-1">Pan:</span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={panUp}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan up (W or Shift+↑)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={panLeft}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan left (A or Shift+←)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={panDown}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan down (S or Shift+↓)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={panRight}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Pan right (D or Shift+→)</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={centerPan}>
                    <Crosshair className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Center pan (C)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Speed selector */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-sm text-muted-foreground mr-1">Speed:</span>
            {PLAYBACK_SPEEDS.map((speed) => (
              <Tooltip key={speed}>
                <TooltipTrigger asChild>
                  <Button
                    variant={playbackSpeed === speed ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlaybackSpeed(speed)}
                    className="px-2 h-8 min-w-[3rem]"
                  >
                    {speed}x
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {speed}x speed ({SPEED_SHORTCUT_MAP[speed]})
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
