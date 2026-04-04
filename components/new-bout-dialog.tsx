"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Video } from "lucide-react";
import { FencerCombobox } from "@/components/fencer-combobox";
import { VideoLibraryPicker } from "@/components/video-library-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  PersistedSessionVideoSelection,
  SessionDraftParams,
  SessionVideoSelection,
} from "@/hooks/use-sessions";
import type { VideoSession } from "@/lib/types";
import type { VideoLibraryItem } from "@/lib/video-library";

type VideoSelectionMode = "none" | "library" | "temporary";

interface NewBoutDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSession?: (
    params: SessionDraftParams,
    videoSelection: SessionVideoSelection,
  ) => Promise<VideoSession>;
  onUpdateSession?: (
    params: SessionDraftParams,
    videoSelection: PersistedSessionVideoSelection,
  ) => Promise<void | VideoSession>;
  editSession?: VideoSession;
  fencerNames?: string[];
}

interface DialogFormContentsProps {
  editSession?: VideoSession;
  fencerNames: string[];
  onCreateSession?: (
    params: SessionDraftParams,
    videoSelection: SessionVideoSelection,
  ) => Promise<VideoSession>;
  onUpdateSession?: (
    params: SessionDraftParams,
    videoSelection: PersistedSessionVideoSelection,
  ) => Promise<void | VideoSession>;
  onLibraryPanelChange?: (open: boolean) => void;
  onOpenChange: (open: boolean) => void;
}

function SourceModeButton({
  active,
  description,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
        active
          ? "border-foreground bg-muted"
          : "border-border hover:bg-muted/50"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function DialogFormContents({
  editSession,
  fencerNames,
  onCreateSession,
  onUpdateSession,
  onLibraryPanelChange,
  onOpenChange,
}: DialogFormContentsProps) {
  const isEditMode = Boolean(editSession && onUpdateSession);
  const [leftFencer, setLeftFencer] = useState(editSession?.leftFencer ?? "");
  const [rightFencer, setRightFencer] = useState(
    editSession?.rightFencer ?? "",
  );
  const [boutDate, setBoutDate] = useState(editSession?.boutDate ?? "");
  const [externalSource, setExternalSource] = useState(
    editSession?.externalSource ?? "",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLibraryVideo, setSelectedLibraryVideo] =
    useState<VideoLibraryItem | null>(
      editSession?.videoRelativePath
        ? {
            relativePath: editSession.videoRelativePath,
            fileName: editSession.fileName ?? editSession.videoRelativePath,
            size: 0,
            modifiedAt: 0,
            mimeType: editSession.videoMimeType ?? "application/octet-stream",
          }
        : null,
    );
  const [videoMode, setVideoMode] = useState<VideoSelectionMode>(() => {
    if (editSession?.videoRelativePath) {
      return "library";
    }

    return "none";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLibraryPanelVisible = videoMode === "library" && isLibraryPickerOpen;

  useEffect(() => {
    onLibraryPanelChange?.(isLibraryPanelVisible);
  }, [isLibraryPanelVisible, onLibraryPanelChange]);

  const selectedVideoSummary = useMemo(() => {
    if (videoMode === "library" && selectedLibraryVideo) {
      return selectedLibraryVideo.fileName;
    }

    if (videoMode === "temporary" && selectedFile) {
      return `${selectedFile.name} (temporary)`;
    }

    return null;
  }, [selectedFile, selectedLibraryVideo, videoMode]);

  const isSubmitDisabled =
    (videoMode === "library" && !selectedLibraryVideo) ||
    (videoMode === "temporary" && !selectedFile);

  async function handleSubmit() {
    const params: SessionDraftParams = {
      leftFencer: leftFencer.trim() || undefined,
      rightFencer: rightFencer.trim() || undefined,
      boutDate: boutDate || undefined,
      externalSource: externalSource.trim() || undefined,
    };

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        const videoSelection: PersistedSessionVideoSelection =
          videoMode === "library" && selectedLibraryVideo
            ? {
                kind: "library",
                video: selectedLibraryVideo,
              }
            : { kind: "none" };

        await onUpdateSession?.(params, videoSelection);
      } else {
        const videoSelection: SessionVideoSelection =
          videoMode === "library" && selectedLibraryVideo
            ? {
                kind: "library",
                video: selectedLibraryVideo,
              }
            : videoMode === "temporary" && selectedFile
              ? {
                  kind: "temporary",
                  file: selectedFile,
                }
              : { kind: "none" };

        await onCreateSession?.(params, videoSelection);
      }

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditMode ? "Edit Bout" : "New Bout"}</DialogTitle>
        <DialogDescription>
          Choose bout details, then decide whether this video should be attached
          from the local library or loaded only for the current browser session.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div
          className={cn(
            "grid gap-4 py-2",
            isLibraryPanelVisible && "md:grid-cols-[minmax(0,1fr)_380px] md:items-start",
          )}
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FencerCombobox
                id="left-fencer"
                label="Left fencer"
                placeholder="Name..."
                value={leftFencer}
                onChange={setLeftFencer}
                names={fencerNames}
                inline={false}
              />
              <FencerCombobox
                id="right-fencer"
                label="Right fencer"
                placeholder="Name..."
                value={rightFencer}
                onChange={setRightFencer}
                names={fencerNames}
                inline={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bout-date" className="text-sm">
                Date
              </Label>
              <Input
                id="bout-date"
                type="date"
                value={boutDate}
                onChange={(event) => setBoutDate(event.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source" className="text-sm">
                Source (URL or note)
              </Label>
              <Input
                id="source"
                placeholder="Video URL, link, or reference..."
                value={externalSource}
                onChange={(event) => setExternalSource(event.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Video source</Label>
              <div className="grid gap-2">
                <SourceModeButton
                  active={videoMode === "none"}
                  label="No video"
                  description="Create or update the bout without a persisted video attachment."
                  onClick={() => {
                    setVideoMode("none");
                    setIsLibraryPickerOpen(false);
                  }}
                />
                <SourceModeButton
                  active={videoMode === "library"}
                  label="Attach from library"
                  description="Persist a server-backed video from your local video library."
                  onClick={() => {
                    setVideoMode("library");
                    setIsLibraryPickerOpen(true);
                  }}
                />
                <SourceModeButton
                  active={videoMode === "temporary"}
                  disabled={isEditMode}
                  label="Temporary local file"
                  description={
                    isEditMode
                      ? "Temporary files can be loaded from the bout workspace."
                      : "Use a local file only for this browser session."
                  }
                  onClick={() => {
                    setVideoMode("temporary");
                    setIsLibraryPickerOpen(false);
                  }}
                />
              </div>
            </div>

            {selectedVideoSummary ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Selected video:{" "}
                <span className="font-medium text-foreground">
                  {selectedVideoSummary}
                </span>
              </div>
            ) : null}

            {!isEditMode && videoMode === "temporary" ? (
              <div className="space-y-2">
                <Label className="text-sm">Temporary local file</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file?.type.startsWith("video/")) {
                        setSelectedFile(file);
                      }
                    }}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-sm"
                  >
                    <Upload className="mr-2 h-3 w-3" />
                    Select Temporary Video
                  </Button>
                  {selectedFile ? (
                    <span className="flex-1 truncate text-xs text-muted-foreground">
                      {selectedFile.name}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Video className="h-3.5 w-3.5" />
                  Temporary files are not available after refresh.
                </div>
              </div>
            ) : null}
          </div>

          {videoMode === "library" ? (
            <div className="min-h-0 space-y-2 md:sticky md:top-0">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Library picker</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setIsLibraryPickerOpen((open) => !open)}
              >
                {isLibraryPickerOpen ? "Hide picker" : "Browse library"}
              </Button>
            </div>

            {isLibraryPickerOpen ? (
              <VideoLibraryPicker
                key={selectedLibraryVideo?.relativePath ?? "library-picker"}
                open={isLibraryPickerOpen}
                confirmLabel={
                  selectedLibraryVideo ? "Replace Selection" : "Select Video"
                }
                selectedRelativePath={selectedLibraryVideo?.relativePath}
                onCancel={() => setIsLibraryPickerOpen(false)}
                onConfirm={(item) => {
                  setSelectedLibraryVideo(item);
                  setIsLibraryPickerOpen(false);
                }}
              />
            ) : null}

            {isEditMode && editSession?.videoRelativePath ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  setSelectedLibraryVideo(null);
                  setVideoMode("none");
                  setIsLibraryPickerOpen(false);
                }}
              >
                Remove Attached Video
              </Button>
            ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
          className="h-8 text-sm"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          className="h-8 text-sm"
          disabled={isSubmitDisabled || isSubmitting}
        >
          {isEditMode ? "Save Changes" : "Create Bout"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function NewBoutDialog({
  isOpen,
  onOpenChange,
  onCreateSession,
  onUpdateSession,
  editSession,
  fencerNames = [],
}: NewBoutDialogProps) {
  const dialogKey = `${isOpen ? "open" : "closed"}:${editSession?.id ?? "create"}`;
  const [isLibraryPanelVisible, setIsLibraryPanelVisible] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100vh-2rem)] flex-col sm:max-w-[560px]",
          isLibraryPanelVisible && "md:max-w-[920px]",
        )}
      >
        <DialogFormContents
          key={dialogKey}
          editSession={editSession}
          fencerNames={fencerNames}
          onCreateSession={onCreateSession}
          onUpdateSession={onUpdateSession}
          onLibraryPanelChange={setIsLibraryPanelVisible}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
