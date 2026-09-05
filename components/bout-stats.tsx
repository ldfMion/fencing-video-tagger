"use client";

import { useMemo } from "react";
import { StatsTable } from "@/components/stats-table";
import { computeTacticalStats, computeDefMatchupStats } from "@/lib/stats";
import type { Tag, Side } from "@/lib/types";

interface BoutStatsProps {
  tags: Tag[];
  perspective: Side;
}

export function BoutStats({
  tags,
  perspective,
}: BoutStatsProps) {
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
      <div className="mb-3">
        <h3 className="text-sm font-medium">Statistics</h3>
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
