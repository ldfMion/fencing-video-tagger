"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FencerCombobox } from "@/components/fencer-combobox";
import { Upload } from "lucide-react";
import type { VideoSession } from "@/lib/types";

interface NewBoutDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSession?: (params: {
    leftFencer?: string;
    rightFencer?: string;
    boutDate?: string;
    externalSource?: string;
  }) => VideoSession;
  onCreateWithVideo?: (
    file: File,
    params: {
      leftFencer?: string;
      rightFencer?: string;
      boutDate?: string;
      externalSource?: string;
    }
  ) => VideoSession;
  onUpdateSession?: (params: {
    leftFencer?: string;
    rightFencer?: string;
    boutDate?: string;
    externalSource?: string;
  }) => void;
  editSession?: VideoSession;
  fencerNames?: string[];
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
  const isEditMode = !!editSession && !!onUpdateSession;

  const [leftFencer, setLeftFencer] = useState(editSession?.leftFencer ?? "");
  const [rightFencer, setRightFencer] = useState(editSession?.rightFencer ?? "");
  const [boutDate, setBoutDate] = useState(editSession?.boutDate ?? "");
  const [externalSource, setExternalSource] = useState(editSession?.externalSource ?? "");
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
    } else {
      if (selectedFile && onCreateWithVideo) {
        onCreateWithVideo(selectedFile, params);
      } else if (onCreateSession) {
        onCreateSession(params);
      }
    }

    onOpenChange(false);
    // Reset form
    setLeftFencer(editSession?.leftFencer ?? "");
    setRightFencer(editSession?.rightFencer ?? "");
    setBoutDate(editSession?.boutDate ?? "");
    setExternalSource(editSession?.externalSource ?? "");
    setSelectedFile(null);
  }, [
    leftFencer,
    rightFencer,
    boutDate,
    externalSource,
    selectedFile,
    isEditMode,
    editSession,
    onCreateSession,
    onCreateWithVideo,
    onUpdateSession,
    onOpenChange,
  ]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file?.type.startsWith("video/")) {
        setSelectedFile(file);
      }
    },
    []
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Bout" : "New Bout"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Fencer fields */}
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

          {/* Date field */}
          <div className="space-y-2">
            <Label htmlFor="bout-date" className="text-sm">
              Date
            </Label>
            <Input
              id="bout-date"
              type="date"
              value={boutDate}
              onChange={(e) => setBoutDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* External source field */}
          <div className="space-y-2">
            <Label htmlFor="source" className="text-sm">
              Source (URL or note)
            </Label>
            <Input
              id="source"
              placeholder="Video URL, link, or reference..."
              value={externalSource}
              onChange={(e) => setExternalSource(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Video file selection (only in create mode) */}
          {!isEditMode && (
            <div className="space-y-2">
              <Label className="text-sm">Video file (optional)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-sm"
                >
                  <Upload className="h-3 w-3 mr-2" />
                  Select Video
                </Button>
                {selectedFile && (
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {selectedFile.name}
                  </span>
                )}
              </div>
            </div>
          )}
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
      </DialogContent>
    </Dialog>
  );
}
