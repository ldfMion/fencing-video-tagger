"use client";

import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAutoTagReport } from "@/hooks/use-auto-tag-job";
import type { AutoTagEvaluationResult } from "@/lib/auto-tag/evaluation";

interface AutoTagReportProps {
  jobId: string;
}

interface ReportRow {
  label: string;
  value: string;
}

export function AutoTagReport({ jobId }: AutoTagReportProps) {
  const reportQuery = useAutoTagReport(jobId, true);

  if (reportQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Scoring the agent&apos;s tags...
      </div>
    );
  }
  if (reportQuery.error || !reportQuery.data) {
    return <p className="text-xs text-destructive">Could not build the report.</p>;
  }

  const { evaluation } = reportQuery.data;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {evaluation.mode === "benchmark"
          ? "Compared with the original hand-tagged bout."
          : "Compared with this bout's tags as you have corrected them."}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Measure</TableHead>
            <TableHead className="text-right">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buildReportRows(evaluation).map((row) => (
            <TableRow key={row.label}>
              <TableCell className="text-xs">{row.label}</TableCell>
              <TableCell className="text-right font-mono text-xs">{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function buildReportRows(evaluation: AutoTagEvaluationResult): ReportRow[] {
  const { counts } = evaluation;
  const rows: ReportRow[] = [
    { label: "Touches found", value: `${counts.matched} of ${counts.referenceTouches}` },
    { label: "Precision", value: formatShare(evaluation.precision) },
    { label: "Recall", value: formatShare(evaluation.recall) },
    { label: "Extra touches", value: String(counts.extras) },
    { label: "Missed touches", value: String(counts.misses) },
  ];
  if (evaluation.mode === "review") {
    rows.push({ label: "Replaced by you", value: String(counts.replacements) });
  }
  rows.push(
    { label: "Median time error", value: formatSeconds(evaluation.timing.medianAbsoluteErrorSeconds) },
    { label: "Within 0.5s", value: formatShare(evaluation.timing.shareWithinHalfSecond) },
    { label: "Side correct", value: formatShare(evaluation.side.share) },
    { label: "Action exact", value: formatShare(evaluation.action.exactShare) },
    { label: "Offense/defense correct", value: formatShare(evaluation.action.intentShare) },
  );
  if (evaluation.matchClock) {
    rows.push({ label: "Match clock exact", value: formatShare(evaluation.matchClock.exactShare) });
  }
  if (evaluation.stripZone) {
    rows.push(
      { label: "Strip zone exact", value: formatShare(evaluation.stripZone.exactShare) },
      { label: "Strip zone within one", value: formatShare(evaluation.stripZone.withinOneZoneShare) },
    );
  }
  rows.push({
    label: "Final score (agent / reference)",
    value: `${formatScore(evaluation.score.agent)} / ${formatScore(evaluation.score.reference)}`,
  });
  return rows;
}

function formatShare(share: number | null): string {
  return share === null ? "–" : `${Math.round(share * 100)}%`;
}

function formatSeconds(seconds: number | null): string {
  return seconds === null ? "–" : `${seconds.toFixed(2)}s`;
}

function formatScore(score: { left: number; right: number }): string {
  return `${score.left}–${score.right}`;
}
