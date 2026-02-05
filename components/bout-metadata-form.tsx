"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VideoSession } from "@/lib/types";

interface BoutMetadataFormProps {
  session: VideoSession | undefined;
  onUpdate: (updates: {
    leftFencer?: string;
    rightFencer?: string;
    boutDate?: string;
  }) => void;
  disabled?: boolean;
}

export function BoutMetadataForm({
  session,
  onUpdate,
  disabled,
}: BoutMetadataFormProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Bout Info</Label>
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="left-fencer" className="text-xs shrink-0">
            L:
          </Label>
          <Input
            id="left-fencer"
            placeholder="Left fencer"
            value={session?.leftFencer ?? ""}
            onChange={(e) => onUpdate({ leftFencer: e.target.value })}
            disabled={disabled}
            className="h-7 text-xs w-28"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="right-fencer" className="text-xs shrink-0">
            R:
          </Label>
          <Input
            id="right-fencer"
            placeholder="Right fencer"
            value={session?.rightFencer ?? ""}
            onChange={(e) => onUpdate({ rightFencer: e.target.value })}
            disabled={disabled}
            className="h-7 text-xs w-28"
          />
        </div>
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
