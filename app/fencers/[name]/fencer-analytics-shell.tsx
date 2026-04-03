"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Swords, X } from "lucide-react";
import { FencerCharts } from "@/components/fencer-charts";
import { StatsTable } from "@/components/stats-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessions } from "@/hooks/use-sessions";
import { deriveFencerPageViewModel } from "@/lib/fencer-stats";
import { SIDE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface FencerAnalyticsShellProps {
  fencerName: string;
}

export function FencerAnalyticsShell({
  fencerName,
}: FencerAnalyticsShellProps) {
  const { sessions } = useSessions();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);
  const [opponentSearch, setOpponentSearch] = useState("");

  const viewModel = useMemo(
    () =>
      deriveFencerPageViewModel(sessions, fencerName, {
        dateFrom,
        dateTo,
        selectedOpponents,
      }),
    [dateFrom, dateTo, fencerName, selectedOpponents, sessions],
  );

  const hasFilters = Boolean(dateFrom || dateTo || selectedOpponents.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Swords className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">{fencerName}</h1>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card className="gap-2 py-4">
            <CardHeader className="px-4 pb-0">
              <CardDescription>Bouts</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <CardTitle className="text-2xl">
                {viewModel.filteredSessions.length}
              </CardTitle>
            </CardContent>
          </Card>
          <Card className="gap-2 py-4">
            <CardHeader className="px-4 pb-0">
              <CardDescription>Record</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <CardTitle className="text-2xl tabular-nums">
                {viewModel.record.wins}W - {viewModel.record.losses}L
              </CardTitle>
            </CardContent>
          </Card>
          <Card className="gap-2 py-4">
            <CardHeader className="px-4 pb-0">
              <CardDescription>Win Rate</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <CardTitle className="text-2xl tabular-nums">
                {viewModel.record.winRate != null
                  ? `${viewModel.record.winRate}%`
                  : "—"}
              </CardTitle>
              {viewModel.record.dateRangeLabel ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {viewModel.record.dateRangeLabel}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
          {viewModel.uniqueOpponents.length > 1 ? (
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
              <PopoverContent className="w-48 p-1" align="start">
                <Input
                  placeholder="Search..."
                  value={opponentSearch}
                  onChange={(event) => setOpponentSearch(event.target.value)}
                  className="mb-1 h-8 text-sm"
                />
                <div className="max-h-[250px] overflow-y-auto">
                  {viewModel.uniqueOpponents
                    .filter((name) =>
                      name.toLowerCase().includes(opponentSearch.toLowerCase()),
                    )
                    .map((name) => {
                      const selected = selectedOpponents.includes(name);

                      return (
                        <button
                          key={name}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() =>
                            setSelectedOpponents((previousOpponents) =>
                              selected
                                ? previousOpponents.filter(
                                    (opponent) => opponent !== name,
                                  )
                                : [...previousOpponents, name],
                            )
                          }
                        >
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              selected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {name}
                        </button>
                      );
                    })}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {hasFilters ? (
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
          ) : null}
        </div>

        <Tabs defaultValue="statistics">
          <TabsList className="mb-4">
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
            <TabsTrigger value="bouts">
              Bouts
              {viewModel.filteredSessions.length > 0 ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({viewModel.filteredSessions.length})
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="comments">
              Comments
              {viewModel.commentFeedItems.length > 0 ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({viewModel.commentFeedItems.length})
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="statistics">
            {!viewModel.hasStatsData ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scoring events yet.
              </p>
            ) : (
              <>
                <FencerCharts
                  tacticalStats={viewModel.tacticalStats}
                  defMatchupStats={viewModel.defMatchupStats}
                />
                <div className="space-y-4">
                  <StatsTable rows={viewModel.tacticalStats} />
                  <StatsTable rows={viewModel.defMatchupStats} />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="bouts">
            {viewModel.boutRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No bouts.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Opponent</th>
                      <th className="w-[100px] px-3 py-2 text-center font-medium">
                        Score
                      </th>
                      <th className="w-[120px] px-3 py-2 text-right font-medium">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.boutRows.map((row) => (
                      <tr
                        key={row.sessionId}
                        className="border-b transition-colors last:border-b-0 hover:bg-muted"
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={`/bouts/${row.sessionId}`}
                            className="font-medium hover:underline"
                          >
                            {row.opponent}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          {row.hasScore ? (
                            <>
                              <span className={row.fencerWins ? "font-bold" : ""}>
                                {row.fencerScore}
                              </span>
                              <span className="mx-1 text-muted-foreground">-</span>
                              <span
                                className={
                                  !row.fencerWins && row.opponentScore > row.fencerScore
                                    ? "font-bold"
                                    : ""
                                }
                              >
                                {row.opponentScore}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          {row.displayDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments">
            {viewModel.commentFeedItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No comments yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                {viewModel.commentFeedItems.map((item, index) => (
                  <div
                    key={`${item.boutId}-${index}`}
                    className="flex items-start gap-3 border-b px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/50"
                  >
                    <div className="shrink-0 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        {item.side ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-1.5 py-0 text-xs",
                              item.side === "L"
                                ? SIDE_COLORS.left.badge
                                : SIDE_COLORS.right.badge,
                            )}
                          >
                            {item.side === "L" ? "Scored" : "Received"}
                          </Badge>
                        ) : null}
                        {item.action ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {item.action}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="flex-1 text-foreground">{item.comment}</span>
                    <Link
                      href={`/bouts/${item.boutId}`}
                      className="shrink-0 text-right text-xs text-muted-foreground hover:underline"
                    >
                      vs {item.boutOpponent}
                      {item.boutDateLabel ? (
                        <>
                          <br />
                          {item.boutDateLabel}
                        </>
                      ) : null}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
