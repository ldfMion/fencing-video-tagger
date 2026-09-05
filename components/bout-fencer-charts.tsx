"use client";

import { useMemo } from "react";
import { FencerCharts } from "@/components/fencer-charts";
import { FencerPerspectiveToggle } from "@/components/fencer-perspective-toggle";
import { computeDefMatchupStats, computeTacticalStats } from "@/lib/stats";
import type { Side, Tag } from "@/lib/types";

interface BoutFencerChartsProps {
  tags: Tag[];
  perspective: Side;
  onPerspectiveChange: (perspective: Side) => void;
  leftFencer?: string;
  rightFencer?: string;
}

export function BoutFencerCharts({
  tags,
  perspective,
  onPerspectiveChange,
  leftFencer = "Left",
  rightFencer = "Right",
}: BoutFencerChartsProps) {
  const tacticalStats = useMemo(
    () => computeTacticalStats(tags, perspective),
    [tags, perspective],
  );
  const defMatchupStats = useMemo(
    () => computeDefMatchupStats(tags, perspective),
    [tags, perspective],
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Fencer Charts</h3>
          <p className="text-xs text-muted-foreground">
            Tactical profile for the selected fencer
          </p>
        </div>
        <FencerPerspectiveToggle
          value={perspective}
          onValueChange={onPerspectiveChange}
          leftFencer={leftFencer}
          rightFencer={rightFencer}
        />
      </div>
      <FencerCharts
        tacticalStats={tacticalStats}
        defMatchupStats={defMatchupStats}
      />
    </section>
  );
}
