"use client";

import { Button } from "@/components/ui/button";
import { Trash2, Swords, FileVideo } from "lucide-react";
import { SIDE_COLORS } from "@/lib/constants";
import { computeScore } from "@/lib/score";
import type { VideoSession } from "@/lib/types";

function formatBoutDate(session: VideoSession): string {
  if (session.boutDate) {
    return new Date(session.boutDate).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return new Date(session.lastModified).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  return session.fileName ?? "Untitled Bout";
}

function hasFencerNames(session: VideoSession): boolean {
  return Boolean(session.leftFencer || session.rightFencer);
}

interface VideoLibraryProps {
  sessions: VideoSession[];
  currentFileName?: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export function VideoLibrary({
  sessions,
  currentFileName,
  onSelect,
  onDelete,
}: VideoLibraryProps) {
  const sortedSessions = [...sessions].sort(
    (a, b) => b.lastModified - a.lastModified,
  );

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No bouts found.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-muted-foreground text-xs">
            <th className="text-left font-medium py-2 px-3">Bout</th>
            <th className="text-center font-medium py-2 px-3 w-[100px]">Score</th>
            <th className="text-center font-medium py-2 px-3 w-[60px]">Tags</th>
            <th className="text-right font-medium py-2 px-3 w-[120px]">Date</th>
            <th className="w-[40px]" />
          </tr>
        </thead>
        <tbody>
          {sortedSessions.map((session) => {
            const score = computeScore(session.tags);
            const hasScore = session.tags.some((t) => t.side && t.action);
            const leftWins = score.left > score.right;
            const rightWins = score.right > score.left;
            const isActive = session.fileName === currentFileName;

            return (
              <tr
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={`border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted ${isActive ? "bg-muted" : ""}`}
              >
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {hasFencerNames(session) ? (
                      <Swords className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {getBoutTitle(session)}
                      </p>
                      {session.fileName ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {session.fileName}
                        </p>
                      ) : session.externalSource ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {session.externalSource}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="py-2 px-3 text-center tabular-nums">
                  {hasScore ? (
                    <>
                      <span className={`${leftWins ? "font-bold" : ""} ${SIDE_COLORS.left.text}`}>
                        {score.left}
                      </span>
                      <span className="text-muted-foreground mx-1">-</span>
                      <span className={`${rightWins ? "font-bold" : ""} ${SIDE_COLORS.right.text}`}>
                        {score.right}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center text-muted-foreground">
                  {session.tags.length}
                </td>
                <td className="py-2 px-3 text-right text-muted-foreground text-xs">
                  {formatBoutDate(session)}
                </td>
                <td className="py-2 px-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
