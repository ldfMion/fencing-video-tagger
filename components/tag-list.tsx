"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  fillHeight?: boolean;
}

export function TagList({
  tags,
  onSeek,
  onDelete,
  fillHeight = false,
}: TagListProps) {
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.timestamp - b.timestamp),
    [tags],
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const prevTagCountRef = useRef(tags.length);

  useEffect(() => {
    if (tags.length > prevTagCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevTagCountRef.current = tags.length;
  }, [tags.length]);

  if (tags.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tags yet. Add your first tag while watching the video.
      </div>
    );
  }

  return (
    <ScrollArea className={fillHeight ? "h-full" : "h-[300px]"}>
      <div className="space-y-2 pr-4">
        {sortedTags.map((tag) => (
          <div key={tag.id} className="group p-2 rounded-lg hover:bg-muted">
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onSeek(tag.timestamp)}
                className="text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-primary">
                    {formatTime(tag.timestamp)}
                  </span>
                  {tag.side && (
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 ${
                        tag.side === "L"
                          ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                          : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                      }`}
                    >
                      {tag.side}
                    </Badge>
                  )}
                  {tag.action && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {tag.action}
                    </Badge>
                  )}
                  {tag.mistake && (
                    <Badge
                      variant="destructive"
                      className="text-xs px-1.5 py-0"
                    >
                      {tag.mistake}
                    </Badge>
                  )}
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                title="Delete tag"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(tag.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {tag.comment && (
              <p
                className="text-sm text-muted-foreground mt-1 cursor-pointer"
                onClick={() => onSeek(tag.timestamp)}
              >
                {tag.comment}
              </p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
