"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "lucide-react";
import { FencerCombobox } from "@/components/fencer-combobox";
import type { VideoSession } from "@/lib/types";

interface BoutMetadataFormProps {
  session: VideoSession | undefined;
  onUpdate: (updates: {
    leftFencer?: string;
    rightFencer?: string;
    boutDate?: string;
    externalSource?: string;
  }) => void;
  fencerNames?: string[];
  disabled?: boolean;
}

export function BoutMetadataForm({
  session,
  onUpdate,
  fencerNames = [],
  disabled,
}: BoutMetadataFormProps) {
  const isValidUrl = (str: string): boolean => {
    try {
      const url = new URL(str);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const externalSource = session?.externalSource ?? "";
  const isUrl = externalSource.trim() && isValidUrl(externalSource);

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
        <div className="flex items-center gap-1.5">
          <Label htmlFor="source" className="text-xs shrink-0">
            Source:
          </Label>
          <div className="flex items-center gap-1 flex-1 min-w-[150px]">
            <Input
              id="source"
              placeholder="Video URL or reference..."
              value={externalSource}
              onChange={(e) => onUpdate({ externalSource: e.target.value })}
              disabled={disabled}
              className="h-7 text-xs"
            />
            {isUrl && (
              <a
                href={externalSource}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
