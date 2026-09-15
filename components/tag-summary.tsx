import { Badge } from "@/components/ui/badge";
import { Hash, Timer, Video } from "lucide-react";
import { SIDE_COLORS } from "@/lib/constants";
import {
  formatFailureCause,
  formatFailureMode,
  LEGACY_MISTAKE_LABELS,
} from "@/lib/failure-classification";
import {
  formatMatchPeriodLabel,
  formatStripZoneLabel,
} from "@/lib/tagging";
import type { Tag } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

interface TagSummaryProps {
  tag: Tag;
  matchClockEnabled?: boolean;
  fallbackIndex?: number;
  className?: string;
}

export function TagSummary({
  tag,
  matchClockEnabled = false,
  fallbackIndex,
  className,
}: TagSummaryProps) {
  const matchPeriodLabel = formatMatchPeriodLabel(tag.matchPeriod);
  const stripZoneLabel = formatStripZoneLabel(tag.stripZone);
  const showsMatchClock = matchClockEnabled && tag.matchClock != null;
  const primaryTimeSource = showsMatchClock
    ? "match"
    : tag.timestamp != null
      ? "video"
      : "order";
  const primaryTime = showsMatchClock
    ? `${matchPeriodLabel ? `${matchPeriodLabel} ` : ""}${tag.matchClock}`
    : tag.timestamp != null
      ? formatTime(tag.timestamp)
      : fallbackIndex != null
        ? `#${fallbackIndex}`
        : "Untimed";

  return (
    <div
      data-slot="tag-summary"
      className={cn("grid min-w-0 gap-1", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5",
            primaryTimeSource === "match"
              ? "font-semibold text-foreground"
              : "font-normal text-muted-foreground",
          )}
        >
          {primaryTimeSource === "match" ? (
            <Timer className="size-3.5" role="img" aria-label="Match clock" />
          ) : primaryTimeSource === "video" ? (
            <Video className="size-3.5" role="img" aria-label="Video timestamp" />
          ) : (
            <Hash className="size-3.5" role="img" aria-label="Tag order" />
          )}
          <span className="font-mono text-sm">{primaryTime}</span>
        </span>
        {tag.side ? (
          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0 text-xs",
              tag.side === "L"
                ? cn(SIDE_COLORS.left.badge, "tag-side-badge-left")
                : cn(SIDE_COLORS.right.badge, "tag-side-badge-right"),
            )}
          >
            {tag.side}
          </Badge>
        ) : null}
        {tag.action ? (
          <Badge
            variant="outline"
            className="tag-action-badge px-1.5 py-0 text-xs"
          >
            {tag.action}
          </Badge>
        ) : null}
        {showsMatchClock && tag.timestamp != null ? (
          <Badge
            variant="outline"
            className="px-1.5 py-0 text-xs font-normal text-muted-foreground"
          >
            <Video role="img" aria-label="Video timestamp" />
            {formatTime(tag.timestamp)}
          </Badge>
        ) : null}
        {!showsMatchClock && matchPeriodLabel ? (
          <Badge variant="outline" className="px-1.5 py-0 text-xs">
            {matchPeriodLabel}
            {tag.matchClock ? ` ${tag.matchClock}` : ""}
          </Badge>
        ) : null}
        {stripZoneLabel ? (
          <Badge variant="outline" className="px-1.5 py-0 text-xs">
            {stripZoneLabel}
          </Badge>
        ) : null}
        {tag.mistake ? (
          <Badge
            variant="outline"
            className="tag-mistake-badge px-1.5 py-0 text-xs"
          >
            {LEGACY_MISTAKE_LABELS[tag.mistake]}
          </Badge>
        ) : null}
        {tag.failureMode ? (
          <Badge
            variant="outline"
            className="tag-mistake-badge tag-failure-mode-badge px-1.5 py-0 text-xs"
          >
            {formatFailureMode(tag.failureMode)}
          </Badge>
        ) : null}
        {tag.failureCause ? (
          <Badge
            variant="outline"
            className="tag-mistake-badge tag-failure-cause-badge px-1.5 py-0 text-xs"
          >
            {formatFailureCause(tag.failureCause)}
          </Badge>
        ) : null}
      </div>
      {tag.comment ? (
        <p className="text-sm text-muted-foreground">{tag.comment}</p>
      ) : null}
    </div>
  );
}
