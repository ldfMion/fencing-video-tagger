"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, HeartPulse, Loader2, RefreshCw } from "lucide-react";
import {
  HEART_RATE_ZONES,
  getHeartRateZoneColor,
  type HeartRateData,
  type HeartRateSample,
} from "@/lib/heart-rate";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HeartRateCardProps {
  canMatch: boolean;
  currentTime: number;
  data: HeartRateData | null;
  error: string | null;
  isMatching: boolean;
  onMatch: () => void;
  onSeek?: (timestamp: number) => void;
}

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 92;
const MIN_BPM = 45;

export function HeartRateCard({
  canMatch,
  currentTime,
  data,
  error,
  isMatching,
  onMatch,
  onSeek,
}: HeartRateCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const currentSample = useMemo(
    () => data ? findClosestSample(data.samples, currentTime) : null,
    [currentTime, data],
  );
  const average = data?.samples.length
    ? Math.round(data.samples.reduce((total, sample) => total + sample.bpm, 0) / data.samples.length)
    : null;
  const peak = data?.samples.length
    ? Math.round(Math.max(...data.samples.map((sample) => sample.bpm)))
    : null;

  return (
    <Card size="sm" className="shrink-0 gap-2 py-2">
      <CardHeader className="grid-cols-[1fr_auto] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <HeartPulse className="h-4 w-4 shrink-0 text-red-500" />
          <CardTitle className="text-xs">Heart rate</CardTitle>
          {currentSample ? (
            <span className="font-mono text-sm font-semibold tabular-nums">
              {Math.round(currentSample.bpm)} bpm
            </span>
          ) : null}
          {average != null && peak != null ? (
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              Avg {average} · Peak {peak} · {data?.samples.length} samples
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant={data ? "ghost" : "outline"}
            disabled={!canMatch || isMatching}
            onClick={onMatch}
            title={canMatch ? "Extract heart rate from export.xml" : "Attach a library video first"}
          >
            {isMatching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : data ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <HeartPulse className="h-3.5 w-3.5" />
            )}
            {isMatching ? "Scanning export…" : data ? "Rematch" : "Match from Apple Health"}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            aria-label={isExpanded ? "Hide heart rate chart" : "Show heart rate chart"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded ? <CardContent className="px-3">
        {data ? (
          <HeartRateChart
            currentTime={currentTime}
            data={data}
            onSeek={onSeek}
          />
        ) : (
          <p className="py-2 text-[11px] text-muted-foreground">
            Match the attached video&apos;s capture time with heart-rate samples in export.xml.
          </p>
        )}
        {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
      </CardContent> : null}
    </Card>
  );
}

function HeartRateChart({
  currentTime,
  data,
  onSeek,
}: {
  currentTime: number;
  data: HeartRateData;
  onSeek?: (timestamp: number) => void;
}) {
  const highestBpm = Math.max(data.maxHeartRate, ...data.samples.map((sample) => sample.bpm));
  const maximumBpm = Math.ceil((highestBpm + 5) / 10) * 10;
  const x = (timestamp: number) => (timestamp / data.videoDuration) * CHART_WIDTH;
  const y = (bpm: number) =>
    CHART_HEIGHT - ((bpm - MIN_BPM) / (maximumBpm - MIN_BPM)) * CHART_HEIGHT;
  const markerX = x(Math.max(0, Math.min(currentTime, data.videoDuration)));

  const handleChartClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onSeek(((event.clientX - bounds.left) / bounds.width) * data.videoDuration);
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[76px] w-full cursor-pointer overflow-visible rounded-sm"
        role="img"
        aria-label="Heart rate over the duration of the video. Click to seek."
        onClick={handleChartClick}
      >
        {HEART_RATE_ZONES.map((zone) => {
          const low = Math.max(MIN_BPM, zone.minimum * data.maxHeartRate);
          const high = Math.min(maximumBpm, zone.maximum * data.maxHeartRate);
          if (high <= low) return null;
          return (
            <rect
              key={zone.id}
              x="0"
              y={y(high)}
              width={CHART_WIDTH}
              height={Math.max(0, y(low) - y(high))}
              fill={zone.color}
              opacity="0.08"
            />
          );
        })}
        {data.samples.slice(1).map((sample, index) => {
          const previous = data.samples[index];
          if (sample.timestamp - previous.timestamp > 30) return null;
          return (
            <line
              key={`${sample.recordedAt}-${index}`}
              x1={x(previous.timestamp)}
              y1={y(previous.bpm)}
              x2={x(sample.timestamp)}
              y2={y(sample.bpm)}
              stroke={getHeartRateZoneColor(sample.zone)}
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {data.samples.map((sample) => (
          <circle
            key={sample.recordedAt}
            cx={x(sample.timestamp)}
            cy={y(sample.bpm)}
            r="2.2"
            fill={getHeartRateZoneColor(sample.zone)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={markerX}
          x2={markerX}
          y1="0"
          y2={CHART_HEIGHT}
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-foreground"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>0:00</span>
        <div className="flex gap-2">
          {HEART_RATE_ZONES.map((zone) => (
            <span key={zone.id} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: zone.color }} />
              Z{zone.id.at(-1)}
            </span>
          ))}
        </div>
        <span>{formatTime(data.videoDuration)}</span>
      </div>
    </div>
  );
}

function findClosestSample(
  samples: HeartRateSample[],
  timestamp: number,
): HeartRateSample | null {
  if (samples.length === 0) return null;
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].timestamp < timestamp) low = middle + 1;
    else high = middle;
  }
  const after = samples[low];
  const before = samples[Math.max(0, low - 1)];
  const closest = Math.abs(after.timestamp - timestamp) < Math.abs(before.timestamp - timestamp)
    ? after
    : before;
  return Math.abs(closest.timestamp - timestamp) <= 30 ? closest : null;
}
