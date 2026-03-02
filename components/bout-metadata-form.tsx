"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoSession } from "@/lib/types";

interface BoutMetadataFormProps {
  session: VideoSession | undefined;
  onUpdate: (updates: {
    leftFencer?: string;
    rightFencer?: string;
    boutDate?: string;
  }) => void;
  fencerNames?: string[];
  disabled?: boolean;
}

function FencerCombobox({
  id,
  label,
  placeholder,
  value,
  onChange,
  names,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  names: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return names;
    const q = search.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [names, search]);

  if (!names.length) {
    return (
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-xs shrink-0">
          {label}
        </Label>
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-7 text-xs w-28"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs shrink-0">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-7 w-28 justify-between text-xs font-normal px-2"
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search name..."
              value={search}
              onValueChange={setSearch}
              className="text-xs"
            />
            <CommandList>
              <CommandEmpty>
                {search.trim() ? (
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-xs text-left hover:bg-accent rounded-sm"
                    onClick={() => {
                      onChange(search.trim());
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    Use &ldquo;{search.trim()}&rdquo;
                  </button>
                ) : (
                  <span className="text-xs">No names found.</span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    onSelect={() => {
                      onChange(name === value ? "" : name);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        value === name ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function BoutMetadataForm({
  session,
  onUpdate,
  fencerNames = [],
  disabled,
}: BoutMetadataFormProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Bout Info</Label>
      <div className="flex flex-wrap gap-2">
        <FencerCombobox
          id="left-fencer"
          label="L:"
          placeholder="Left fencer"
          value={session?.leftFencer ?? ""}
          onChange={(v) => onUpdate({ leftFencer: v })}
          names={fencerNames}
          disabled={disabled}
        />
        <FencerCombobox
          id="right-fencer"
          label="R:"
          placeholder="Right fencer"
          value={session?.rightFencer ?? ""}
          onChange={(v) => onUpdate({ rightFencer: v })}
          names={fencerNames}
          disabled={disabled}
        />
        <div className="flex items-center gap-1.5">
          <Label htmlFor="bout-date" className="text-xs shrink-0">
            Date:
          </Label>
          <Input
            id="bout-date"
            type="date"
            value={session?.boutDate ?? ""}
            onChange={(e) => onUpdate({ boutDate: e.target.value })}
            disabled={disabled}
            className="h-7 text-xs w-32"
          />
        </div>
      </div>
    </div>
  );
}
