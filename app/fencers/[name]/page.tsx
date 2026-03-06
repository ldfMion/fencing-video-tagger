"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Swords, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatsTable } from "@/components/stats-table";
import { useSessions } from "@/hooks/use-sessions";
import { getSessionsForFencer, normalizeTagsForFencer } from "@/lib/fencer-stats";
import { computeScore } from "@/lib/score";
import { computeTacticalStats, computeDefMatchupStats } from "@/lib/stats";
import { SIDE_COLORS } from "@/lib/constants";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FencerPage() {
  const params = useParams<{ name: string }>();
  const fencerName = decodeURIComponent(params.name);
  const { sessions } = useSessions();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);
  const [opponentSearch, setOpponentSearch] = useState("");

  const fencerSessions = useMemo(
    () => getSessionsForFencer(sessions, fencerName),
    [sessions, fencerName],
  );

  const uniqueOpponents = useMemo(() => {
    const names = new Set<string>();
    for (const s of fencerSessions) {
      const isLeft = s.leftFencer?.toLowerCase() === fencerName.toLowerCase();
      const opponent = isLeft ? s.rightFencer : s.leftFencer;
      if (opponent) names.add(opponent);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [fencerSessions, fencerName]);

  const filteredSessions = useMemo(() => {
    let result = fencerSessions;
    if (dateFrom) {
      result = result.filter((s) => s.boutDate && s.boutDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((s) => s.boutDate && s.boutDate <= dateTo);
    }
    if (selectedOpponents.length > 0) {
      result = result.filter((s) => {
        const isLeft = s.leftFencer?.toLowerCase() === fencerName.toLowerCase();
        const opponent = isLeft ? s.rightFencer : s.leftFencer;
        return opponent != null && selectedOpponents.includes(opponent);
      });
    }
    return result;
  }, [fencerSessions, dateFrom, dateTo, selectedOpponents, fencerName]);

  const normalizedTags = useMemo(
    () => normalizeTagsForFencer(filteredSessions, fencerName),
    [filteredSessions, fencerName],
  );

  const tacticalStats = useMemo(
    () => computeTacticalStats(normalizedTags, "L"),
    [normalizedTags],
  );

  const defMatchupStats = useMemo(
    () => computeDefMatchupStats(normalizedTags, "L"),
    [normalizedTags],
  );

  const allRows = [...tacticalStats, ...defMatchupStats];
  const hasStatsData = allRows.some((r) => r.hitsFor > 0 || r.hitsAgainst > 0);

  const { wins, losses, dateRange } = useMemo(() => {
    let w = 0;
    let l = 0;
    let earliest: string | undefined;
    let latest: string | undefined;

    for (const session of filteredSessions) {
      const score = computeScore(session.tags);
      const isLeft = session.leftFencer?.toLowerCase() === fencerName.toLowerCase();
      const fencerScore = isLeft ? score.left : score.right;
      const opponentScore = isLeft ? score.right : score.left;

      if (fencerScore > opponentScore) w++;
      else if (opponentScore > fencerScore) l++;

      if (session.boutDate) {
        if (!earliest || session.boutDate < earliest) earliest = session.boutDate;
        if (!latest || session.boutDate > latest) latest = session.boutDate;
      }
    }

    return {
      wins: w,
      losses: l,
      dateRange: earliest && latest ? { from: earliest, to: latest } : null,
    };
  }, [filteredSessions, fencerName]);

  const hasFilters = dateFrom || dateTo || selectedOpponents.length > 0;

  const sortedBouts = useMemo(
    () =>
      [...filteredSessions].sort((a, b) => {
        if (a.boutDate && b.boutDate) return b.boutDate.localeCompare(a.boutDate);
        return b.lastModified - a.lastModified;
      }),
    [filteredSessions],
  );

  const commentedTags = useMemo(() => {
    const result: {
      comment: string;
      side?: string;
      action?: string;
      boutId: string;
      boutOpponent: string;
      boutDate?: string;
    }[] = [];

    for (const session of filteredSessions) {
      const isLeft = session.leftFencer?.toLowerCase() === fencerName.toLowerCase();
      const opponent = isLeft ? session.rightFencer ?? "?" : session.leftFencer ?? "?";

      for (const tag of session.tags) {
        if (!tag.comment?.trim()) continue;

        // Normalize side so fencer is always "L"
        let normalizedSide = tag.side;
        if (!isLeft && normalizedSide === "L") normalizedSide = "R";
        else if (!isLeft && normalizedSide === "R") normalizedSide = "L";

        result.push({
          comment: tag.comment.trim(),
          side: normalizedSide,
          action: tag.action,
          boutId: session.id,
          boutOpponent: opponent,
          boutDate: session.boutDate,
        });
      }
    }

    return result;
  }, [filteredSessions, fencerName]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Swords className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">{fencerName}</h1>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          <div>
            <span className="text-muted-foreground">Bouts:</span>{" "}
            <span className="font-medium">{filteredSessions.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Record:</span>{" "}
            <span className="font-medium">
              {wins}W - {losses}L
            </span>
          </div>
          {dateRange && (
            <div>
              <span className="text-muted-foreground">Range:</span>{" "}
              <span className="font-medium">
                {new Date(dateRange.from).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" \u2013 "}
                {new Date(dateRange.to).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 items-center mb-6">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
          {uniqueOpponents.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-1.5 text-sm font-normal">
                  {selectedOpponents.length === 0
                    ? "All opponents"
                    : selectedOpponents.length === 1
                      ? selectedOpponents[0]
                      : `${selectedOpponents.length} opponents`}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-1 w-48" align="start">
                <Input
                  placeholder="Search..."
                  value={opponentSearch}
                  onChange={(e) => setOpponentSearch(e.target.value)}
                  className="h-8 mb-1 text-sm"
                />
                <div className="max-h-[250px] overflow-y-auto">
                  {uniqueOpponents
                    .filter((name) =>
                      name.toLowerCase().includes(opponentSearch.toLowerCase())
                    )
                    .map((name) => {
                      const selected = selectedOpponents.includes(name);
                      return (
                        <button
                          key={name}
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                          onClick={() =>
                            setSelectedOpponents((prev) =>
                              selected ? prev.filter((n) => n !== name) : [...prev, name]
                            )
                          }
                        >
                          <Check className={cn("h-3.5 w-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                          {name}
                        </button>
                      );
                    })}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSelectedOpponents([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Stats tables */}
        {!hasStatsData ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scoring events yet.
          </p>
        ) : (
          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-medium">Statistics</h3>
            <StatsTable rows={tacticalStats} />
            <StatsTable rows={defMatchupStats} />
          </div>
        )}

        {/* Bout list */}
        {sortedBouts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium mb-3">Bouts</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground text-xs">
                    <th className="text-left font-medium py-2 px-3">Opponent</th>
                    <th className="text-center font-medium py-2 px-3 w-[100px]">Score</th>
                    <th className="text-right font-medium py-2 px-3 w-[120px]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBouts.map((session) => {
                    const isLeft =
                      session.leftFencer?.toLowerCase() === fencerName.toLowerCase();
                    const opponent = isLeft
                      ? session.rightFencer ?? "?"
                      : session.leftFencer ?? "?";
                    const score = computeScore(session.tags);
                    const fencerScore = isLeft ? score.left : score.right;
                    const opponentScore = isLeft ? score.right : score.left;
                    const hasScore = session.tags.some((t) => t.side && t.action);
                    const fencerWins = fencerScore > opponentScore;

                    return (
                      <tr
                        key={session.id}
                        className="border-b last:border-b-0 hover:bg-muted transition-colors"
                      >
                        <td className="py-2 px-3">
                          <Link
                            href={`/bouts/${session.id}`}
                            className="hover:underline font-medium"
                          >
                            {opponent}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-center tabular-nums">
                          {hasScore ? (
                            <>
                              <span className={fencerWins ? "font-bold" : ""}>
                                {fencerScore}
                              </span>
                              <span className="text-muted-foreground mx-1">-</span>
                              <span className={!fencerWins && opponentScore > fencerScore ? "font-bold" : ""}>
                                {opponentScore}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground text-xs">
                          {session.boutDate
                            ? new Date(session.boutDate).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : new Date(session.lastModified).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Comments section */}
        {commentedTags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Comments</h3>
            <div className="rounded-lg border overflow-hidden">
              {commentedTags.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-3 py-2.5 border-b last:border-b-0 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    {item.side && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs px-1.5 py-0",
                          item.side === "L"
                            ? SIDE_COLORS.left.badge
                            : SIDE_COLORS.right.badge,
                        )}
                      >
                        {item.side === "L" ? "Scored" : "Received"}
                      </Badge>
                    )}
                    {item.action && (
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {item.action}
                      </span>
                    )}
                  </div>
                  <span className="flex-1 text-foreground">{item.comment}</span>
                  <Link
                    href={`/bouts/${item.boutId}`}
                    className="shrink-0 text-xs text-muted-foreground hover:underline text-right"
                  >
                    vs {item.boutOpponent}
                    {item.boutDate && (
                      <>
                        <br />
                        {new Date(item.boutDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
