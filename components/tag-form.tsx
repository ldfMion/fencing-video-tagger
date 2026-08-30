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
import { Input } from "@/components/ui/input";
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
  getDefaultMatchPeriod,
  isMatchClockEnabled,
  isStripZoneEnabled,
  normalizeMatchClockInput,
  STRIP_ZONE_FLEX_WEIGHTS,
  STRIP_ZONE_LABELS,
} from "@/lib/tagging";
import {
  ACTION_CODES,
  MATCH_PERIODS,
  STRIP_ZONES,
  type Side,
  type ActionCode,
  type MatchPeriod,
  type MistakeType,
  type StripZone,
  type Tag,
  type CompleteTagContent,
  type TaggingOptions,
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
  onUpdateTag: (
    tagId: string,
    updates: CompleteTagContent,
  ) => void | Promise<void>;
  onCancelEdit: () => void;
  editingTag?: Tag | null;
  taggingOptions?: TaggingOptions;
  disabled?: boolean;
}

interface TagFormFieldsProps {
  currentTime: number | undefined;
  onAddTag: (params: AddTagParams) => void;
  onUpdateTag: (
    tagId: string,
    updates: CompleteTagContent,
  ) => void | Promise<void>;
  onCancelEdit: () => void;
  editingTag?: Tag | null;
  taggingOptions?: TaggingOptions;
  disabled?: boolean;
  formIdPrefix: string;
}

const TagFormFields = forwardRef<TagFormHandle, TagFormFieldsProps>(function TagFormFields(
  {
    currentTime,
    onAddTag,
    onUpdateTag,
    onCancelEdit,
    editingTag,
    taggingOptions,
    disabled,
    formIdPrefix,
  },
  ref,
) {
  const isEditing = Boolean(editingTag);
  const [comment, setComment] = useState(editingTag?.comment ?? "");
  const [side, setSide] = useState<Side | undefined>(editingTag?.side);
  const [action, setAction] = useState<ActionCode | undefined>(editingTag?.action);
  const [mistake, setMistake] = useState<MistakeType | undefined>(editingTag?.mistake);
  const [actionOpen, setActionOpen] = useState(false);
  const [manualTime, setManualTime] = useState(
    editingTag?.timestamp != null ? formatTime(editingTag.timestamp) : "",
  );
  const [matchPeriod, setMatchPeriod] = useState<MatchPeriod>(
    editingTag?.matchPeriod ?? getDefaultMatchPeriod(),
  );
  const [matchClock, setMatchClock] = useState(editingTag?.matchClock ?? "");
  const [stripZone, setStripZone] = useState<StripZone | undefined>(editingTag?.stripZone);
  const [actionSearch, setActionSearch] = useState("");

  const isVideoMode = currentTime != null;
  const requiresMatchClock = isMatchClockEnabled({ taggingOptions });
  const requiresStripZone = isStripZoneEnabled({ taggingOptions });
  const normalizedMatchClock = useMemo(
    () => normalizeMatchClockInput(matchClock),
    [matchClock],
  );
  const filteredActions = useMemo(() => {
    if (!actionSearch) {
      return ACTION_CODES;
    }

    const lower = actionSearch.toLowerCase();
    return ACTION_CODES.filter((code) => code.toLowerCase().includes(lower));
  }, [actionSearch]);
  const canSubmit = Boolean(
    (side || comment.trim()) &&
      (!requiresMatchClock || normalizedMatchClock) &&
      (!requiresStripZone || stripZone),
  );

  const commentRef = useRef<HTMLTextAreaElement>(null);

  const resetCreateFields = useCallback(() => {
    setComment("");
    setSide(undefined);
    setAction(undefined);
    setMistake(undefined);
    setManualTime("");
  }, []);

  const parseManualTime = (timeStr: string): number | undefined => {
    if (!timeStr.trim()) return undefined;

    const parts = timeStr.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseInt(parts[1], 10);
      if (!isNaN(mins) && !isNaN(secs)) {
        return mins * 60 + secs;
      }
    }

    const seconds = parseInt(timeStr, 10);
    if (!isNaN(seconds)) {
      return seconds;
    }

    return undefined;
  };

  const handleSubmit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();

      if (!side && !comment.trim()) return false;
      if (requiresMatchClock && !normalizedMatchClock) return false;
      if (requiresStripZone && !stripZone) return false;

      let timestamp: number | undefined;
      if (isVideoMode) {
        timestamp = currentTime;
      } else if (manualTime.trim()) {
        timestamp = parseManualTime(manualTime);
      }

      const tagContent: CompleteTagContent = {
        timestamp,
        comment: comment.trim(),
        side,
        action,
        mistake,
        matchPeriod: requiresMatchClock ? matchPeriod : undefined,
        matchClock: requiresMatchClock ? normalizedMatchClock : undefined,
        stripZone: requiresStripZone ? stripZone : undefined,
      };

      if (editingTag) {
        onUpdateTag(editingTag.id, tagContent);
        return true;
      }

      onAddTag(tagContent);
      resetCreateFields();
      return true;
    },
    [
      action,
      comment,
      currentTime,
      editingTag,
      isVideoMode,
      manualTime,
      matchPeriod,
      mistake,
      normalizedMatchClock,
      onAddTag,
      onUpdateTag,
      requiresMatchClock,
      requiresStripZone,
      resetCreateFields,
      side,
      stripZone,
    ],
  );

  useImperativeHandle(ref, () => ({
    setSide: (nextSide: Side) =>
      setSide((previousSide) => (previousSide === nextSide ? undefined : nextSide)),
    toggleMistake: (type: MistakeType) =>
      setMistake((previousMistake) => (previousMistake === type ? undefined : type)),
    submit: () => handleSubmit(),
    focusAction: () => {
      setActionOpen(true);
    },
    focusComment: () => {
      commentRef.current?.focus();
    },
  }));

  return (
    <TooltipProvider delayDuration={300}>
      <form onSubmit={handleSubmit} className="tag-composer space-y-2.5">
        <div className="tag-composer-surface">
          {isEditing ? (
            <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                Editing tag
                {editingTag?.timestamp != null ? (
                  <>
                    {" "}
                    at <span className="font-mono">{formatTime(editingTag.timestamp)}</span>
                  </>
                ) : null}
              </p>
              <span className="text-[10px] text-muted-foreground">
                Save updates time
              </span>
            </div>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Textarea
                ref={commentRef}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Add a note about this moment…"
                disabled={disabled}
                autoFocus
                className="tag-note-input min-h-[58px] resize-none border-0 bg-transparent px-1 py-1 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
                rows={2}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Focus note (N)</p>
            </TooltipContent>
          </Tooltip>

          <div className="tag-composer-meta">
            {isVideoMode ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3" />
                {formatTime(currentTime)}
              </span>
            ) : (
              <label className="inline-flex items-center gap-1.5" htmlFor={`manual-time-${formIdPrefix}`}>
                <Clock className="size-3" />
                <input
                  id={`manual-time-${formIdPrefix}`}
                  type="text"
                  placeholder="m:ss (optional)"
                  value={manualTime}
                  onChange={(event) => setManualTime(event.target.value)}
                  className="w-24 border-0 bg-transparent p-0 font-mono text-[11px] outline-none placeholder:text-muted-foreground"
                />
              </label>
            )}
            <span className="ml-auto hidden text-[10px] sm:inline">⌘/Ctrl ↵ to save</span>
          </div>

          <div className="tag-properties flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={side === "L" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSide(side === "L" ? undefined : "L")}
                    className={cn(
                      "side-choice side-choice-left h-7 w-9",
                      side === "L" &&
                        "side-choice-selected border-red-500 bg-red-500 text-white hover:bg-red-600",
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
                      "side-choice side-choice-right h-7 w-9",
                      side === "R" &&
                        "side-choice-selected border-green-500 bg-green-500 text-white hover:bg-green-600",
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

            <div className="min-w-[128px] max-w-[220px] flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Popover open={actionOpen} onOpenChange={setActionOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-label="Select action"
                        aria-expanded={actionOpen}
                        size="sm"
                        className={cn(
                          "tag-action-trigger w-full justify-between",
                          action && "tag-property-action-selected",
                        )}
                      >
                        {action ?? "Select..."}
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[190px] p-0" align="start">
                      <Command className="tag-action-command">
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
                                  setAction(action === code ? undefined : (code as ActionCode));
                                  setActionOpen(false);
                                  setActionSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    action === code ? "opacity-100" : "opacity-0",
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

            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={mistake === "tactical" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setMistake(mistake === "tactical" ? undefined : "tactical")
                    }
                    className={cn(
                      "tag-mistake-choice h-7 px-2 text-[11px]",
                      mistake === "tactical" && "tag-property-mistake-selected",
                    )}
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
                      setMistake(mistake === "execution" ? undefined : "execution")
                    }
                    className={cn(
                      "tag-mistake-choice h-7 px-2 text-[11px]",
                      mistake === "execution" && "tag-property-mistake-selected",
                    )}
                  >
                    Execution
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Execution mistake (Y)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex shrink-0 items-center gap-1.5">
                {isEditing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    className="h-7 px-2.5 text-[11px]"
                    onClick={onCancelEdit}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  aria-label={isEditing ? "Save tag" : "Add tag"}
                  disabled={disabled || !canSubmit}
                  size="sm"
                  className={cn(
                    "h-7 gap-1.5 px-3 text-[11px]",
                    !isEditing && side === "L" && "tag-submit-left",
                    !isEditing && side === "R" && "tag-submit-right",
                  )}
                >
                  {isEditing ? "Save changes" : <><Plus className="h-3.5 w-3.5" /> Add tag</>}
                </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isEditing ? "Save tag (⌘/Ctrl + Enter)" : "Add tag (⌘/Ctrl + Enter)"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {requiresMatchClock || requiresStripZone ? (
          <div
            className={cn(
              "grid gap-2",
              requiresMatchClock && requiresStripZone
                ? "sm:grid-cols-[minmax(0,172px)_minmax(0,1fr)]"
                : "sm:grid-cols-1",
            )}
          >
            {requiresMatchClock ? (
              <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`match-clock-${formIdPrefix}`} className="text-xs">
                    Match clock
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Sticky
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {MATCH_PERIODS.map((period) => (
                      <Button
                        key={period}
                        type="button"
                        variant={matchPeriod === period ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMatchPeriod(period)}
                        className="h-6 min-w-0 flex-1 px-1 text-[10px]"
                      >
                        {period === "priority" ? "Pri" : `P${period}`}
                      </Button>
                    ))}
                  </div>
                  <Input
                    id={`match-clock-${formIdPrefix}`}
                    value={matchClock}
                    onChange={(event) => setMatchClock(event.target.value)}
                    onBlur={() => {
                      if (normalizedMatchClock) {
                        setMatchClock(normalizedMatchClock);
                      }
                    }}
                    placeholder="2:17 or 217"
                    aria-invalid={matchClock.length > 0 && !normalizedMatchClock}
                    className="h-6 text-xs font-mono"
                  />
                </div>
              </div>
            ) : null}

            {requiresStripZone ? (
              <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Strip zone</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Left to right
                  </span>
                </div>
                <div className="overflow-hidden rounded-md border border-input bg-background">
                  <div className="flex">
                    {STRIP_ZONES.map((zone, index) => (
                      <button
                        key={zone}
                        type="button"
                        onClick={() =>
                          setStripZone((currentZone) =>
                            currentZone === zone ? undefined : zone,
                          )
                        }
                        style={{ flex: STRIP_ZONE_FLEX_WEIGHTS[index] }}
                        className={cn(
                          "flex h-8 items-center justify-center whitespace-normal border-r border-input px-1 text-center text-[9px] font-medium leading-tight transition-colors last:border-r-0",
                          stripZone === zone
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                        )}
                      >
                        {STRIP_ZONE_LABELS[zone]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </TooltipProvider>
  );
});

export const TagForm = forwardRef<TagFormHandle, TagFormProps>(function TagForm(
  props,
  ref,
) {
  const createFormRef = useRef<TagFormHandle>(null);
  const editFormRef = useRef<TagFormHandle>(null);
  const activeFormRef = props.editingTag ? editFormRef : createFormRef;

  useImperativeHandle(
    ref,
    () => ({
      setSide: (side: Side) => activeFormRef.current?.setSide(side),
      toggleMistake: (type: MistakeType) => activeFormRef.current?.toggleMistake(type),
      submit: () => activeFormRef.current?.submit() ?? false,
      focusAction: () => {
        activeFormRef.current?.focusAction();
      },
      focusComment: () => {
        activeFormRef.current?.focusComment();
      },
    }),
    [activeFormRef],
  );

  return (
    <>
      <div className={props.editingTag ? "hidden" : undefined}>
        <TagFormFields
          ref={createFormRef}
          {...props}
          editingTag={null}
          formIdPrefix="create"
        />
      </div>
      {props.editingTag ? (
        <TagFormFields
          key={props.editingTag.id}
          ref={editFormRef}
          {...props}
          formIdPrefix={`edit-${props.editingTag.id}`}
        />
      ) : null}
    </>
  );
});
