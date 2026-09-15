"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { TagSummary } from "@/components/tag-summary";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
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
  matchClockEnabled?: boolean;
  leftFencer?: string;
  rightFencer?: string;
}

export function BoutScoreChart({
  tags,
  matchClockEnabled = false,
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
              formatAxisTick(value, chartData.xMode, chartData.domainMax)
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
              <ScoreProgressionTooltip
                xMode={chartData.xMode}
                matchClockEnabled={matchClockEnabled}
                leftFencer={leftFencer}
                rightFencer={rightFencer}
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

function formatAxisTick(
  value: number,
  xMode: "event" | "time",
  domainMax: number,
): string {
  if (xMode === "time") {
    const adjustedValue = value === domainMax && value > 0 ? value - 1 : value;
    const periodIndex = Math.min(Math.floor(adjustedValue / 180), 3);
    const periodStart = periodIndex * 180;
    const periodDuration = periodIndex === 3 ? 60 : 180;
    const elapsedInPeriod = value - periodStart;
    const remainingSeconds = Math.max(0, periodDuration - elapsedInPeriod);
    const period = periodIndex === 3 ? "Pri" : `P${periodIndex + 1}`;

    return `${period} ${formatTime(remainingSeconds)}`;
  }

  return value === 0 ? "Start" : `${value}`;
}

interface ScoreProgressionTooltipProps
  extends Partial<TooltipContentProps<number, string>> {
  xMode: "event" | "time";
  matchClockEnabled: boolean;
  leftFencer: string;
  rightFencer: string;
}

function ScoreProgressionTooltip({
  active,
  payload,
  xMode,
  matchClockEnabled,
  leftFencer,
  rightFencer,
}: ScoreProgressionTooltipProps) {
  const point = payload?.[0]?.payload as ScoreProgressionPoint | undefined;

  if (!active || !point) {
    return null;
  }

  const tag = point.tag;

  return (
    <div className="tag-card grid max-w-80 gap-2 rounded-lg border border-border/70 bg-card px-3 py-3 text-xs shadow-md">
      {tag ? (
        <TagSummary
          tag={tag}
          matchClockEnabled={matchClockEnabled}
          fallbackIndex={point.eventIndex}
        />
      ) : (
        <p className="font-medium">
          {formatTooltipLabel(point, xMode, leftFencer, rightFencer)}
        </p>
      )}
      <p className="border-t pt-2 text-muted-foreground">
        <span className="font-medium text-foreground">
          {formatTooltipLabel(point, xMode, leftFencer, rightFencer)}
        </span>
        <span className="mx-1.5">·</span>
        <span className="font-mono tabular-nums">
          {leftFencer} {point.leftScore}–{point.rightScore} {rightFencer}
        </span>
      </p>
    </div>
  );
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
