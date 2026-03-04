"use client";

import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StatsTable } from "@/components/stats-table";
import { SIDE_COLORS } from "@/lib/constants";
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
        <ToggleGroup
          type="single"
          value={perspective}
          onValueChange={(v) => { if (v) setPerspective(v as Side); }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem
            value="L"
            className={perspective === "L" ? SIDE_COLORS.left.text : ""}
          >
            {leftFencer}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="R"
            className={perspective === "R" ? SIDE_COLORS.right.text : ""}
          >
            {rightFencer}
          </ToggleGroupItem>
        </ToggleGroup>
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
