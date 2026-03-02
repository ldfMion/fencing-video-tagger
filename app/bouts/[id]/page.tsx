"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { TagForm, type TagFormHandle } from "@/components/tag-form";
import { TagList } from "@/components/tag-list";
import { NewBoutDialog } from "@/components/new-bout-dialog";
import { ExportButton } from "@/components/export-button";
import { useVideo } from "@/hooks/use-video";
import { useSessions, type AddTagParams } from "@/hooks/use-sessions";
import { useVideoContext } from "@/contexts/video-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoutAnalysis } from "@/components/bout-analysis";
import { Upload, Library, AlertCircle, Edit2 } from "lucide-react";

export default function BoutPage() {
  const params = useParams<{ id: string }>();
  const { videoUrl, fileName, setVideo } = useVideoContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagFormRef = useRef<TagFormHandle>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const video = useVideo();
  const {
    sessions,
    getSessionById,
    addTag,
    deleteTag,
    updateSession,
    exportToCSV,
    allFencerNames,
  } = useSessions();

  const session = getSessionById(params.id);
  const tags = session?.tags ?? [];

  const hasVideo = videoUrl && fileName === session?.fileName;

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      video.resetZoom();

      const url = URL.createObjectURL(file);
      setVideo(url, file.name);

      if (session && !session.boutDate) {
        updateSession(session.id, {
          boutDate: new Date(file.lastModified).toISOString().split("T")[0],
        });
      }
    },
    [video, setVideo, session, updateSession],
  );

  const handleAddTag = useCallback(
    (params: AddTagParams) => {
      if (!session) return;
      addTag(session.id, params);
    },
    [session, addTag],
  );

  const handleDeleteTag = useCallback(
    (tagId: string) => {
      if (!session) return;
      deleteTag(session.id, tagId);
    },
    [session, deleteTag],
  );

  const handleUpdateSession = useCallback(
    (updates: {
      leftFencer?: string;
      rightFencer?: string;
      boutDate?: string;
      externalSource?: string;
    }) => {
      if (!session) return;
      updateSession(session.id, updates);
    },
    [session, updateSession],
  );

  // Global keyboard shortcuts for form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "q":
          e.preventDefault();
          tagFormRef.current?.setSide("L");
          break;
        case "e":
          e.preventDefault();
          tagFormRef.current?.setSide("R");
          break;
        case "t":
          e.preventDefault();
          tagFormRef.current?.toggleMistake("tactical");
          break;
        case "y":
          e.preventDefault();
          tagFormRef.current?.toggleMistake("execution");
          break;
        case "enter":
          if (!e.shiftKey) {
            e.preventDefault();
            tagFormRef.current?.submit();
          }
          break;
        case "/":
          e.preventDefault();
          tagFormRef.current?.focusAction();
          break;
        case "n":
          e.preventDefault();
          tagFormRef.current?.focusComment();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Bout not found
  if (!session) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Bout not found</h1>
        <p className="text-muted-foreground">
          This bout doesn&apos;t exist or may have been deleted.
        </p>
        <Link href="/">
          <Button variant="outline">
            <Library className="h-4 w-4 mr-1.5" />
            Back to Bouts
          </Button>
        </Link>
      </div>
    );
  }

  const boutLabel =
    session.leftFencer && session.rightFencer
      ? `${session.leftFencer} vs ${session.rightFencer}`
      : session.fileName ?? "Untitled Bout";

  return (
    <Tabs defaultValue="tagging" className="h-screen flex flex-col bg-background">
      {/* Header with breadcrumb */}
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b">
        <div className="flex items-center gap-1">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <Library className="h-4 w-4 mr-1.5" />
              Bouts
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={() => setIsEditDialogOpen(true)}
            className="text-sm truncate max-w-[200px] hover:underline text-foreground"
          >
            {boutLabel}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <TabsList className="h-8">
            <TabsTrigger value="tagging" className="text-xs px-3 h-6">
              Tagging
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs px-3 h-6">
              Analysis
            </TabsTrigger>
          </TabsList>
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Edit2 className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
        </div>

        <NewBoutDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          editSession={session}
          onUpdateSession={handleUpdateSession}
          fencerNames={allFencerNames}
        />
      </header>

      {/* Tagging tab */}
      <TabsContent value="tagging" className="flex-1 overflow-hidden p-2 mt-0">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-2">
          {/* Left: Video + Forms */}
          <div className="flex flex-col min-h-0 gap-2">
            {/* Video Player or Videoless Banner */}
            {hasVideo ? (
              <div className="flex-1 min-h-0 bg-card rounded-lg border overflow-hidden p-2">
                <VideoPlayer videoUrl={videoUrl} video={video} maximized />
              </div>
            ) : (
              <div className="flex-none h-[120px] bg-card rounded-lg border p-2 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <p className="text-sm">
                  {session.fileName
                    ? "Select the video file to start tagging"
                    : "No video — tag events manually"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {session.fileName ? "Select Different Video" : "Attach Video"}
                </Button>
              </div>
            )}

            {/* Tag Form */}
            <div className="shrink-0 bg-card rounded-lg p-2 border">
              <TagForm
                ref={tagFormRef}
                currentTime={hasVideo ? video.currentTime : undefined}
                onAddTag={handleAddTag}
              />
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
                onSeek={hasVideo ? video.seek : undefined}
                onDelete={handleDeleteTag}
                fillHeight
              />
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Analysis tab */}
      <TabsContent value="analysis" className="flex-1 overflow-auto mt-0">
        <BoutAnalysis
          tags={tags}
          leftFencer={session.leftFencer}
          rightFencer={session.rightFencer}
        />
      </TabsContent>
    </Tabs>
  );
}
