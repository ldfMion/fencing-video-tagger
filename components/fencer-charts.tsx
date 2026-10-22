"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TacticalOutcomesChart } from "@/components/tactical-outcomes-chart";
import type { StatRow } from "@/lib/stats";
import type { TacticalIntent } from "@/lib/action-classifications";

type DefMatchup =
  | "C_scoring"
  | "C_receiving"
  | "P_scoring"
  | "P_receiving"
  | "AP_scoring"
  | "AP_receiving";

interface FencerChartsProps {
  tacticalStats: StatRow<TacticalIntent>[];
  defMatchupStats: StatRow<DefMatchup>[];
}

// Short labels for radar spokes
const SPOKE_LABELS: Record<string, string> = {
  "Counter Attack vs Attack": "Counter vs Atk",
  "Attack vs Counter Attack": "Atk vs Counter",
  "Parry vs Attack": "Parry vs Atk",
  "Attack vs Parry": "Atk vs Parry",
  "Attack on Prep vs Attack": "AoP vs Atk",
  "Attack vs Attack on Prep": "Atk vs AoP",
};

const winRateConfig: ChartConfig = {
  winRate: { label: "Win %", color: "var(--chart-1)" },
};

const scoredReceivedConfig: ChartConfig = {
  scored: { label: "Scored", color: "var(--chart-1)" },
  received: { label: "Received", color: "var(--chart-2)" },
};

const exchangeTypeConfig: ChartConfig = {
  counter: { label: "Counter Attack", color: "var(--chart-1)" },
  parry: { label: "Parry-Riposte", color: "var(--chart-2)" },
  aop: { label: "Attack on Prep", color: "var(--chart-3)" },
  offense: { label: "Offense", color: "var(--chart-4)" },
};

export function FencerCharts({ tacticalStats, defMatchupStats }: FencerChartsProps) {
  // --- Radar: Win % per matchup ---
  const winRateData = defMatchupStats.map((r) => ({
    subject: SPOKE_LABELS[r.label] ?? r.label,
    fullLabel: r.label,
    winRate: r.winRate != null ? Math.round(r.winRate * 100) : 0,
    total: r.total,
  }));

  // --- Radar: Scored vs Received ---
  const scoredReceivedData = defMatchupStats.map((r) => ({
    subject: SPOKE_LABELS[r.label] ?? r.label,
    fullLabel: r.label,
    scored: r.hitsFor,
    received: r.hitsAgainst,
  }));

  // Tactical rows
  const offRow = tacticalStats.find((r) => r.category === "offense");
  const defRow = tacticalStats.find((r) => r.category === "defense");

  // --- Pie: Fencer's executed actions by type ---
  // Each segment = how many times the fencer executed that action (scored or not).
  // C_scoring.total = fencer scored with counter + opponent scored through fencer's counter attempt.
  const cScoringRow = defMatchupStats.find((r) => r.category === "C_scoring");
  const pScoringRow = defMatchupStats.find((r) => r.category === "P_scoring");
  const apScoringRow = defMatchupStats.find((r) => r.category === "AP_scoring");

  const counterExecs = cScoringRow?.total ?? 0;
  const parryExecs = pScoringRow?.total ?? 0;
  const apExecs = apScoringRow?.total ?? 0;
  // grandTotal covers every scorable touch; subtracting defensive execs leaves offensive touches.
  const grandTotal = (offRow?.total ?? 0) + (defRow?.total ?? 0);
  const offenseExecs = grandTotal - counterExecs - parryExecs - apExecs;

  const exchangeTypeData = [
    { name: "counter", value: counterExecs },
    { name: "parry", value: parryExecs },
    { name: "aop", value: apExecs },
    { name: "offense", value: offenseExecs },
  ].filter((d) => d.value > 0);

  const hasRadarData = defMatchupStats.some((r) => r.total > 0);
  const hasPieData = grandTotal > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Chart 1 — Radar: Matchup Win % */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-1">Matchup Win %</p>
        <p className="text-xs text-muted-foreground mb-3">
          Win rate per exchange type (outer = better)
        </p>
        {!hasRadarData ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data</p>
        ) : (
          <ChartContainer config={winRateConfig} className="h-[250px] w-full">
            <RadarChart data={winRateData}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: "currentColor" }}
              />
              <Radar
                dataKey="winRate"
                fill="var(--chart-1)"
                fillOpacity={0.35}
                stroke="var(--chart-1)"
                strokeWidth={1.5}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => [
                      `${value}% (${item.payload.total} touches)`,
                      "Win Rate",
                    ]}
                  />
                }
              />
            </RadarChart>
          </ChartContainer>
        )}
      </div>

      {/* Chart 2 — Radar: Scored vs Received */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-1">Points Scored vs Received</p>
        <p className="text-xs text-muted-foreground mb-3">
          Volume of exchanges per matchup type
        </p>
        {!hasRadarData ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data</p>
        ) : (
          <ChartContainer config={scoredReceivedConfig} className="h-[250px] w-full">
            <RadarChart data={scoredReceivedData}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: "currentColor" }}
              />
              <Radar
                dataKey="scored"
                fill="var(--chart-1)"
                fillOpacity={0.3}
                stroke="var(--chart-1)"
                strokeWidth={1.5}
              />
              <Radar
                dataKey="received"
                fill="var(--chart-2)"
                fillOpacity={0.3}
                stroke="var(--chart-2)"
                strokeWidth={1.5}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
            </RadarChart>
          </ChartContainer>
        )}
      </div>

      {/* Chart 3 — Pie: All touches by winning action type */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-1">Exchange Type Distribution</p>
        <p className="text-xs text-muted-foreground mb-3">
          How often the fencer executed each action type (scored or not)
        </p>
        {!hasPieData ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data</p>
        ) : (
          <ChartContainer config={exchangeTypeConfig} className="h-[250px] w-full">
            <PieChart>
              <Pie
                data={exchangeTypeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {exchangeTypeData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={`var(--color-${entry.name})`}
                    opacity={0.85}
                  />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      `${value} touches`,
                      exchangeTypeConfig[name as string]?.label ?? name,
                    ]}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </div>

      <TacticalOutcomesChart tacticalStats={tacticalStats} />
    </div>
  );
}
