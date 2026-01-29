"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";
import type { Tag } from "@/lib/types";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface TagListProps {
  tags: Tag[];
  onSeek: (time: number) => void;
  onDelete: (tagId: string) => void;
}

export function TagList({ tags, onSeek, onDelete }: TagListProps) {
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.timestamp - b.timestamp),
    [tags]
  );

  if (tags.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tags yet. Add your first tag while watching the video.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 pr-4">
        {sortedTags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted group"
          >
            <button
              onClick={() => onSeek(tag.timestamp)}
              className="flex-1 text-left"
            >
              <span className="font-mono text-sm text-primary">
                {formatTime(tag.timestamp)}
              </span>
              <span className="mx-2 text-muted-foreground">-</span>
              <span>{tag.text}</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onDelete(tag.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
