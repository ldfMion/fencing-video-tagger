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
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import {
  ACTION_CODES,
  type Side,
  type ActionCode,
  type MistakeType,
} from "@/lib/types";
import type { AddTagParams } from "@/hooks/use-sessions";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export interface TagFormHandle {
  setSide: (side: Side) => void;
  toggleMistake: (type: MistakeType) => void;
  submit: () => boolean;
  focusAction: () => void;
  focusComment: () => void;
}

interface TagFormProps {
  currentTime: number;
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

  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const resetForm = useCallback(() => {
    setComment("");
    setSide(undefined);
    setAction(undefined);
    setMistake(undefined);
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      // Need at least side or comment
      if (!side && !comment.trim()) return false;

      onAddTag({
        comment: comment.trim(),
        timestamp: currentTime,
        side,
        action,
        mistake,
      });
      resetForm();
      return true;
    },
    [comment, currentTime, side, action, mistake, onAddTag, resetForm],
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
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Tag at <span className="font-mono">{formatTime(currentTime)}</span>
          </p>
        </div>

        {/* Main form row: Side, Action, Mistake */}
        <div className="flex flex-wrap items-end gap-3">
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
                      "w-10 h-8",
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
                      "w-10 h-8",
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
          <div className="space-y-1 flex-1 min-w-[140px]">
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
                        className="w-full h-8 justify-between text-sm"
                      >
                        {action ?? "Select..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
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
                    className="h-8 text-xs px-2"
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
                    className="h-8 text-xs px-2"
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
                  className="text-sm resize-none min-h-[60px]"
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
                className="h-[60px] px-4"
              >
                <Plus className="h-4 w-4" />
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
