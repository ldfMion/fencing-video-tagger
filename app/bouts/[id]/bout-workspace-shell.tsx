"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Library,
  Loader2,
  Upload,
  Video,
} from "lucide-react";
import { BoutAnalysis } from "@/components/bout-analysis";
import { BoutExportButton } from "@/components/export-button";
import { HeartRateCard } from "@/components/heart-rate-card";
import { NewBoutDialog } from "@/components/new-bout-dialog";
import { TagForm, type TagFormHandle } from "@/components/tag-form";
import { TagList } from "@/components/tag-list";
import { VideoLibraryPicker } from "@/components/video-library-picker";
import { VideoPlayer } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import { AppearanceMenu } from "@/components/appearance-menu";
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
import { getUniqueFencerNames } from "@/lib/fencer-name";
import { useVideo } from "@/hooks/use-video";
import {
  getAllFencerNames,
  getBoutDisplayLabel,
} from "@/lib/session-selectors";
import { listSearchFencers } from "@/lib/server/comment-search-service";
import { findTagById, getSharedTagHref } from "@/lib/tag-share";
import { matchBoutHeartRate } from "@/lib/server/heart-rate-service";
import type { HeartRateData } from "@/lib/heart-rate";
import type { VideoSession } from "@/lib/types";
import type { VideoLibraryItem } from "@/lib/video-library";

interface BoutWorkspaceShellProps {
  boutId: string;
  initialFencerNames: string[];
  initialHeartRateData: HeartRateData | null;
  initialSession: VideoSession | null;
  initialTagId: string | null;
}

type BoutWorkspaceTab = "tagging" | "analysis";

export function BoutWorkspaceShell({
  boutId,
  initialFencerNames,
  initialHeartRateData,
  initialSession,
  initialTagId,
}: BoutWorkspaceShellProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagFormRef = useRef<TagFormHandle>(null);
  const activeTabRef = useRef<BoutWorkspaceTab>("tagging");
  const hasAppliedInitialTagRef = useRef(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BoutWorkspaceTab>("tagging");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">("idle");
  const [fencerNames, setFencerNames] = useState(initialFencerNames);
  const [heartRateData, setHeartRateData] = useState(initialHeartRateData);
  const [heartRateError, setHeartRateError] = useState<string | null>(null);
  const [isMatchingHeartRate, setIsMatchingHeartRate] = useState(false);

  const video = useVideo();
  const {
    getSessionById,
    addTag,
    updateTag,
    deleteTag,
    exportSessionCsv,
    isSessionUpdatePending,
    setSessionVideoSelection,
    updateSessionEntry,
  } = useSessions(undefined, {
    sessionId: boutId,
    initialSession,
  });

  const session = getSessionById(boutId);
  const availableFencerNames = useMemo(
    () => getUniqueFencerNames([
      ...fencerNames,
      ...getAllFencerNames(session ? [session] : []),
    ]),
    [fencerNames, session],
  );
  const tags = session?.tags ?? [];
  const editingTag = findTagById(session, editingTagId);
  const activeEditingTagId = editingTag ? editingTagId : null;
  const {
    activeVideoBadge,
    activeVideoFileName,
    activeVideoKey,
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
    isSessionUpdatePending,
    session,
    setSessionVideoSelection,
    onSourceChange: () => {
      video.resetZoom();
      video.resetPlaybackState();
      setHeartRateData(null);
      setHeartRateError(null);
    },
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

  const handleMatchHeartRate = useCallback(async () => {
    if (!session) return;
    setHeartRateError(null);
    setIsMatchingHeartRate(true);
    try {
      const matched = await matchBoutHeartRate({ sessionId: session.id });
      setHeartRateData(matched);
    } catch (error) {
      setHeartRateError(
        error instanceof Error ? error.message : "Could not match heart-rate data.",
      );
    } finally {
      setIsMatchingHeartRate(false);
    }
  }, [session]);

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
      setEditingTagId((currentTagId) => (currentTagId === tagId ? null : currentTagId));
    },
    [deleteTag, session],
  );

  const handleEditTag = useCallback((tagId: string) => {
    setEditingTagId(tagId);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTagId(null);
  }, []);

  const handleUpdateTag = useCallback(
    async (
      tagId: string,
      updates: Parameters<typeof updateTag>[2],
    ) => {
      if (!session) {
        return;
      }

      await updateTag(session.id, tagId, updates);
      setEditingTagId((currentTagId) => (currentTagId === tagId ? null : currentTagId));
    },
    [session, updateTag],
  );

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeTabRef.current !== "tagging") {
        return;
      }

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
          if (event.metaKey || event.ctrlKey) {
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

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (nextTab !== "tagging" && nextTab !== "analysis") {
        return;
      }

      if (activeTab === "tagging" && nextTab !== "tagging") {
        video.pause();
      }

      setActiveTab(nextTab);
    },
    [activeTab, video],
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
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="app-canvas bout-workspace flex h-screen flex-col bg-background"
      >
        <header className="bout-toolbar grid min-h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild title="Back to bouts">
              <Link href="/"><Library className="h-4 w-4" /></Link>
            </Button>
            <span className="h-5 w-px bg-border" />
            <button
              onClick={() => setIsEditDialogOpen(true)}
              className="min-w-0 max-w-[260px] truncate text-left text-sm font-medium text-foreground hover:text-muted-foreground"
            >
              {getBoutDisplayLabel(session)}
            </button>
          </div>

          <TabsList className="h-8 bg-muted/60">
              <TabsTrigger value="tagging" className="h-6 px-3 text-[11px]">
                Tagging
              </TabsTrigger>
              <TabsTrigger value="analysis" className="h-6 px-3 text-[11px]">
                Analysis
              </TabsTrigger>
          </TabsList>

          <div className="flex items-center justify-end gap-1.5">
            <AppearanceMenu compact />
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
              {hasAttachedLibraryVideo ? "Change video" : "Attach video"}
            </Button>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px]"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Open file
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
              const participantsChanged =
                params.leftFencer !== session.leftFencer ||
                params.rightFencer !== session.rightFencer;
              await updateSessionEntry(session.id, params, videoSelection);
              handlePersistedVideoSelection(videoSelection);
              if (participantsChanged) {
                const refreshedFencerNames = await listSearchFencers().catch(
                  () => null,
                );
                if (refreshedFencerNames) {
                  setFencerNames(refreshedFencerNames);
                }
              }
            }}
            fencerNames={availableFencerNames}
          />
        </header>

        <TabsContent value="tagging" className="mt-0 flex-1 overflow-hidden px-3 pb-3 pt-1.5">
          <div className="mx-auto grid h-full max-w-[1680px] grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-h-0 flex-col gap-3">
              {activeVideoUrl ? (
                <div className="video-stage flex min-h-0 flex-1 flex-col overflow-hidden">
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
                    <VideoPlayer
                      key={activeVideoKey}
                      videoUrl={activeVideoUrl}
                      video={video}
                      maximized
                    />
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

              <HeartRateCard
                canMatch={hasAttachedLibraryVideo}
                currentTime={video.currentTime}
                data={heartRateData}
                error={heartRateError}
                isMatching={isMatchingHeartRate}
                onMatch={handleMatchHeartRate}
                onSeek={activeVideoUrl ? video.seek : undefined}
              />

              <div className="tagging-dock shrink-0 py-1">
                <TagForm
                  ref={tagFormRef}
                  onAddTag={handleAddTag}
                  onUpdateTag={handleUpdateTag}
                  onCancelEdit={handleCancelEdit}
                  editingTag={editingTag}
                  currentTime={activeVideoUrl ? video.currentTime : undefined}
                  taggingOptions={session.taggingOptions}
                />
              </div>
            </div>

            <aside className="tag-rail min-h-0 pl-1">
              <TagList
                tags={tags}
                onEdit={handleEditTag}
                onDelete={handleDeleteTag}
                onSeek={activeVideoUrl ? video.seek : undefined}
                onShareTag={handleCopyTagLink}
                editingTagId={activeEditingTagId}
                fillHeight
              />
              {copyFeedback !== "idle" ? (
                <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                  {copyFeedback === "copied"
                    ? "Link copied to clipboard."
                    : "Could not copy the link."}
                </p>
              ) : null}
            </aside>
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
