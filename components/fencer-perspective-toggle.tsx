"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SIDE_COLORS } from "@/lib/constants";
import type { Side } from "@/lib/types";

interface FencerPerspectiveToggleProps {
  value: Side;
  onValueChange: (value: Side) => void;
  leftFencer?: string;
  rightFencer?: string;
}

export function FencerPerspectiveToggle({
  value,
  onValueChange,
  leftFencer = "Left",
  rightFencer = "Right",
}: FencerPerspectiveToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === "L" || nextValue === "R") {
          onValueChange(nextValue);
        }
      }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem
        value="L"
        className={value === "L" ? SIDE_COLORS.left.text : ""}
      >
        {leftFencer}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="R"
        className={value === "R" ? SIDE_COLORS.right.text : ""}
      >
        {rightFencer}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
