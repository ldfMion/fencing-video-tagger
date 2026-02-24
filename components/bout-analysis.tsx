"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tag } from "@/lib/types";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface BoutAnalysisProps {
  tags: Tag[];
  leftFencer?: string;
  rightFencer?: string;
}

interface ScoringEvent {
  tag: Tag;
  leftScore: number;
  rightScore: number;
}

export function BoutAnalysis({
  tags,
  leftFencer = "Left",
  rightFencer = "Right",
}: BoutAnalysisProps) {
  const scoringEvents = useMemo(() => {
    const withAction = tags
      .filter((t) => t.side && t.action)
      .sort((a, b) => a.timestamp - b.timestamp);

    let left = 0;
    let right = 0;
    return withAction.map<ScoringEvent>((tag) => {
      if (tag.side === "L") left++;
      else right++;
      return { tag, leftScore: left, rightScore: right };
    });
  }, [tags]);

  const finalLeft = scoringEvents.length > 0
    ? scoringEvents[scoringEvents.length - 1].leftScore
    : 0;
  const finalRight = scoringEvents.length > 0
    ? scoringEvents[scoringEvents.length - 1].rightScore
    : 0;

  const leftWins = finalLeft > finalRight;
  const rightWins = finalRight > finalLeft;

  const leftColor = "text-red-700 dark:text-red-400";
  const rightColor = "text-green-700 dark:text-green-400";
  const leftBadge = "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
  const rightBadge = "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      {/* Score Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-center gap-6">
          <div className="text-right flex-1">
            <p className={`text-sm mb-1 ${leftWins ? `font-semibold ${leftColor}` : "text-muted-foreground"}`}>
              {leftFencer}
            </p>
            <p className={`text-4xl font-bold tabular-nums ${leftColor}`}>{finalLeft}</p>
          </div>
          <span className="text-2xl text-muted-foreground">–</span>
          <div className="text-left flex-1">
            <p className={`text-sm mb-1 ${rightWins ? `font-semibold ${rightColor}` : "text-muted-foreground"}`}>
              {rightFencer}
            </p>
            <p className={`text-4xl font-bold tabular-nums ${rightColor}`}>{finalRight}</p>
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div>
        <h3 className="text-sm font-medium mb-3">Events</h3>
        {scoringEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scoring events yet.
          </p>
        ) : (
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="space-y-1">
              {scoringEvents.map((event) => (
                <div
                  key={event.tag.id}
                  className="grid grid-cols-[1fr_auto_1fr] items-center py-1.5 px-2 rounded hover:bg-muted"
                >
                  {/* Left fencer column */}
                  <div className="flex justify-end">
                    {event.tag.side === "L" && (
                      <Badge
                        variant="outline"
                        className={`text-xs px-1.5 py-0 ${leftBadge}`}
                      >
                        {event.tag.action}
                      </Badge>
                    )}
                  </div>

                  {/* Center: score */}
                  <span className="text-sm tabular-nums text-center mx-4">
                    <span className={event.tag.side === "L" ? `font-bold ${leftColor}` : ""}>
                      {event.leftScore}
                    </span>
                    <span className="text-muted-foreground"> - </span>
                    <span className={event.tag.side === "R" ? `font-bold ${rightColor}` : ""}>
                      {event.rightScore}
                    </span>
                  </span>

                  {/* Right fencer column */}
                  <div className="flex justify-start">
                    {event.tag.side === "R" && (
                      <Badge
                        variant="outline"
                        className={`text-xs px-1.5 py-0 ${rightBadge}`}
                      >
                        {event.tag.action}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
