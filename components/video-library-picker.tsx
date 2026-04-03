"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VideoLibraryItem } from "@/lib/video-library";

interface VideoLibraryPickerProps {
  open: boolean;
  confirmLabel?: string;
  selectedRelativePath?: string;
  onCancel?: () => void;
  onConfirm: (item: VideoLibraryItem) => void;
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(size / 1024, 1).toFixed(0)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedAt(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function VideoLibraryPicker({
  open,
  confirmLabel = "Attach Video",
  selectedRelativePath,
  onCancel,
  onConfirm,
}: VideoLibraryPickerProps) {
  const [items, setItems] = useState<VideoLibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(
    selectedRelativePath ?? null,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;

    fetch("/api/video-library", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Failed to load video library");
        }

        return (await response.json()) as VideoLibraryItem[];
      })
      .then((payload) => {
        if (!isCancelled) {
          setItems(payload);
        }
      })
      .catch((fetchError) => {
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load video library";
        if (!isCancelled) {
          setError(message);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [open]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return items ?? [];
    }

    return (items ?? []).filter((item) => {
      const haystacks = [item.fileName, item.relativePath].map((value) =>
        value.toLowerCase(),
      );

      return haystacks.some((value) => value.includes(normalizedSearch));
    });
  }, [items, search]);

  const selectedItem =
    filteredItems.find((item) => item.relativePath === selectedPath) ??
    items?.find((item) => item.relativePath === selectedPath) ??
    null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search filename or folder..."
          className="pl-9"
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border bg-background">
        {items == null && !error ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading videos...
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-sm text-destructive">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            {items?.length === 0
              ? "No videos found in VIDEO_LIBRARY_ROOT."
              : "No videos match your search."}
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map((item) => {
              const isSelected = item.relativePath === selectedPath;

              return (
                <button
                  key={item.relativePath}
                  type="button"
                  onClick={() => setSelectedPath(item.relativePath)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-muted/60",
                    isSelected && "bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{item.fileName}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatFileSize(item.size)}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {item.relativePath}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {item.mimeType} · {formatModifiedAt(item.modifiedAt)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedItem ? (
        <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selectedItem.fileName}</span>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={!selectedItem || items == null || Boolean(error)}
          onClick={() => {
            if (selectedItem) {
              onConfirm(selectedItem);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
