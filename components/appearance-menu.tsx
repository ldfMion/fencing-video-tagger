"use client";

import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DESIGN_THEMES,
  useDesignTheme,
} from "@/components/design-theme-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const COLOR_MODES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceMenu({ compact = false }: { compact?: boolean }) {
  const { designTheme, setDesignTheme } = useDesignTheme();
  const { theme, setTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon-sm" : "sm"}
          aria-label="Change appearance"
          title="Appearance"
        >
          <Palette />
          {compact ? null : <span>Appearance</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="appearance-popover w-72">
        <PopoverHeader>
          <PopoverTitle>Appearance</PopoverTitle>
          <PopoverDescription className="text-foreground">
            Choose a visual style and color mode independently.
          </PopoverDescription>
        </PopoverHeader>

        <div className="space-y-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Design
          </p>
          <div className="grid gap-1.5">
            {DESIGN_THEMES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDesignTheme(option.id)}
                className={cn(
                  "appearance-option flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted",
                  designTheme === option.id && "border-primary bg-primary/8",
                )}
              >
                <span
                  className={cn(
                    "size-8 shrink-0 rounded-md border shadow-sm",
                    option.previewClass,
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">{option.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                <Check
                  className={cn(
                    "size-3.5 text-primary",
                    designTheme !== option.id && "opacity-0",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Color mode
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {COLOR_MODES.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.id}
                  variant={theme === option.id ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setTheme(option.id)}
                  className="gap-1.5"
                >
                  <Icon className="size-3" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
