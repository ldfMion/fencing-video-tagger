"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, Copy, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { SIDE_COLORS } from "@/lib/constants";
import {
  formatMatchPeriodLabel,
  formatStripZoneLabel,
} from "@/lib/tagging";
import type { ActionCode, Side, Tag } from "@/lib/types";
import { cn, formatTime, sortTags } from "@/lib/utils";

const SEEK_BUFFER = 3;

interface TagListProps {
  tags: Tag[];
  onSeek?: (time: number) => void;
  onEdit: (tagId: string) => void;
  onDelete: (tagId: string) => void;
  onShareTag?: (tagId: string) => void;
  editingTagId?: string | null;
  fillHeight?: boolean;
}

export function TagList({
  tags,
  onSeek,
  onEdit,
  onDelete,
  onShareTag,
  editingTagId,
  fillHeight = false,
}: TagListProps) {
  const sortedTags = useMemo(() => sortTags(tags), [tags]);

  const [selectedSides, setSelectedSides] = useState<Set<Side>>(new Set());
  const [selectedActions, setSelectedActions] = useState<Set<ActionCode>>(
    new Set()
  );

  const availableActions = useMemo(() => {
    const codes = new Set<ActionCode>();
    for (const tag of tags) {
      if (tag.action) codes.add(tag.action);
    }
    return Array.from(codes).sort();
  }, [tags]);

  const filteredTags = useMemo(() => {
    return sortedTags.filter((tag) => {
      if (
        selectedSides.size > 0 &&
        (!tag.side || !selectedSides.has(tag.side))
      ) {
        return false;
      }
      if (
        selectedActions.size > 0 &&
        (!tag.action || !selectedActions.has(tag.action))
      ) {
        return false;
      }
      return true;
    });
  }, [sortedTags, selectedSides, selectedActions]);

  const hasActiveFilters = selectedSides.size > 0 || selectedActions.size > 0;

  const bottomRef = useRef<HTMLDivElement>(null);
  const prevTagCountRef = useRef(tags.length);

  useEffect(() => {
    if (tags.length > prevTagCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevTagCountRef.current = tags.length;
  }, [tags.length]);

  function toggleSide(side: Side) {
    setSelectedSides((prev) => {
      const next = new Set(prev);
      if (next.has(side)) next.delete(side);
      else next.add(side);
      return next;
    });
  }

  function toggleAction(action: ActionCode) {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }

  if (tags.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tags yet.
      </div>
    );
  }

  return (
    <div className={fillHeight ? "flex flex-col h-full" : "flex flex-col"}>
      {/* Filter bar */}
      <div className="tag-filters mb-3 flex flex-wrap items-center gap-1.5">
        <Toggle
          variant="outline"
          size="sm"
          pressed={selectedSides.has("L")}
          onPressedChange={() => toggleSide("L")}
          className={cn(
            "tag-filter-left h-7 px-2 text-xs",
            selectedSides.has("L") && SIDE_COLORS.left.badge
          )}
        >
          L
        </Toggle>
        <Toggle
          variant="outline"
          size="sm"
          pressed={selectedSides.has("R")}
          onPressedChange={() => toggleSide("R")}
          className={cn(
            "tag-filter-right h-7 px-2 text-xs",
            selectedSides.has("R") && SIDE_COLORS.right.badge
          )}
        >
          R
        </Toggle>

        {availableActions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
              >
                {selectedActions.size === 0
                  ? "Actions"
                  : `${selectedActions.size} action${selectedActions.size > 1 ? "s" : ""}`}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search..." className="h-8" />
                <CommandList>
                  <CommandEmpty>No actions found.</CommandEmpty>
                  {availableActions.map((action) => (
                    <CommandItem
                      key={action}
                      value={action}
                      onSelect={() => toggleAction(action as ActionCode)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          selectedActions.has(action as ActionCode)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {action}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => {
              setSelectedSides(new Set());
              setSelectedActions(new Set());
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Tag list */}
      <ScrollArea className={fillHeight ? "flex-1 min-h-0" : "h-[300px]"}>
        <div className="space-y-2.5 pr-3">
          {filteredTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tags match filters.
            </div>
          ) : (
            filteredTags.map((tag, index) => (
              <div
                key={tag.id}
                className={cn(
                  "tag-card group rounded-lg border border-border/70 bg-card px-3 py-3 transition-colors hover:border-foreground/20",
                  tag.side === "L" && "tag-card-left",
                  tag.side === "R" && "tag-card-right",
                  editingTagId === tag.id && "ring-2 ring-primary/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => {
                      if (tag.timestamp != null && onSeek) {
                        onSeek(tag.timestamp - SEEK_BUFFER);
                      }
                    }}
                    className="text-left"
                    disabled={tag.timestamp == null || !onSeek}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-primary">
                        {tag.timestamp != null
                          ? formatTime(tag.timestamp)
                          : `#${index + 1}`}
                      </span>
                      {tag.side && (
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
                      )}
                      {tag.action && (
                        <Badge
                          variant="outline"
                          className="tag-action-badge px-1.5 py-0 text-xs"
                        >
                          {tag.action}
                        </Badge>
                      )}
                      {formatMatchPeriodLabel(tag.matchPeriod) && tag.matchClock ? (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {formatMatchPeriodLabel(tag.matchPeriod)} {tag.matchClock}
                        </Badge>
                      ) : null}
                      {formatStripZoneLabel(tag.stripZone) ? (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {formatStripZoneLabel(tag.stripZone)}
                        </Badge>
                      ) : null}
                      {tag.mistake && (
                        <Badge
                          variant="outline"
                          className="tag-mistake-badge px-1.5 py-0 text-xs"
                        >
                          {tag.mistake}
                        </Badge>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit tag"
                      className={cn(
                        "h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted",
                        editingTagId === tag.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100 transition-opacity",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(tag.id);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {onShareTag ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Copy share link"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={(event) => {
                          event.stopPropagation();
                          onShareTag(tag.id);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete tag"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(tag.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {tag.comment && (
                  <p
                    className="text-sm text-muted-foreground mt-1"
                    style={{
                      cursor:
                        tag.timestamp != null && onSeek ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (tag.timestamp != null && onSeek) {
                        onSeek(tag.timestamp - SEEK_BUFFER);
                      }
                    }}
                  >
                    {tag.comment}
                  </p>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
