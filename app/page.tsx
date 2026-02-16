"use client";

import { useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { TagForm, type TagFormHandle } from "@/components/tag-form";
import { TagList } from "@/components/tag-list";
import { BoutMetadataForm } from "@/components/bout-metadata-form";
import { ExportButton } from "@/components/export-button";
import { useVideo } from "@/hooks/use-video";
import { useSessions, type AddTagParams } from "@/hooks/use-sessions";
import { useVideoContext } from "@/contexts/video-context";
import { Upload, Library } from "lucide-react";

export default function Home() {
  const { videoUrl, fileName, setVideo } = useVideoContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagFormRef = useRef<TagFormHandle>(null);

  const video = useVideo();
  const {
    sessions,
    getSession,
    addTag,
    deleteTag,
    updateSession,
    exportToCSV,
  } = useSessions();

  const currentSession = fileName ? getSession(fileName) : undefined;
  const tags = currentSession?.tags ?? [];

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset zoom/pan state when switching videos
      video.resetZoom();

      const url = URL.createObjectURL(file);
      setVideo(url, file.name);
    },
    [video, setVideo],
  );

  const handleAddTag = useCallback(
    (params: AddTagParams) => {
      if (!fileName) return;
      addTag(fileName, params);
    },
    [fileName, addTag],
  );

  const handleDeleteTag = useCallback(
    (tagId: string) => {
      if (!fileName) return;
      deleteTag(fileName, tagId);
    },
    [fileName, deleteTag],
  );

  const handleUpdateSession = useCallback(
    (updates: {
      leftFencer?: string;
      rightFencer?: string;
      boutDate?: string;
    }) => {
      if (!fileName) return;
      updateSession(fileName, updates);
    },
    [fileName, updateSession],
  );

  // Global keyboard shortcuts for form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "q": // Select side L
          e.preventDefault();
          tagFormRef.current?.setSide("L");
          break;
        case "e": // Select side R
          e.preventDefault();
          tagFormRef.current?.setSide("R");
          break;
        case "t": // Toggle tactical mistake
          e.preventDefault();
          tagFormRef.current?.toggleMistake("tactical");
          break;
        case "y": // Toggle execution mistake
          e.preventDefault();
          tagFormRef.current?.toggleMistake("execution");
          break;
        case "enter": // Submit tag
          if (!e.shiftKey) {
            e.preventDefault();
            tagFormRef.current?.submit();
          }
          break;
        case "/": // Focus action search
          e.preventDefault();
          tagFormRef.current?.focusAction();
          break;
        case "n": // Focus comment
          e.preventDefault();
          tagFormRef.current?.focusComment();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Minimal header */}
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b">
        <Link href="/bouts">
          <Button variant="ghost" size="sm">
            <Library className="h-4 w-4 mr-1.5" />
            Bouts
          </Button>
        </Link>

        <span className="text-sm text-muted-foreground truncate max-w-[300px]">
          {fileName ?? "No video selected"}
        </span>

        <div className="flex gap-2">
          <ExportButton
            exportToCSV={exportToCSV}
            disabled={sessions.length === 0}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" />
            Select Video
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden p-2">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-2">
          {/* Left: Video + Forms */}
          <div className="flex flex-col min-h-0 gap-2">
            {/* Video Player - takes remaining space */}
            <div className="flex-1 min-h-0 bg-card rounded-lg border overflow-hidden p-2">
              <VideoPlayer videoUrl={videoUrl} video={video} maximized />
            </div>

            {/* Below Video: Tag Form + Bout Info in single compact row */}
            <div className="shrink-0 bg-card rounded-lg p-2 border">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1">
                  <TagForm
                    ref={tagFormRef}
                    currentTime={video.currentTime}
                    onAddTag={handleAddTag}
                    disabled={!videoUrl}
                  />
                </div>
                <div className="lg:border-l lg:pl-3">
                  <BoutMetadataForm
                    session={currentSession}
                    onUpdate={handleUpdateSession}
                    disabled={!fileName}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Tag timeline */}
          <div className="bg-card rounded-lg border flex flex-col min-h-0 lg:h-full h-[300px]">
            <div className="p-2 border-b shrink-0 flex items-center justify-between">
              <span className="text-sm font-medium">Tags</span>
              <span className="text-xs text-muted-foreground">
                {tags.length}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden p-2">
              <TagList
                tags={tags}
                onSeek={video.seek}
                onDelete={handleDeleteTag}
                fillHeight
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
