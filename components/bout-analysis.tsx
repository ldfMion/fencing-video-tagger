"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SIDE_COLORS } from "@/lib/constants";
import { computeScore, computeRunningScore } from "@/lib/score";
import type { Tag } from "@/lib/types";

interface BoutAnalysisProps {
  tags: Tag[];
  leftFencer?: string;
  rightFencer?: string;
}

export function BoutAnalysis({
  tags,
  leftFencer = "Left",
  rightFencer = "Right",
}: BoutAnalysisProps) {
  const scoringEvents = useMemo(() => computeRunningScore(tags), [tags]);

  const { left: finalLeft, right: finalRight } = computeScore(tags);

  const leftWins = finalLeft > finalRight;
  const rightWins = finalRight > finalLeft;

  const leftColor = SIDE_COLORS.left.text;
  const rightColor = SIDE_COLORS.right.text;
  const leftBadge = SIDE_COLORS.left.badge;
  const rightBadge = SIDE_COLORS.right.badge;

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
              {scoringEvents.map((event) => {
                const isCard = event.tag.action === "yc" || event.tag.action === "rc";
                const isRedCard = event.tag.action === "rc";
                const isYellowCard = event.tag.action === "yc";

                // Determine which score to highlight:
                // - Normal: highlight the scoring fencer's side
                // - Red card: highlight the opponent's side (they get the point)
                // - Yellow card: highlight neither
                const highlightLeft = isYellowCard ? false : isRedCard ? event.tag.side === "R" : event.tag.side === "L";
                const highlightRight = isYellowCard ? false : isRedCard ? event.tag.side === "L" : event.tag.side === "R";

                const badgeClass = isCard
                  ? "text-xs px-1.5 py-0"
                  : `text-xs px-1.5 py-0 ${event.tag.side === "L" ? leftBadge : rightBadge}`;

                return (
                  <div
                    key={event.tag.id}
                    className="grid grid-cols-[1fr_auto_1fr] items-center py-1.5 px-2 rounded hover:bg-muted"
                  >
                    {/* Left fencer column */}
                    <div className="flex justify-end">
                      {event.tag.side === "L" && (
                        <Badge variant="outline" className={badgeClass}>
                          {event.tag.action}
                        </Badge>
                      )}
                    </div>

                    {/* Center: score */}
                    <span className="text-sm tabular-nums text-center mx-4">
                      <span className={highlightLeft ? `font-bold ${leftColor}` : ""}>
                        {event.leftScore}
                      </span>
                      <span className="text-muted-foreground"> - </span>
                      <span className={highlightRight ? `font-bold ${rightColor}` : ""}>
                        {event.rightScore}
                      </span>
                    </span>

                    {/* Right fencer column */}
                    <div className="flex justify-start">
                      {event.tag.side === "R" && (
                        <Badge variant="outline" className={badgeClass}>
                          {event.tag.action}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
