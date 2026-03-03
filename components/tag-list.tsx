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
import { Check, ChevronDown, Trash2, X } from "lucide-react";
import { SIDE_COLORS } from "@/lib/constants";
import type { ActionCode, Side, Tag } from "@/lib/types";
import { cn, formatTime, sortTags } from "@/lib/utils";

const SEEK_BUFFER = 3;

interface TagListProps {
  tags: Tag[];
  onSeek?: (time: number) => void;
  onDelete: (tagId: string) => void;
  fillHeight?: boolean;
}

export function TagList({
  tags,
  onSeek,
  onDelete,
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
      <div className="flex items-center gap-1.5 pb-2 flex-wrap">
        <Toggle
          size="sm"
          pressed={selectedSides.has("L")}
          onPressedChange={() => toggleSide("L")}
          className={cn(
            "h-7 px-2 text-xs",
            selectedSides.has("L") && SIDE_COLORS.left.badge
          )}
        >
          L
        </Toggle>
        <Toggle
          size="sm"
          pressed={selectedSides.has("R")}
          onPressedChange={() => toggleSide("R")}
          className={cn(
            "h-7 px-2 text-xs",
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
        <div className="space-y-2 pr-4">
          {filteredTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tags match filters.
            </div>
          ) : (
            filteredTags.map((tag, index) => (
              <div key={tag.id} className="group p-2 rounded-lg hover:bg-muted">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => {
                      if (tag.timestamp != null && onSeek) {
                        onSeek(tag.timestamp - SEEK_BUFFER);
                      }
                    }}
                    className="text-left"
                    disabled={tag.timestamp == null && !onSeek}
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
                          className={`text-xs px-1.5 py-0 ${
                            tag.side === "L"
                              ? SIDE_COLORS.left.badge
                              : SIDE_COLORS.right.badge
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
