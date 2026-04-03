"use client";

import type { ReactNode } from "react";
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

type TooltipValue = string | number | Array<string | number>;
type TooltipFormatterResult = [ReactNode, ReactNode];

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

const offenseDefenseConfig: ChartConfig = {
  offensive: { label: "Offensive", color: "var(--chart-1)" },
  defensive: { label: "Defensive", color: "var(--chart-5)" },
};

function DonutChart({
  data,
  config,
  centerPct,
  centerLabel,
  tooltipFormatter,
}: {
  data: { name: string; value: number }[];
  config: ChartConfig;
  centerPct: number;
  centerLabel: string;
  tooltipFormatter: (value: TooltipValue, name: string) => TooltipFormatterResult;
}) {
  return (
    <div className="relative">
      <ChartContainer config={config} className="h-[250px] w-full">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
          >
            {data.map((entry) => (
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
                formatter={(value, name) =>
                  tooltipFormatter(value, name as string)
                }
              />
            }
          />
          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{centerPct}%</span>
        <span className="text-xs text-muted-foreground">{centerLabel}</span>
      </div>
    </div>
  );
}

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

  // --- Donut: Total Offense vs Defense volume ---
  const offVol = (offRow?.hitsFor ?? 0) + (offRow?.hitsAgainst ?? 0);
  const defVol = (defRow?.hitsFor ?? 0) + (defRow?.hitsAgainst ?? 0);
  const totalVol = offVol + defVol;
  const offPct = totalVol > 0 ? Math.round((offVol / totalVol) * 100) : 0;

  const offenseDefenseData = [
    { name: "offensive", value: offVol },
    { name: "defensive", value: defVol },
  ].filter((d) => d.value > 0);

  // --- Donut: Scored touches by offense/defense ---
  const offScoredVol = offRow?.hitsFor ?? 0;
  const defScoredVol = defRow?.hitsFor ?? 0;
  const totalScored = offScoredVol + defScoredVol;
  const offScoredPct = totalScored > 0 ? Math.round((offScoredVol / totalScored) * 100) : 0;

  const scoredSplitData = [
    { name: "offensive", value: offScoredVol },
    { name: "defensive", value: defScoredVol },
  ].filter((d) => d.value > 0);

  // --- Donut: Received touches by offense/defense ---
  // offRow.hitsAgainst = received while attacking (opponent countered/parried)
  // defRow.hitsAgainst = received while defending (opponent attacked through)
  const offReceivedVol = offRow?.hitsAgainst ?? 0;
  const defReceivedVol = defRow?.hitsAgainst ?? 0;
  const totalReceived = offReceivedVol + defReceivedVol;
  const offReceivedPct =
    totalReceived > 0 ? Math.round((offReceivedVol / totalReceived) * 100) : 0;

  const receivedSplitData = [
    { name: "offensive", value: offReceivedVol },
    { name: "defensive", value: defReceivedVol },
  ].filter((d) => d.value > 0);

  const hasRadarData = defMatchupStats.some((r) => r.total > 0);
  const hasPieData = totalVol > 0;

  const offDefTooltipFormatter = (
    value: TooltipValue,
    name: string,
  ): TooltipFormatterResult => [
    `${Array.isArray(value) ? value.join(", ") : value} touches`,
    offenseDefenseConfig[name]?.label ?? name,
  ];

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
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
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

      {/* Chart 4 — Donut: Total Offense vs Defense volume */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-1">Offense vs Defense Volume</p>
        <p className="text-xs text-muted-foreground mb-3">
          Share of all touches in offensive vs defensive exchanges
        </p>
        {!hasPieData ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data</p>
        ) : (
          <DonutChart
            data={offenseDefenseData}
            config={offenseDefenseConfig}
            centerPct={offPct}
            centerLabel={offPct >= 60 ? "Attacker" : offPct >= 40 ? "Balanced" : "Defender"}
            tooltipFormatter={offDefTooltipFormatter}
          />
        )}
      </div>

      {/* Chart 5 — Donut: Scored touches offense/defense split */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-1">Scored: Offense vs Defense</p>
        <p className="text-xs text-muted-foreground mb-3">
          Your scored touches by your tactical role
        </p>
        {!hasPieData ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data</p>
        ) : (
          <DonutChart
            data={scoredSplitData}
            config={offenseDefenseConfig}
            centerPct={offScoredPct}
            centerLabel={
              offScoredPct >= 60 ? "Attacker" : offScoredPct >= 40 ? "Balanced" : "Defender"
            }
            tooltipFormatter={offDefTooltipFormatter}
          />
        )}
      </div>

      {/* Chart 6 — Donut: Received touches offense/defense split */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-1">Received: Offense vs Defense</p>
        <p className="text-xs text-muted-foreground mb-3">
          Touches received while in offensive vs defensive role
        </p>
        {!hasPieData ? (
          <p className="text-xs text-muted-foreground text-center py-8">No data</p>
        ) : (
          <DonutChart
            data={receivedSplitData}
            config={offenseDefenseConfig}
            centerPct={offReceivedPct}
            centerLabel={
              offReceivedPct >= 60
                ? "While Attacking"
                : offReceivedPct >= 40
                  ? "Mixed"
                  : "While Defending"
            }
            tooltipFormatter={offDefTooltipFormatter}
          />
        )}
      </div>
    </div>
  );
}
