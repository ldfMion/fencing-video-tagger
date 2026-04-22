"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMatchPeriodLabel } from "@/lib/tagging";
import {
  buildScoreProgressionChartData,
  type ScoreProgressionPoint,
} from "@/lib/score";
import type { Tag } from "@/lib/types";
import { formatTime } from "@/lib/utils";

interface BoutScoreChartProps {
  tags: Tag[];
  leftFencer?: string;
  rightFencer?: string;
}

export function BoutScoreChart({
  tags,
  leftFencer = "Left",
  rightFencer = "Right",
}: BoutScoreChartProps) {
  const chartData = useMemo(() => buildScoreProgressionChartData(tags), [tags]);

  const chartConfig = useMemo(
    () =>
      ({
        leftScore: {
          label: leftFencer,
          theme: {
            light: "#b91c1c",
            dark: "#f87171",
          },
        },
        rightScore: {
          label: rightFencer,
          theme: {
            light: "#15803d",
            dark: "#4ade80",
          },
        },
      }) satisfies ChartConfig,
    [leftFencer, rightFencer],
  );

  const maxScore = Math.max(
    1,
    ...chartData.points.map((point) =>
      Math.max(point.leftScore, point.rightScore),
    ),
  );

  if (chartData.points.length <= 1) {
    return (
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-1">Score Progression</p>
        <p className="text-xs text-muted-foreground">
          No scoring events yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 space-y-1">
        <p className="text-sm font-medium">Score Progression</p>
        <p className="text-xs text-muted-foreground">
          {chartData.xMode === "time"
            ? "X-axis uses match period and clock. Dashed markers show breaks between periods."
            : "Timed metadata is incomplete, so the x-axis falls back to scoring order."}
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <LineChart
          data={chartData.points}
          margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, chartData.domainMax]}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) =>
              formatAxisTick(value, chartData.xMode)
            }
          />
          <YAxis
            allowDecimals={false}
            domain={[0, maxScore]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={28}
          />
          {chartData.breaks.map((periodBreak) => (
            <ReferenceLine
              key={periodBreak.x}
              x={periodBreak.x}
              stroke="var(--border)"
              strokeDasharray="4 4"
              label={{
                value: periodBreak.label,
                position: "insideTop",
                fontSize: 10,
                fill: "currentColor",
              }}
            />
          ))}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  formatTooltipLabel(
                    payload[0]?.payload as ScoreProgressionPoint | undefined,
                    chartData.xMode,
                    leftFencer,
                    rightFencer,
                  )
                }
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="stepAfter"
            dataKey="leftScore"
            stroke="var(--color-leftScore)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="rightScore"
            stroke="var(--color-rightScore)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function formatAxisTick(value: number, xMode: "event" | "time"): string {
  if (xMode === "time") {
    return formatTime(value);
  }

  return value === 0 ? "Start" : `${value}`;
}

function formatTooltipLabel(
  point: ScoreProgressionPoint | undefined,
  xMode: "event" | "time",
  leftFencer: string,
  rightFencer: string,
): string {
  if (!point) {
    return "";
  }

  if (point.pointType === "start") {
    return xMode === "time" ? "Bout start" : "Before first score";
  }

  if (point.pointType === "tail") {
    return xMode === "time" ? "End of current segment" : "Current final score";
  }

  const eventSummary = getEventSummary(point, leftFencer, rightFencer);

  if (xMode === "time" && point.matchPeriod && point.matchClock) {
    const periodLabel = formatMatchPeriodLabel(point.matchPeriod);
    return periodLabel
      ? `${periodLabel} ${point.matchClock}${eventSummary ? ` • ${eventSummary}` : ""}`
      : `${point.matchClock}${eventSummary ? ` • ${eventSummary}` : ""}`;
  }

  return eventSummary ?? `Score event ${point.eventIndex ?? ""}`.trim();
}

function getEventSummary(
  point: ScoreProgressionPoint,
  leftFencer: string,
  rightFencer: string,
): string | null {
  const sideLabel =
    point.side === "L" ? leftFencer : point.side === "R" ? rightFencer : null;

  if (!sideLabel) {
    return point.eventIndex != null ? `Score event ${point.eventIndex}` : null;
  }

  if (point.action === "yc") {
    return `Yellow card to ${sideLabel}`;
  }

  if (point.action === "rc") {
    return `Red card to ${sideLabel}`;
  }

  return `${sideLabel} scored`;
}
