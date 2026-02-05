"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, FileVideo, Swords } from "lucide-react";
import type { VideoSession } from "@/lib/types";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getBoutTitle(session: VideoSession): string {
  if (session.leftFencer && session.rightFencer) {
    return `${session.leftFencer} vs ${session.rightFencer}`;
  }
  if (session.leftFencer) {
    return `${session.leftFencer} vs ?`;
  }
  if (session.rightFencer) {
    return `? vs ${session.rightFencer}`;
  }
  return session.fileName;
}

function hasFencerNames(session: VideoSession): boolean {
  return Boolean(session.leftFencer || session.rightFencer);
}

interface VideoLibraryProps {
  sessions: VideoSession[];
  currentFileName: string | null;
  onSelect: (fileName: string) => void;
  onDelete: (fileName: string) => void;
  expanded?: boolean;
}

export function VideoLibrary({
  sessions,
  currentFileName,
  onSelect,
  onDelete,
  expanded = false,
}: VideoLibraryProps) {
  const sortedSessions = [...sessions].sort(
    (a, b) => b.lastModified - a.lastModified,
  );

  if (sessions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No previous videos. Load a video to get started.
      </div>
    );
  }

  return (
    <ScrollArea className={expanded ? "h-[500px]" : "h-[200px]"}>
      <div className="space-y-2 pr-4">
        {sortedSessions.map((session) => (
          <Card
            key={session.id}
            className={`cursor-pointer transition-colors hover:bg-muted ${
              session.fileName === currentFileName ? "border-primary" : ""
            }`}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {hasFencerNames(session) ? (
                  <Swords className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                  <FileVideo className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <button
                  onClick={() => onSelect(session.fileName)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="font-medium truncate">
                    {getBoutTitle(session)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasFencerNames(session) && (
                      <span className="truncate">{session.fileName} · </span>
                    )}
                    {session.tags.length} tag{session.tags.length !== 1 && "s"}{" "}
                    · {formatDate(session.lastModified)}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(session.fileName);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
