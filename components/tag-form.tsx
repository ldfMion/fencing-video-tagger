"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Check, ChevronsUpDown, Clock } from "lucide-react";
import {
  ACTION_CODES,
  type Side,
  type ActionCode,
  type MistakeType,
} from "@/lib/types";
import type { AddTagParams } from "@/hooks/use-sessions";
import { cn, formatTime } from "@/lib/utils";

export interface TagFormHandle {
  setSide: (side: Side) => void;
  toggleMistake: (type: MistakeType) => void;
  submit: () => boolean;
  focusAction: () => void;
  focusComment: () => void;
}

interface TagFormProps {
  currentTime: number | undefined;
  onAddTag: (params: AddTagParams) => void;
  disabled?: boolean;
}

export const TagForm = forwardRef<TagFormHandle, TagFormProps>(function TagForm(
  { currentTime, onAddTag, disabled },
  ref,
) {
  const [comment, setComment] = useState("");
  const [side, setSide] = useState<Side | undefined>(undefined);
  const [action, setAction] = useState<ActionCode | undefined>(undefined);
  const [mistake, setMistake] = useState<MistakeType | undefined>(undefined);
  const [actionOpen, setActionOpen] = useState(false);
  const [manualTime, setManualTime] = useState("");

  const isVideoMode = currentTime != null;

  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const resetForm = useCallback(() => {
    setComment("");
    setSide(undefined);
    setAction(undefined);
    setMistake(undefined);
    setManualTime("");
  }, []);

  const parseManualTime = (timeStr: string): number | undefined => {
    if (!timeStr.trim()) return undefined;
    // Parse "m:ss" or "mm:ss" format
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (!isNaN(mins) && !isNaN(secs)) {
        return mins * 60 + secs;
      }
    }
    // Also accept plain seconds
    const seconds = parseInt(timeStr, 10);
    if (!isNaN(seconds)) {
      return seconds;
    }
    return undefined;
  };

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      // Need at least side or comment
      if (!side && !comment.trim()) return false;

      let timestamp: number | undefined;
      if (isVideoMode) {
        timestamp = currentTime;
      } else if (manualTime.trim()) {
        timestamp = parseManualTime(manualTime);
      }

      onAddTag({
        comment: comment.trim(),
        timestamp,
        side,
        action,
        mistake,
      });
      resetForm();
      return true;
    },
    [comment, currentTime, manualTime, side, action, mistake, onAddTag, resetForm, isVideoMode],
  );

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    setSide: (s: Side) => setSide((prev) => (prev === s ? undefined : s)),
    toggleMistake: (type: MistakeType) =>
      setMistake((prev) => (prev === type ? undefined : type)),
    submit: () => handleSubmit(),
    focusAction: () => {
      setActionOpen(true);
    },
    focusComment: () => {
      commentRef.current?.focus();
    },
  }));

  const canSubmit = side || comment.trim();

  // Filter action codes for search
  const [actionSearch, setActionSearch] = useState("");
  const filteredActions = useMemo(() => {
    if (!actionSearch) return ACTION_CODES;
    const lower = actionSearch.toLowerCase();
    return ACTION_CODES.filter((code) => code.toLowerCase().includes(lower));
  }, [actionSearch]);

  return (
    <TooltipProvider delayDuration={300}>
      <form onSubmit={handleSubmit} className="space-y-1.5">
        {isVideoMode ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Tag at <span className="font-mono">{formatTime(currentTime)}</span>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Label htmlFor="manual-time" className="text-xs shrink-0">
              Time:
            </Label>
            <div className="flex items-center gap-1 flex-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <input
                id="manual-time"
                type="text"
                placeholder="m:ss (optional)"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="h-6 text-xs px-2 border border-input rounded-md bg-background flex-1 max-w-[76px]"
              />
            </div>
          </div>
        )}

        {/* Main form row: Side, Action, Mistake */}
        <div className="flex flex-wrap items-end gap-2.5">
          {/* Side selector */}
          <div className="space-y-1">
            <Label className="text-xs">Side</Label>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={side === "L" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSide(side === "L" ? undefined : "L")}
                    className={cn(
                      "h-7 w-8",
                      side === "L" &&
                        "bg-red-500 hover:bg-red-600 text-white border-red-500",
                    )}
                  >
                    L
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Left side (Q)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={side === "R" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSide(side === "R" ? undefined : "R")}
                    className={cn(
                      "h-7 w-8",
                      side === "R" &&
                        "bg-green-500 hover:bg-green-600 text-white border-green-500",
                    )}
                  >
                    R
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Right side (E)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Action selector (searchable) */}
          <div className="space-y-1 flex-1 min-w-[128px]">
            <Label className="text-xs">Action</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Popover open={actionOpen} onOpenChange={setActionOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        ref={actionButtonRef}
                        variant="outline"
                        role="combobox"
                        aria-expanded={actionOpen}
                        size="sm"
                        className="w-full justify-between"
                      >
                        {action ?? "Select..."}
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[190px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search action..."
                          value={actionSearch}
                          onValueChange={setActionSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No action found.</CommandEmpty>
                          <CommandGroup>
                            {filteredActions.map((code) => (
                              <CommandItem
                                key={code}
                                value={code}
                                onSelect={() => {
                                  setAction(
                                    action === code
                                      ? undefined
                                      : (code as ActionCode),
                                  );
                                  setActionOpen(false);
                                  setActionSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    action === code
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {code}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search actions (/)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Mistake selector */}
          <div className="space-y-1">
            <Label className="text-xs">Mistake</Label>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={mistake === "tactical" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setMistake(
                        mistake === "tactical" ? undefined : "tactical",
                      )
                    }
                    className="h-7 px-2 text-[11px]"
                  >
                    Tactical
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tactical mistake (T)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={mistake === "execution" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setMistake(
                        mistake === "execution" ? undefined : "execution",
                      )
                    }
                    className="h-7 px-2 text-[11px]"
                  >
                    Execution
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Execution mistake (Y)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Comment and submit row */}
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1">
                <Textarea
                  ref={commentRef}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Comment (optional)..."
                  disabled={disabled}
                  className="min-h-[52px] resize-none text-xs"
                  rows={2}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Focus comment (N)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                disabled={disabled || !canSubmit}
                size="sm"
                className="h-[52px] px-3"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add tag (Enter)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </TooltipProvider>
  );
});
