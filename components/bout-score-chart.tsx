"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ReferenceArea,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { AnalysisRangeControls } from "@/components/analysis-range-controls";
import type { AnalysisRange } from "@/lib/analysis-range";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TagSummary } from "@/components/tag-summary";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { MATCH_PERIOD_SEGMENTS } from "@/lib/match-clock";
import { formatMatchPeriodLabel } from "@/lib/tagging";
import {
  buildScoreProgressionChartData,
  computeRunningScore,
  computeAverageScoreDifference,
  type ScoreProgressionPoint,
} from "@/lib/score";
import type { Tag } from "@/lib/types";
import { formatTime } from "@/lib/utils";

interface BoutScoreChartProps {
  tags: Tag[];
  range?: AnalysisRange | null;
  onRangeChange?: (range: AnalysisRange | null) => void;
  matchClockEnabled?: boolean;
  leftFencer?: string;
  rightFencer?: string;
}

export function BoutScoreChart({
  tags,
  range = null,
  onRangeChange,
  matchClockEnabled = false,
  leftFencer = "Left",
  rightFencer = "Right",
}: BoutScoreChartProps) {
  const differenceGradientId = useId();
  const [chartView, setChartView] = useState<"scores" | "difference">("scores");
  const showDifference = chartView === "difference";
  const chartData = useMemo(() => {
    const progression = buildScoreProgressionChartData(tags);
    return {
      ...progression,
      points: progression.points.map((point, index) => {
        const previousPoint = progression.points[index - 1];
        const scoringSide = previousPoint && point.pointType === "event"
          ? point.leftScore > previousPoint.leftScore ? "L" as const
            : point.rightScore > previousPoint.rightScore ? "R" as const : null
          : null;
        return {
          ...point,
          scoreDifference: point.leftScore - point.rightScore,
          scoringSide,
        };
      }),
    };
  }, [tags]);
  const averageDifference = useMemo(() => computeAverageScoreDifference(tags), [tags]);

  const events = useMemo(() => computeRunningScore(tags), [tags]);
  const dragStart = useRef<number | null>(null);
  const selectedStart = range ? chartData.points.find((point) => point.tag?.id === range.startId) : undefined;
  const selectedEnd = range ? chartData.points.find((point) => point.tag?.id === range.endId) : undefined;

  function selectThroughPoint(index: number) {
    if (dragStart.current === null || !onRangeChange) return;
    const startIndex = Math.min(dragStart.current, index);
    const endIndex = Math.max(dragStart.current, index);
    onRangeChange({ startId: events[startIndex].tag.id, endId: events[endIndex].tag.id });
  }

  function eventIndexFromTooltip(index: string | number | null | undefined): number | null {
    if (index == null || !events.length) return null;
    const point = chartData.points[Number(index)];
    if (!point) return null;
    if (point.pointType === "start") return 0;
    return (point.eventIndex ?? 1) - 1;
  }

  const chartConfig = {
    leftScore: {
      label: leftFencer,
      color: "var(--side-left)",
    },
    rightScore: {
      label: rightFencer,
      color: "var(--side-right)",
    },
    scoreDifference: {
      label: "Net touch difference",
      color: "var(--chart-5)",
    },
  } satisfies ChartConfig;

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

  const lastPoint = chartData.points[chartData.points.length - 1];
  const timeTickStep = chartData.domainMax > 360 ? 120 : chartData.domainMax > 180 ? 60 : 30;
  const timeTicks = [
    ...Array.from({ length: Math.ceil(chartData.domainMax / timeTickStep) }, (_, index) => index * timeTickStep)
      .filter((value) => value === 0 || chartData.breaks.some((periodBreak) => periodBreak.x === value) || chartData.domainMax - value >= timeTickStep / 3),
    chartData.domainMax,
  ];

  const maxDifference = Math.max(1, ...chartData.points.map((point) => Math.abs(point.scoreDifference)));

  const maxScore = Math.max(1, ...chartData.points.map((point) => Math.max(point.leftScore, point.rightScore)));
  const differences = chartData.points.map((point) => point.scoreDifference);
  const highestDifference = Math.max(...differences);
  const lowestDifference = Math.min(...differences);
  const differenceSpan = highestDifference - lowestDifference;
  const zeroGradientOffset = differenceSpan === 0 ? 0.5 : highestDifference / differenceSpan;
  const gridValues = showDifference
    ? Array.from({ length: maxDifference * 2 + 1 }, (_, index) => index - maxDifference)
    : Array.from({ length: maxScore + 1 }, (_, index) => index);

  const differenceTicks = Array.from(
    new Set([
      -maxDifference,
      ...Array.from({ length: maxDifference * 2 + 1 }, (_, index) => index - maxDifference)
        .filter((difference) => difference === 0 || (difference % 5 === 0 && Math.abs(difference) <= maxDifference - 2)),
      maxDifference,
    ]),
  ).sort((left, right) => left - right);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Score Progression</p>
          <p className="text-xs text-muted-foreground">
            {chartData.xMode === "time"
              ? "X-axis uses match period and clock. Dashed markers show breaks between periods."
              : "Match timing is missing or inconsistent, so both views use scoring order."}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Average score difference</p>
          <p className="text-xl font-medium tabular-nums">
            {averageDifference === null ? "—" : formatSignedDifference(averageDifference, 1)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">touches</span>
          </p>
          <p className="text-xs text-muted-foreground">Left − Right · after each scoring event</p>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={chartView}
          onValueChange={(value) => {
            if (value === "scores" || value === "difference") setChartView(value);
          }}
          variant="outline"
          size="sm"
          aria-label="Score chart view"
        >
          <ToggleGroupItem value="scores">Scores</ToggleGroupItem>
          <ToggleGroupItem value="difference">Difference</ToggleGroupItem>
        </ToggleGroup>
        {showDifference ? (
          <p className="text-xs text-muted-foreground">
            <span className="text-side-left">+ {leftFencer} (left)</span>
            <span className="mx-2">· 0 tied ·</span>
            <span className="text-side-right">− {rightFencer} (right)</span>
          </p>
        ) : null}
      </div>
      {showDifference ? (
        <p className="mb-2 text-xs text-muted-foreground">Line color shows who leads. Dots show who scored: red for {leftFencer} (left), green for {rightFencer} (right).</p>
      ) : null}
      <ChartContainer config={chartConfig} className="h-[280px] w-full select-none">
        <LineChart
          data={chartData.points}
          accessibilityLayer
          onMouseDown={(state, event) => {
            if (!onRangeChange || event.button !== 0) return;
            const index = eventIndexFromTooltip(state.activeTooltipIndex);
            if (index === null) return;
            event.preventDefault();
            dragStart.current = index;
            selectThroughPoint(index);
          }}
          onMouseMove={(state, event) => {
            if (event.buttons !== 1) { dragStart.current = null; return; }
            const index = eventIndexFromTooltip(state.activeTooltipIndex);
            if (index !== null) selectThroughPoint(index);
          }}
          onMouseUp={() => { dragStart.current = null; }}
          onMouseLeave={() => { dragStart.current = null; }}
          margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id={differenceGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={zeroGradientOffset} stopColor="var(--color-leftScore)" />
              <stop offset={zeroGradientOffset} stopColor="var(--color-rightScore)" />
            </linearGradient>
          </defs>
          {gridValues.map((difference) => (
            <ReferenceLine
              key={`difference-${difference}`}
              y={difference}
              stroke={showDifference && difference === 0 ? "var(--muted-foreground)" : "var(--border)"}
              strokeOpacity={difference % 5 === 0 ? 1 : 0.4}
              strokeDasharray={showDifference && difference === 0 ? "4 4" : undefined}
            />
          ))}
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, chartData.domainMax]}
            allowDataOverflow
            padding={{ left: 5, right: 5 }}
            ticks={chartData.xMode === "time" ? timeTicks : undefined}
            interval="preserveStartEnd"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) =>
              formatAxisTick(value, chartData.xMode, chartData.domainMax, lastPoint.matchPeriod)
            }
          />
          <YAxis
            allowDecimals={false}
            domain={showDifference ? [-maxDifference, maxDifference] : [0, maxScore]}
            ticks={showDifference ? differenceTicks : Array.from({ length: Math.floor(maxScore / 5) + 1 }, (_, index) => index * 5)}
            tickFormatter={showDifference ? (value) => formatSignedDifference(value) : undefined}
            interval={0}
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
          {selectedStart && selectedEnd ? (
            selectedStart.x === selectedEnd.x ? (
              <ReferenceLine x={selectedStart.x} stroke="var(--primary)" strokeWidth={4} />
            ) : (
              <ReferenceArea
                x1={selectedStart.x}
                x2={selectedEnd.x}
                fill="var(--primary)"
                fillOpacity={0.12}
                stroke="var(--primary)"
                strokeOpacity={0.5}
              />
            )
          ) : null}
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
          {!showDifference ? <ChartLegend content={<ChartLegendContent />} /> : null}
          {(showDifference ? ["scoreDifference"] : ["leftScore", "rightScore"]).map((dataKey) => (
            <Line
              key={dataKey}
              type="stepAfter"
              dataKey={dataKey}
              stroke={dataKey === "scoreDifference"
                ? differenceSpan === 0 ? "var(--muted-foreground)" : `url(#${differenceGradientId})`
                : `var(--color-${dataKey})`}
              strokeWidth={2.5}
              dot={showDifference ? <ScoringEventDot /> : false}
              activeDot={showDifference ? <ScoringEventDot radius={5} /> : { r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
      {onRangeChange ? (
        <AnalysisRangeControls events={events} range={range} onRangeChange={onRangeChange} />
      ) : null}
    </div>
  );
}

interface ScoringEventDotProps {
  cx?: number;
  cy?: number;
  radius?: number;
  payload?: ScoreProgressionPoint & { scoringSide: "L" | "R" | null };
}

function ScoringEventDot({ cx, cy, radius = 3.5, payload }: ScoringEventDotProps) {
  if (cx == null || cy == null || !payload?.scoringSide) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={payload.scoringSide === "L" ? "var(--color-leftScore)" : "var(--color-rightScore)"}
      stroke="var(--background)"
      strokeWidth={1.5}
      data-scoring-side={payload.scoringSide}
    />
  );
}

function formatAxisTick(
  value: number,
  xMode: "event" | "time",
  domainMax: number,
  lastPeriod?: Tag["matchPeriod"],
): string {
  if (xMode === "time") {
    const segment = value === domainMax && lastPeriod
      ? MATCH_PERIOD_SEGMENTS[lastPeriod]
      : Object.values(MATCH_PERIOD_SEGMENTS).findLast((period) => period.start <= value)
        ?? MATCH_PERIOD_SEGMENTS["1"];
    const remainingSeconds = Math.max(0, segment.duration - (value - segment.start));
    return `${segment.label} ${formatTime(remainingSeconds)}`;
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
      <p className="text-muted-foreground">
        Difference (Left − Right): <span className="font-mono tabular-nums text-foreground">{formatSignedDifference(point.leftScore - point.rightScore)}</span>
      </p>
    </div>
  );
}

function formatSignedDifference(value: number, decimals = 0): string {
  const roundedValue = Number(value.toFixed(decimals));
  return `${roundedValue > 0 ? "+" : ""}${roundedValue.toFixed(decimals)}`;
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
