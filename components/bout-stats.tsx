"use client";

import { useMemo, useState } from "react";
import { FencerPerspectiveToggle } from "@/components/fencer-perspective-toggle";
import { StatsTable } from "@/components/stats-table";
import { computeTacticalStats, computeDefMatchupStats } from "@/lib/stats";
import type { Tag, Side } from "@/lib/types";

interface BoutStatsProps {
  tags: Tag[];
  leftFencer?: string;
  rightFencer?: string;
}

export function BoutStats({
  tags,
  leftFencer = "Left",
  rightFencer = "Right",
}: BoutStatsProps) {
  const [perspective, setPerspective] = useState<Side>("L");

  const tacticalStats = useMemo(
    () => computeTacticalStats(tags, perspective),
    [tags, perspective],
  );

  const defMatchupStats = useMemo(
    () => computeDefMatchupStats(tags, perspective),
    [tags, perspective],
  );

  const allRows = [...tacticalStats, ...defMatchupStats];
  const hasData = allRows.some((r) => r.hitsFor > 0 || r.hitsAgainst > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Statistics</h3>
        <FencerPerspectiveToggle
          value={perspective}
          onValueChange={setPerspective}
          leftFencer={leftFencer}
          rightFencer={rightFencer}
        />
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No scoring events yet.
        </p>
      ) : (
        <div className="space-y-4">
          <StatsTable rows={tacticalStats} />
          <StatsTable rows={defMatchupStats} />
        </div>
      )}
    </div>
  );
}
