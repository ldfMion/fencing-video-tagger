"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { FencerCombobox } from "@/components/fencer-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VideoSession } from "@/lib/types";

interface SessionFormParams {
  leftFencer?: string;
  rightFencer?: string;
  boutDate?: string;
  externalSource?: string;
}

interface NewBoutDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSession?: (params: SessionFormParams) => VideoSession;
  onCreateWithVideo?: (file: File, params: SessionFormParams) => VideoSession;
  onUpdateSession?: (params: SessionFormParams) => void;
  editSession?: VideoSession;
  fencerNames?: string[];
}

interface DialogFormContentsProps {
  editSession?: VideoSession;
  fencerNames: string[];
  onCreateSession?: (params: SessionFormParams) => VideoSession;
  onCreateWithVideo?: (file: File, params: SessionFormParams) => VideoSession;
  onUpdateSession?: (params: SessionFormParams) => void;
  onOpenChange: (open: boolean) => void;
}

function DialogFormContents({
  editSession,
  fencerNames,
  onCreateSession,
  onCreateWithVideo,
  onUpdateSession,
  onOpenChange,
}: DialogFormContentsProps) {
  const isEditMode = Boolean(editSession && onUpdateSession);
  const [leftFencer, setLeftFencer] = useState(editSession?.leftFencer ?? "");
  const [rightFencer, setRightFencer] = useState(editSession?.rightFencer ?? "");
  const [boutDate, setBoutDate] = useState(editSession?.boutDate ?? "");
  const [externalSource, setExternalSource] = useState(
    editSession?.externalSource ?? "",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const params = {
      leftFencer: leftFencer.trim() || undefined,
      rightFencer: rightFencer.trim() || undefined,
      boutDate: boutDate || undefined,
      externalSource: externalSource.trim() || undefined,
    };

    if (isEditMode) {
      onUpdateSession?.(params);
    } else if (selectedFile && onCreateWithVideo) {
      onCreateWithVideo(selectedFile, params);
    } else {
      onCreateSession?.(params);
    }

    onOpenChange(false);
  }, [
    boutDate,
    externalSource,
    isEditMode,
    leftFencer,
    onCreateSession,
    onCreateWithVideo,
    onOpenChange,
    onUpdateSession,
    rightFencer,
    selectedFile,
  ]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditMode ? "Edit Bout" : "New Bout"}</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
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

        {!isEditMode ? (
          <div className="space-y-2">
            <Label className="text-sm">Video file (optional)</Label>
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
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-sm"
              >
                <Upload className="mr-2 h-3 w-3" />
                Select Video
              </Button>
              {selectedFile ? (
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {selectedFile.name}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="h-8 text-sm"
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} className="h-8 text-sm">
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
  onCreateWithVideo,
  onUpdateSession,
  editSession,
  fencerNames = [],
}: NewBoutDialogProps) {
  const dialogKey = `${isOpen ? "open" : "closed"}:${editSession?.id ?? "create"}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogFormContents
          key={dialogKey}
          editSession={editSession}
          fencerNames={fencerNames}
          onCreateSession={onCreateSession}
          onCreateWithVideo={onCreateWithVideo}
          onUpdateSession={onUpdateSession}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
