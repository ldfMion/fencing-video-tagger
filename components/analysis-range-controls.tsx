"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { AnalysisRange } from "@/lib/analysis-range";
import type { ScoringEvent } from "@/lib/score";
import { formatMatchPeriodLabel } from "@/lib/tagging";
import { formatTime } from "@/lib/utils";

interface AnalysisRangeControlsProps {
  events: ScoringEvent[];
  range: AnalysisRange | null;
  onRangeChange: (range: AnalysisRange | null) => void;
}

export function AnalysisRangeControls({ events, range, onRangeChange }: AnalysisRangeControlsProps) {
  if (events.length === 0) return null;
  const start = range ? events.findIndex((event) => event.tag.id === range.startId) : 0;
  const end = range ? events.findIndex((event) => event.tag.id === range.endId) : events.length - 1;

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="status">
          <Badge variant={range ? "secondary" : "outline"}>
            {range ? `Events ${start + 1}–${end + 1}` : "Full bout"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {end - start + 1} of {events.length} scoring events (including cards)
          </span>
        </div>
        <Button variant="ghost" size="sm" disabled={!range} onClick={() => onRangeChange(null)}>
          Clear selection
        </Button>
      </div>
      {events.length > 1 ? (
        <Slider
          min={1}
          max={events.length}
          step={1}
          minStepsBetweenThumbs={0}
          value={[start + 1, end + 1]}
          thumbLabels={["Selection start event", "Selection end event"]}
          onValueChange={([first, last]) => onRangeChange({
            startId: events[first - 1].tag.id,
            endId: events[last - 1].tag.id,
          })}
        />
      ) : null}
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>From {formatBoundary(events[start], start)}</span>
        <span>Through {formatBoundary(events[end], end)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag across the chart to select events. Adjust the handles here, or focus a handle and use arrow keys.
        Both boundary events and all tags between them are included. The chart keeps the full bout score.
      </p>
    </div>
  );
}

function formatBoundary(event: ScoringEvent, index: number): string {
  const { tag } = event;
  const eventLabel = `event ${index + 1}`;
  if (tag.matchPeriod && tag.matchClock) {
    return `${formatMatchPeriodLabel(tag.matchPeriod)} ${tag.matchClock} · ${eventLabel}`;
  }
  return tag.timestamp != null ? `video ${formatTime(tag.timestamp)} · ${eventLabel}` : eventLabel;
}
