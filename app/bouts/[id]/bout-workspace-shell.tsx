"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Edit2,
  Library,
  Loader2,
  Upload,
  Video,
} from "lucide-react";
import { BoutAnalysis } from "@/components/bout-analysis";
import { BoutExportButton } from "@/components/export-button";
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
import { getTodayIsoDate } from "@/lib/date-utils";
import { useVideo } from "@/hooks/use-video";
import { getBoutDisplayLabel } from "@/lib/session-selectors";
import { findTagById, getSharedTagHref } from "@/lib/tag-share";
import type { VideoSession } from "@/lib/types";
import type { VideoLibraryItem } from "@/lib/video-library";

interface BoutWorkspaceShellProps {
  boutId: string;
  initialSessions: VideoSession[];
  initialTagId: string | null;
}

export function BoutWorkspaceShell({
  boutId,
  initialSessions,
  initialTagId,
}: BoutWorkspaceShellProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagFormRef = useRef<TagFormHandle>(null);
  const hasAppliedInitialTagRef = useRef(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">("idle");

  const video = useVideo();
  const {
    getSessionById,
    addTag,
    deleteTag,
    exportSessionCsv,
    updateSessionEntry,
    allFencerNames,
  } = useSessions(initialSessions);

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
    async (selectedVideo: VideoLibraryItem) => {
      if (!session) {
        return;
      }

      await updateSessionEntry(session.id, {}, {
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

  const handleRemoveAttachedVideo = useCallback(async () => {
    if (!session) {
      return;
    }

    await updateSessionEntry(session.id, {}, { kind: "none" });
    handlePersistedVideoSelection({ kind: "none" });
  }, [handlePersistedVideoSelection, session, updateSessionEntry]);

  const handleAddTag = useCallback(
    async (params: AddTagParams) => {
      if (!session) {
        return;
      }

      await addTag(session.id, params);
    },
    [addTag, session],
  );

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      if (!session) {
        return;
      }

      await deleteTag(session.id, tagId);
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

  useEffect(() => {
    if (!initialTagId || hasAppliedInitialTagRef.current) {
      return;
    }

    const initialTag = findTagById(session, initialTagId);

    if (!initialTag) {
      hasAppliedInitialTagRef.current = true;
      return;
    }

    if (initialTag.timestamp == null || !activeVideoUrl || video.isSeeking) {
      return;
    }

    video.seek(initialTag.timestamp);
    hasAppliedInitialTagRef.current = true;
  }, [activeVideoUrl, initialTagId, session, video, video.isSeeking]);

  const handleCopyTagLink = useCallback(
    async (tagId: string) => {
      if (!session) {
        return;
      }

      const href = getSharedTagHref(session.id, tagId);

      try {
        const url = new URL(href, window.location.origin);
        await navigator.clipboard.writeText(url.toString());
        setCopyFeedback("copied");
      } catch {
        setCopyFeedback("error");
      }
    },
    [session],
  );

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
        <header className="flex h-11 shrink-0 items-center justify-between border-b px-2.5">
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
              className="max-w-[180px] truncate text-xs text-foreground hover:underline"
            >
              {getBoutDisplayLabel(session)}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <TabsList className="h-7">
              <TabsTrigger value="tagging" className="h-5 px-2 text-[11px]">
                Tagging
              </TabsTrigger>
              <TabsTrigger value="analysis" className="h-5 px-2 text-[11px]">
                Analysis
              </TabsTrigger>
            </TabsList>
            <BoutExportButton
              exportBoutToCsv={() => exportSessionCsv(session.id)}
              fileName={`fencing-bout-${session.id}-${getTodayIsoDate()}.csv`}
              disabled={!session}
              size="sm"
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
              className="text-[11px]"
            >
              <Video className="mr-1.5 h-4 w-4" />
              {hasAttachedLibraryVideo ? "Replace From Library" : "Attach From Library"}
            </Button>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px]"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Load Temporary File
            </Button>
            {hasAttachedLibraryVideo ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemoveAttachedVideo}
                className="text-[11px]"
              >
                Remove Attached Video
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditDialogOpen(true)}
              className="text-[11px]"
            >
              <Edit2 className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </div>

          <NewBoutDialog
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            editSession={session}
            onUpdateSession={async (
              params: SessionDraftParams,
              videoSelection: PersistedSessionVideoSelection,
            ) => {
              await updateSessionEntry(session.id, params, videoSelection);
              handlePersistedVideoSelection(videoSelection);
            }}
            fencerNames={allFencerNames}
          />
        </header>

        <TabsContent value="tagging" className="mt-0 flex-1 overflow-hidden p-1.5">
          <div className="grid h-full grid-cols-1 gap-1.5 lg:grid-cols-[1fr_252px]">
            <div className="flex min-h-0 flex-col gap-1.5">
              {activeVideoUrl ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card p-1.5">
                  <div className="mb-1 flex shrink-0 flex-wrap items-center gap-1.5 px-0.5">
                    <Badge variant={hasTemporaryOverride ? "secondary" : "outline"}>
                      {activeVideoBadge}
                    </Badge>
                    {activeVideoFileName ? (
                      <span className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {activeVideoFileName}
                      </span>
                    ) : null}
                    {hasTemporaryOverride ? (
                      <span className="text-xs text-muted-foreground">
                        Temporary file will be lost on refresh.
                      </span>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1">
                    <VideoPlayer videoUrl={activeVideoUrl} video={video} maximized />
                  </div>
                </div>
              ) : showLibraryLoadingState ? (
                <div className="flex h-[124px] flex-none flex-col items-center justify-center gap-2 rounded-lg border bg-card p-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-xs">Checking attached video...</p>
                </div>
              ) : showUnavailableState ? (
                <div className="flex h-[144px] flex-none flex-col items-center justify-center gap-2.5 rounded-lg border bg-card p-2.5 text-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
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
                <div className="flex h-[144px] flex-none flex-col items-center justify-center gap-2.5 rounded-lg border bg-card p-2.5 text-center">
                  <p className="text-xs">
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

              <div className="shrink-0 rounded-lg border bg-card p-2">
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
                onShareTag={handleCopyTagLink}
                fillHeight
              />
              {copyFeedback !== "idle" ? (
                <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                  {copyFeedback === "copied"
                    ? "Link copied to clipboard."
                    : "Could not copy the link."}
                </p>
              ) : null}
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
