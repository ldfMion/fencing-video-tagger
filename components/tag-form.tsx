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
    updates: Partial<Omit<Tag, "id" | "createdAt">>,
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
    updates: Partial<Omit<Tag, "id" | "createdAt">>,
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
  const [manualTime, setManualTime] = useState("");
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

      if (editingTag) {
        onUpdateTag(editingTag.id, {
          comment: comment.trim(),
          side,
          action,
          mistake,
          matchPeriod: requiresMatchClock ? matchPeriod : undefined,
          matchClock: requiresMatchClock ? normalizedMatchClock : undefined,
          stripZone: requiresStripZone ? stripZone : undefined,
        });
        return true;
      }

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
        matchPeriod: requiresMatchClock ? matchPeriod : undefined,
        matchClock: requiresMatchClock ? normalizedMatchClock : undefined,
        stripZone: requiresStripZone ? stripZone : undefined,
      });
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
      <form onSubmit={handleSubmit} className="space-y-1.5">
        {isEditing ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Editing tag
              {editingTag?.timestamp != null ? (
                <>
                  {" "}
                  at <span className="font-mono">{formatTime(editingTag.timestamp)}</span>
                </>
              ) : null}
            </p>
            <span className="text-[11px] text-muted-foreground">
              Time is unchanged
            </span>
          </div>
        ) : isVideoMode ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Tag at <span className="font-mono">{formatTime(currentTime)}</span>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Label htmlFor={`manual-time-${formIdPrefix}`} className="shrink-0 text-xs">
              Time:
            </Label>
            <div className="flex flex-1 items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <input
                id={`manual-time-${formIdPrefix}`}
                type="text"
                placeholder="m:ss (optional)"
                value={manualTime}
                onChange={(event) => setManualTime(event.target.value)}
                className="h-6 max-w-[76px] flex-1 rounded-md border border-input bg-background px-2 text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2.5">
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
                        "border-red-500 bg-red-500 text-white hover:bg-red-600",
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
                        "border-green-500 bg-green-500 text-white hover:bg-green-600",
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

          <div className="min-w-[128px] flex-1 space-y-1">
            <Label className="text-xs">Action</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Popover open={actionOpen} onOpenChange={setActionOpen}>
                    <PopoverTrigger asChild>
                      <Button
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
                      setMistake(mistake === "tactical" ? undefined : "tactical")
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
                      setMistake(mistake === "execution" ? undefined : "execution")
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

        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1">
                <Textarea
                  ref={commentRef}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
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
              <div className="flex shrink-0 flex-col gap-2">
                {isEditing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    className="h-[22px] px-3 text-[11px]"
                    onClick={onCancelEdit}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  disabled={disabled || !canSubmit}
                  size="sm"
                  className={cn("px-3", isEditing ? "h-[22px] text-[11px]" : "h-[52px]")}
                >
                  {isEditing ? "Save" : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isEditing ? "Save tag (Enter)" : "Add tag (Enter)"}</p>
            </TooltipContent>
          </Tooltip>
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
