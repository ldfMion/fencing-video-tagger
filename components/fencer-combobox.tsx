"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FencerComboboxProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  names: string[];
  disabled?: boolean;
  inline?: boolean;
}

export function FencerCombobox({
  id,
  label,
  placeholder,
  value,
  onChange,
  names,
  disabled,
  inline = true,
}: FencerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return names;
    const q = search.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [names, search]);

  if (!names.length) {
    return (
      <div className={inline ? "flex items-center gap-1.5" : "space-y-2"}>
        <Label htmlFor={id} className={inline ? "text-xs shrink-0" : "text-sm"}>
          {label}
        </Label>
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inline ? "h-7 text-xs w-28" : "h-8 text-sm"}
        />
      </div>
    );
  }

  return (
    <div className={inline ? "flex items-center gap-1.5" : "space-y-2"}>
      <Label className={inline ? "text-xs shrink-0" : "text-sm"}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              inline
                ? "h-7 w-28 justify-between text-xs font-normal px-2"
                : "h-8 justify-between text-sm font-normal px-2"
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={`${inline ? "w-[200px]" : "w-[250px]"} p-0`}
          align="start"
        >
          <Command>
            <CommandInput
              placeholder="Search name..."
              value={search}
              onValueChange={setSearch}
              className={inline ? "text-xs" : "text-sm"}
            />
            <CommandList>
              <CommandEmpty>
                {search.trim() ? (
                  <button
                    type="button"
                    className={`w-full px-2 py-1.5 text-left hover:bg-accent rounded-sm ${inline ? "text-xs" : "text-sm"}`}
                    onClick={() => {
                      onChange(search.trim());
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    Use &ldquo;{search.trim()}&rdquo;
                  </button>
                ) : (
                  <span className={inline ? "text-xs" : "text-sm"}>
                    No names found.
                  </span>
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
                        inline ? "mr-2 h-3 w-3" : "mr-2 h-4 w-4",
                        value === name ? "opacity-100" : "opacity-0"
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
