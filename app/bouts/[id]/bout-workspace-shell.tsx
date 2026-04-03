"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Edit2, Library, Upload } from "lucide-react";
import { BoutAnalysis } from "@/components/bout-analysis";
import { ExportButton } from "@/components/export-button";
import { NewBoutDialog } from "@/components/new-bout-dialog";
import { TagForm, type TagFormHandle } from "@/components/tag-form";
import { TagList } from "@/components/tag-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { useVideoContext } from "@/contexts/video-context";
import { useSessions, type AddTagParams } from "@/hooks/use-sessions";
import { useVideo } from "@/hooks/use-video";
import { deriveBoutDateFromFileMetadata } from "@/lib/date-utils";
import { getBoutDisplayLabel } from "@/lib/session-selectors";

interface BoutWorkspaceShellProps {
  boutId: string;
}

export function BoutWorkspaceShell({ boutId }: BoutWorkspaceShellProps) {
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

  const session = getSessionById(boutId);
  const tags = session?.tags ?? [];
  const hasVideo = videoUrl && fileName === session?.fileName;

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      video.resetZoom();

      const url = URL.createObjectURL(file);
      setVideo(url, file.name);

      if (session && !session.fileName) {
        updateSession(session.id, { fileName: file.name });
      }

      if (session && !session.boutDate) {
        updateSession(session.id, {
          boutDate: deriveBoutDateFromFileMetadata(file.lastModified),
        });
      }
    },
    [session, setVideo, updateSession, video],
  );

  const handleAddTag = useCallback(
    (params: AddTagParams) => {
      if (!session) {
        return;
      }

      addTag(session.id, params);
    },
    [addTag, session],
  );

  const handleDeleteTag = useCallback(
    (tagId: string) => {
      if (!session) {
        return;
      }

      deleteTag(session.id, tagId);
    },
    [deleteTag, session],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "q":
          event.preventDefault();
          tagFormRef.current?.setSide("L");
          break;
        case "e":
          event.preventDefault();
          tagFormRef.current?.setSide("R");
          break;
        case "t":
          event.preventDefault();
          tagFormRef.current?.toggleMistake("tactical");
          break;
        case "y":
          event.preventDefault();
          tagFormRef.current?.toggleMistake("execution");
          break;
        case "enter":
          if (!event.shiftKey) {
            event.preventDefault();
            tagFormRef.current?.submit();
          }
          break;
        case "/":
          event.preventDefault();
          tagFormRef.current?.focusAction();
          break;
        case "n":
          event.preventDefault();
          tagFormRef.current?.focusComment();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Bout not found</h1>
        <p className="text-muted-foreground">
          This bout doesn&apos;t exist or may have been deleted.
        </p>
        <Link href="/">
          <Button variant="outline">
            <Library className="mr-1.5 h-4 w-4" />
            Back to Bouts
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Tabs defaultValue="tagging" className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-1">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <Library className="mr-1.5 h-4 w-4" />
              Bouts
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={() => setIsEditDialogOpen(true)}
            className="max-w-[200px] truncate text-sm text-foreground hover:underline"
          >
            {getBoutDisplayLabel(session)}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <TabsList className="h-8">
            <TabsTrigger value="tagging" className="h-6 px-3 text-xs">
              Tagging
            </TabsTrigger>
            <TabsTrigger value="analysis" className="h-6 px-3 text-xs">
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
            <Upload className="mr-1.5 h-4 w-4" />
            {hasVideo
              ? "Change Video"
              : session.fileName
                ? "Load Video"
                : "Attach Video"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Edit2 className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
        </div>

        <NewBoutDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          editSession={session}
          onUpdateSession={(updates) => updateSession(session.id, updates)}
          fencerNames={allFencerNames}
        />
      </header>

      <TabsContent value="tagging" className="mt-0 flex-1 overflow-hidden p-2">
        <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-0 flex-col gap-2">
            {hasVideo ? (
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card p-2">
                <VideoPlayer videoUrl={videoUrl} video={video} maximized />
              </div>
            ) : (
              <div className="flex h-[120px] flex-none flex-col items-center justify-center gap-2 rounded-lg border bg-card p-2 text-muted-foreground">
                {session.fileName ? (
                  <>
                    <p className="text-sm">
                      Video:{" "}
                      <span className="font-medium text-foreground">
                        {session.fileName}
                      </span>
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-1.5 h-4 w-4" />
                        Load Video
                      </Button>
                      <button
                        className="text-xs underline hover:text-foreground"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Use a different file
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm">No video attached to this bout</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      Attach Video
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-card p-3">
              <TagForm
                ref={tagFormRef}
                onAddTag={handleAddTag}
                currentTime={hasVideo ? video.currentTime : undefined}
              />
            </div>
          </div>

          <div className="min-h-0">
            <TagList
              tags={tags}
              onDelete={handleDeleteTag}
              onSeek={hasVideo ? video.seek : undefined}
              fillHeight
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="analysis" className="mt-0 flex-1 overflow-auto p-4">
        <BoutAnalysis
          tags={tags}
          leftFencer={session.leftFencer}
          rightFencer={session.rightFencer}
        />
      </TabsContent>
    </Tabs>
  );
}
