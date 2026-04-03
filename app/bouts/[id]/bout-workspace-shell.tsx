"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Edit2, Library, Loader2, Upload, Video } from "lucide-react";
import { BoutAnalysis } from "@/components/bout-analysis";
import { ExportButton } from "@/components/export-button";
import { NewBoutDialog } from "@/components/new-bout-dialog";
import { TagForm, type TagFormHandle } from "@/components/tag-form";
import { TagList } from "@/components/tag-list";
import { VideoLibraryPicker } from "@/components/video-library-picker";
import { VideoPlayer } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBoutVideo } from "@/hooks/use-bout-video";
import {
  useSessions,
  type AddTagParams,
  type PersistedSessionVideoSelection,
  type SessionDraftParams,
} from "@/hooks/use-sessions";
import { useVideo } from "@/hooks/use-video";
import { getBoutDisplayLabel } from "@/lib/session-selectors";
import type { VideoLibraryItem } from "@/lib/video-library";

interface BoutWorkspaceShellProps {
  boutId: string;
}

export function BoutWorkspaceShell({ boutId }: BoutWorkspaceShellProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagFormRef = useRef<TagFormHandle>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);

  const video = useVideo();
  const {
    sessions,
    getSessionById,
    addTag,
    deleteTag,
    exportToCSV,
    updateSessionEntry,
    allFencerNames,
  } = useSessions();

  const session = getSessionById(boutId);
  const tags = session?.tags ?? [];
  const {
    activeVideoBadge,
    activeVideoFileName,
    activeVideoUrl,
    handlePersistedVideoSelection,
    hasAttachedLibraryVideo,
    hasTemporaryOverride,
    isTemporaryOnly,
    loadTemporaryVideo,
    selectedLibraryRelativePath,
    showLibraryLoadingState,
    showUnavailableState,
  } = useBoutVideo({
    session,
    onSourceChange: video.resetZoom,
  });

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file || !session) {
        return;
      }

      loadTemporaryVideo(file);
      event.target.value = "";
    },
    [loadTemporaryVideo, session],
  );

  const handleAttachLibraryVideo = useCallback(
    (selectedVideo: VideoLibraryItem) => {
      if (!session) {
        return;
      }

      updateSessionEntry(session.id, {}, {
        kind: "library",
        video: selectedVideo,
      });
      handlePersistedVideoSelection({
        kind: "library",
        video: selectedVideo,
      });
      setIsLibraryPickerOpen(false);
    },
    [handlePersistedVideoSelection, session, updateSessionEntry],
  );

  const handleRemoveAttachedVideo = useCallback(() => {
    if (!session) {
      return;
    }

    updateSessionEntry(session.id, {}, { kind: "none" });
    handlePersistedVideoSelection({ kind: "none" });
  }, [handlePersistedVideoSelection, session, updateSessionEntry]);

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
    <>
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsLibraryPickerOpen(true)}
            >
              <Video className="mr-1.5 h-4 w-4" />
              {hasAttachedLibraryVideo ? "Replace From Library" : "Attach From Library"}
            </Button>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />
              Load Temporary File
            </Button>
            {hasAttachedLibraryVideo ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemoveAttachedVideo}
              >
                Remove Attached Video
              </Button>
            ) : null}
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
            onUpdateSession={(
              params: SessionDraftParams,
              videoSelection: PersistedSessionVideoSelection,
            ) => {
              updateSessionEntry(session.id, params, videoSelection);
              handlePersistedVideoSelection(videoSelection);
            }}
            fencerNames={allFencerNames}
          />
        </header>

        <TabsContent value="tagging" className="mt-0 flex-1 overflow-hidden p-2">
          <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-[1fr_280px]">
            <div className="flex min-h-0 flex-col gap-2">
              {activeVideoUrl ? (
                <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card p-2">
                  <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                    <Badge variant={hasTemporaryOverride ? "secondary" : "outline"}>
                      {activeVideoBadge}
                    </Badge>
                    {activeVideoFileName ? (
                      <span className="max-w-[320px] truncate text-sm text-muted-foreground">
                        {activeVideoFileName}
                      </span>
                    ) : null}
                    {hasTemporaryOverride ? (
                      <span className="text-xs text-muted-foreground">
                        Temporary file will be lost on refresh.
                      </span>
                    ) : null}
                  </div>
                  <VideoPlayer videoUrl={activeVideoUrl} video={video} maximized />
                </div>
              ) : showLibraryLoadingState ? (
                <div className="flex h-[140px] flex-none flex-col items-center justify-center gap-2 rounded-lg border bg-card p-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-sm">Checking attached video...</p>
                </div>
              ) : showUnavailableState ? (
                <div className="flex h-[160px] flex-none flex-col items-center justify-center gap-3 rounded-lg border bg-card p-3 text-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Attached video is unavailable
                    </p>
                    {session.fileName ? (
                      <p className="text-xs text-muted-foreground">
                        Stored filename: {session.fileName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLibraryPickerOpen(true)}
                    >
                      Replace From Library
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Load Temporary File
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAttachedVideo}
                    >
                      Remove Attached Video
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-[160px] flex-none flex-col items-center justify-center gap-3 rounded-lg border bg-card p-3 text-center">
                  <p className="text-sm">
                    {isTemporaryOnly
                      ? "Temporary video metadata exists for this bout, but the file is not loaded."
                      : "No video attached to this bout"}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLibraryPickerOpen(true)}
                    >
                      Attach From Library
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Load Temporary File
                    </Button>
                  </div>
                  {isTemporaryOnly ? (
                    <p className="text-xs text-muted-foreground">
                      Temporary files need to be loaded again after refresh.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="rounded-lg border bg-card p-3">
                <TagForm
                  ref={tagFormRef}
                  onAddTag={handleAddTag}
                  currentTime={activeVideoUrl ? video.currentTime : undefined}
                />
              </div>
            </div>

            <div className="min-h-0">
              <TagList
                tags={tags}
                onDelete={handleDeleteTag}
                onSeek={activeVideoUrl ? video.seek : undefined}
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

      <Dialog open={isLibraryPickerOpen} onOpenChange={setIsLibraryPickerOpen}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>
              {hasAttachedLibraryVideo ? "Replace Attached Video" : "Attach Video From Library"}
            </DialogTitle>
            <DialogDescription>
              Choose a video from your local video library. This attachment
              persists across refreshes and navigation.
            </DialogDescription>
          </DialogHeader>
          <VideoLibraryPicker
            open={isLibraryPickerOpen}
            confirmLabel={hasAttachedLibraryVideo ? "Replace Video" : "Attach Video"}
            selectedRelativePath={selectedLibraryRelativePath ?? undefined}
            onCancel={() => setIsLibraryPickerOpen(false)}
            onConfirm={handleAttachLibraryVideo}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
