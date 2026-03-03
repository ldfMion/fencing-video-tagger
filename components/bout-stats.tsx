"use client";

import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SIDE_COLORS } from "@/lib/constants";
import { computeTacticalStats, computeDefMatchupStats, type StatRow } from "@/lib/stats";
import type { Tag, Side } from "@/lib/types";

interface BoutStatsProps {
  tags: Tag[];
  leftFencer?: string;
  rightFencer?: string;
}

function StatsTable({ rows }: { rows: StatRow[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium">Category</th>
            <th className="text-right px-3 py-2 font-medium">For</th>
            <th className="text-right px-3 py-2 font-medium">Against</th>
            <th className="text-right px-3 py-2 font-medium">Diff</th>
            <th className="text-right px-3 py-2 font-medium">Win %</th>
            <th className="text-right px-3 py-2 font-medium">EV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category} className="border-b last:border-b-0">
              <td className="px-3 py-2">{row.label}</td>
              <td className="text-right px-3 py-2 tabular-nums">{row.hitsFor}</td>
              <td className="text-right px-3 py-2 tabular-nums">{row.hitsAgainst}</td>
              <td className="text-right px-3 py-2 tabular-nums">
                <span className={
                  row.differential > 0
                    ? "text-green-600 dark:text-green-400"
                    : row.differential < 0
                      ? "text-red-600 dark:text-red-400"
                      : ""
                }>
                  {row.differential > 0 ? "+" : ""}{row.differential}
                </span>
              </td>
              <td className="text-right px-3 py-2 tabular-nums">
                {row.winRate != null ? `${Math.round(row.winRate * 100)}%` : "–"}
              </td>
              <td className="text-right px-3 py-2 tabular-nums">
                {row.expectedValue != null ? (
                  <span className={
                    row.expectedValue > 0
                      ? "text-green-600 dark:text-green-400"
                      : row.expectedValue < 0
                        ? "text-red-600 dark:text-red-400"
                        : ""
                  }>
                    {row.expectedValue > 0 ? "+" : ""}{row.expectedValue.toFixed(2)}
                  </span>
                ) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
