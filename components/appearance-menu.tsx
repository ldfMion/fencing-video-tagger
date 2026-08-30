"use client";

import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

const COLOR_MODES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceMenu({ compact = false }: { compact?: boolean }) {
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
      <PopoverContent align="end" className="appearance-popover w-64">
        <PopoverHeader>
          <PopoverTitle>Appearance</PopoverTitle>
          <PopoverDescription className="text-foreground">
            Choose how Studio Midnight adapts to your display.
          </PopoverDescription>
        </PopoverHeader>

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
