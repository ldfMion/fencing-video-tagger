"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TacticalIntent } from "@/lib/action-classifications";
import type { StatRow } from "@/lib/stats";
import { cn } from "@/lib/utils";
import styles from "./tactical-outcomes-chart.module.css";

const outcomes = [
  { key: "scored", label: "Scored", color: "var(--chart-2)" },
  { key: "received", label: "Received", color: "var(--chart-5)" },
] as const;

function formatShare(count: number, total: number) {
  return total > 0 ? `${Math.round(count / total * 100)}%` : "—";
}

function MosaicCell({ label, count, roleLabel, roleTotal, outcomeTotal, color }: {
  label: string;
  count: number;
  roleLabel: string;
  roleTotal: number;
  outcomeTotal: number;
  color: string;
}) {
  if (count === 0) return null;

  const roleShare = `${formatShare(count, roleTotal)} of ${roleLabel.toLowerCase()}`;
  const outcomeShare = `${formatShare(count, outcomeTotal)} of all ${label.toLowerCase()}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="img"
          tabIndex={0}
          aria-label={`${roleLabel}, ${label.toLowerCase()}: ${count} touches, ${roleShare}, ${outcomeShare}`}
          className={cn(styles.cell, "relative w-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring")}
          style={{
            height: `${count / roleTotal * 100}%`,
            background: `color-mix(in srgb, ${color} 26%, var(--card))`,
          }}
        >
          <div aria-hidden="true" className={cn(styles.count, "absolute inset-0 items-center justify-center text-xs tabular-nums")}>{count}</div>
          <div aria-hidden="true" className={cn(styles.details, "absolute inset-0 flex-col justify-center p-3")}>
            <span className="text-xs font-medium">{label}</span>
            <span className="mb-2 text-lg font-semibold tabular-nums">{count}</span>
            <span className="text-xs">{roleShare}</span>
            <span className="text-xs">{outcomeShare}</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          <span>{roleLabel} · {label} · {count} touches</span>
          <span>{roleShare}</span>
          <span>{outcomeShare}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function TacticalOutcomesChart({ tacticalStats }: { tacticalStats: StatRow<TacticalIntent>[] }) {
  const roles = [
    { category: "offense", label: "Offense" },
    { category: "defense", label: "Defense" },
  ].map(({ category, label }) => {
    const row = tacticalStats.find((stat) => stat.category === category);
    const scored = row?.hitsFor ?? 0;
    const received = row?.hitsAgainst ?? 0;
    return { label, scored, received, total: scored + received };
  });
  const totalTouches = roles.reduce((total, role) => total + role.total, 0);
  const totals = {
    scored: roles.reduce((total, role) => total + role.scored, 0),
    received: roles.reduce((total, role) => total + role.received, 0),
  };

  return (
    <TooltipProvider>
    <Card>
      <CardHeader>
        <CardTitle>Tactical Outcomes</CardTitle>
        <CardDescription>Scored and received touches within offense and defense</CardDescription>
      </CardHeader>
      <CardContent>
        {totalTouches === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No tagged scoring exchanges</p>
        ) : (
          <figure className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {roles.map((role) => (
                <div key={role.label}>
                  <p className="font-medium">{role.label}</p>
                  <p className="text-xs text-muted-foreground">{role.total} touches · {formatShare(role.total, totalTouches)} of all</p>
                </div>
              ))}
            </div>
            <div className="flex h-[320px] w-full" aria-label="Touch counts by tactical role and outcome">
              {roles.filter((role) => role.total > 0).map((role) => (
                <div key={role.label} className="h-full min-w-0" style={{ width: `${role.total / totalTouches * 100}%` }}>
                  {outcomes.map((outcome) => (
                    <MosaicCell key={outcome.key} label={outcome.label} count={role[outcome.key]} roleLabel={role.label} roleTotal={role.total} outcomeTotal={totals[outcome.key]} color={outcome.color} />
                  ))}
                </div>
              ))}
            </div>
            <figcaption className="flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-4">
                {outcomes.map((outcome) => (
                  <span key={outcome.key} className="inline-flex items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-sm" style={{ background: outcome.color }} />
                    {outcome.label} · {totals[outcome.key]}
                  </span>
                ))}
              </div>
              <p>Width = role volume · Height = outcome share · Area = touches</p>
              <p>{totalTouches} tagged scoring exchanges. Hover or focus a cell for details.</p>
            </figcaption>
          </figure>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
