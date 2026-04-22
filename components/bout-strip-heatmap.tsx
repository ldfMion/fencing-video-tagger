"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SIDE_COLORS } from "@/lib/constants";
import { computeStripZoneStats, type StripZoneStat } from "@/lib/stats";
import { STRIP_ZONE_FLEX_WEIGHTS } from "@/lib/tagging";
import type { Tag } from "@/lib/types";
import { STRIP_ZONES } from "@/lib/types";
import { cn } from "@/lib/utils";

type StripHeatmapTab = "net" | "L" | "R";

interface BoutStripHeatmapProps {
  tags: Tag[];
  leftFencer?: string;
  rightFencer?: string;
}

export function BoutStripHeatmap({
  tags,
  leftFencer = "Left",
  rightFencer = "Right",
}: BoutStripHeatmapProps) {
  const [activeTab, setActiveTab] = useState<StripHeatmapTab>("net");

  const summary = useMemo(() => computeStripZoneStats(tags), [tags]);

  const hasData = summary.totalScoringActions > 0;

  const description = getTabDescription(
    activeTab,
    leftFencer,
    rightFencer,
    summary.leftTotal,
    summary.rightTotal,
  );

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">Strip Location</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === "net" || value === "L" || value === "R") {
              setActiveTab(value);
            }
          }}
          className="gap-0"
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="net">Net</TabsTrigger>
            <TabsTrigger value="L" className={SIDE_COLORS.left.text}>
              {leftFencer}
            </TabsTrigger>
            <TabsTrigger value="R" className={SIDE_COLORS.right.text}>
              {rightFencer}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!hasData ? (
        <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No strip-zone scoring data yet.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Absolute strip orientation</span>
            <span>Left to right</span>
          </div>
          <div className="overflow-hidden rounded-xl border bg-background">
            <div className="flex min-h-28">
              {STRIP_ZONES.map((zone, index) => {
                const zoneStats = summary.zones.find((item) => item.zone === zone);

                if (!zoneStats) {
                  return null;
                }

                const tile = getZoneTileConfig(
                  zoneStats,
                  activeTab,
                  summary.maxLeftCount,
                  summary.maxRightCount,
                  summary.maxNetAbs,
                );

                return (
                  <div
                    key={zone}
                    style={{ flex: STRIP_ZONE_FLEX_WEIGHTS[index] }}
                    className={cn(
                      "relative flex min-w-0 items-stretch border-r border-border/80 last:border-r-0",
                      tile.containerClassName,
                    )}
                  >
                    <div
                      className="absolute inset-0 transition-colors"
                      style={{ backgroundColor: tile.backgroundColor }}
                    />
                    <div className="relative flex flex-1 flex-col justify-between gap-3 p-3">
                      <div className="space-y-1">
                        <p className={cn("text-[11px] font-medium", tile.labelClassName)}>
                          {zoneStats.label}
                        </p>
                        <p className={cn("text-2xl font-semibold tabular-nums", tile.valueClassName)}>
                          {tile.displayValue}
                        </p>
                      </div>
                      <p className={cn("text-[11px] leading-tight", tile.metaClassName)}>
                        {tile.metaLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-700/70 dark:bg-red-500/80" />
              {leftFencer}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green-700/70 dark:bg-green-500/80" />
              {rightFencer}
            </span>
            <span>{summary.totalScoringActions} scoring actions with strip zones</span>
          </div>
        </div>
      )}
    </div>
  );
}

function getTabDescription(
  activeTab: StripHeatmapTab,
  leftFencer: string,
  rightFencer: string,
  leftTotal: number,
  rightTotal: number,
): string {
  if (activeTab === "net") {
    return "Signed surplus by zone. Red favors the left-side fencer; green favors the right-side fencer.";
  }

  if (activeTab === "L") {
    return `${leftFencer} scoring actions by zone (${leftTotal} total).`;
  }

  return `${rightFencer} scoring actions by zone (${rightTotal} total).`;
}

function getZoneTileConfig(
  zoneStats: StripZoneStat,
  activeTab: StripHeatmapTab,
  maxLeftCount: number,
  maxRightCount: number,
  maxNetAbs: number,
): {
  backgroundColor: string;
  containerClassName?: string;
  labelClassName: string;
  valueClassName: string;
  metaClassName: string;
  displayValue: string;
  metaLabel: string;
} {
  if (activeTab === "net") {
    const magnitude = maxNetAbs > 0 ? Math.abs(zoneStats.net) / maxNetAbs : 0;
    const alpha = zoneStats.net === 0 ? 0 : 0.18 + (magnitude * 0.48);
    const backgroundColor =
      zoneStats.net > 0
        ? `rgb(185 28 28 / ${alpha})`
        : zoneStats.net < 0
          ? `rgb(21 128 61 / ${alpha})`
          : "rgb(148 163 184 / 0.10)";
    const emphasisClassName =
      magnitude >= 0.55
        ? "text-white"
        : zoneStats.net > 0
          ? "text-red-950 dark:text-red-50"
          : zoneStats.net < 0
            ? "text-green-950 dark:text-green-50"
            : "text-foreground";

    return {
      backgroundColor,
      labelClassName: cn("text-muted-foreground", magnitude > 0 ? emphasisClassName : ""),
      valueClassName: emphasisClassName,
      metaClassName: cn(
        magnitude >= 0.55 ? "text-white/90" : "text-muted-foreground",
      ),
      displayValue: zoneStats.net > 0 ? `+${zoneStats.net}` : `${zoneStats.net}`,
      metaLabel: `${zoneStats.leftScoreCount}-${zoneStats.rightScoreCount}`,
    };
  }

  const count = activeTab === "L" ? zoneStats.leftScoreCount : zoneStats.rightScoreCount;
  const maxCount = activeTab === "L" ? maxLeftCount : maxRightCount;
  const alpha = count === 0 || maxCount === 0 ? 0 : 0.14 + ((count / maxCount) * 0.5);
  const backgroundColor =
    activeTab === "L"
      ? `rgb(185 28 28 / ${alpha})`
      : `rgb(21 128 61 / ${alpha})`;
  const emphasisClassName =
    count > 0 && count / Math.max(maxCount, 1) >= 0.55
      ? "text-white"
      : activeTab === "L"
        ? "text-red-950 dark:text-red-50"
        : "text-green-950 dark:text-green-50";

  return {
    backgroundColor: count === 0 ? "rgb(148 163 184 / 0.08)" : backgroundColor,
    labelClassName: count === 0 ? "text-muted-foreground" : emphasisClassName,
    valueClassName: count === 0 ? "text-foreground" : emphasisClassName,
    metaClassName: count === 0 ? "text-muted-foreground" : cn(
      count / Math.max(maxCount, 1) >= 0.55 ? "text-white/90" : "text-muted-foreground",
    ),
    displayValue: `${count}`,
    metaLabel: count === 1 ? "1 action" : `${count} actions`,
  };
}
