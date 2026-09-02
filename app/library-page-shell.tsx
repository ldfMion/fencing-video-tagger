"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Swords, X } from "lucide-react";
import { AppearanceMenu } from "@/components/appearance-menu";
import { ExportMenuButton } from "@/components/export-button";
import { ImportButton } from "@/components/import-button";
import { NewBoutDialog } from "@/components/new-bout-dialog";
import { VideoLibrary } from "@/components/video-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVideoContext } from "@/contexts/video-context";
import { filterSessionsBySearchAndDate } from "@/lib/session-selectors";
import {
  useSessions,
  type SessionDraftParams,
  type SessionVideoSelection,
} from "@/hooks/use-sessions";
import type { VideoSession } from "@/lib/types";

interface LibraryPageShellProps {
  initialSessions: VideoSession[];
}

export function LibraryPageShell({ initialSessions }: LibraryPageShellProps) {
  const router = useRouter();
  const { playTemporaryVideo } = useVideoContext();
  const {
    sessions,
    createSessionEntry,
    deleteSession,
    exportAllToJson,
    exportAllToNormalizedCsvZip,
    allFencerNames,
  } = useSessions(initialSessions);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isNewBoutDialogOpen, setIsNewBoutDialogOpen] = useState(false);

  const hasFilters = Boolean(search || dateFrom || dateTo);

  const filteredSessions = useMemo(
    () =>
      filterSessionsBySearchAndDate(sessions, {
        search,
        dateFrom,
        dateTo,
      }),
    [dateFrom, dateTo, search, sessions],
  );

  const handleCreateSession = useCallback(
    async (params: SessionDraftParams, videoSelection: SessionVideoSelection) => {
      const sessionId = crypto.randomUUID();

      if (videoSelection.kind === "temporary") {
        playTemporaryVideo(sessionId, videoSelection.file);
      }

      router.push(`/bouts/${sessionId}`);

      try {
        const session = await createSessionEntry(params, videoSelection, {
          sessionId,
        });

        if (session.id !== sessionId) {
          router.replace(`/bouts/${session.id}`);
        }

        return session;
      } catch (error) {
        router.replace("/");
        throw error;
      }
    },
    [createSessionEntry, playTemporaryVideo, router],
  );

  return (
    <div className="app-canvas min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-8">
        <header className="library-header mb-8 flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark"><Swords className="h-4 w-4" /></span>
            <div>
              <span className="block text-sm font-semibold tracking-tight">Piste</span>
              <span className="block text-[10px] text-muted-foreground">Bout library · {sessions.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AppearanceMenu compact />
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href="/search">
                <Search className="mr-2 h-4 w-4" />
                Touch search
              </Link>
            </Button>
            <ImportButton />
            <ExportMenuButton
              exportAllToJson={exportAllToJson}
              exportAllToNormalizedCsvZip={exportAllToNormalizedCsvZip}
              disabled={sessions.length === 0}
            />
            <Button className="new-bout-action" onClick={() => setIsNewBoutDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Bout
            </Button>
          </div>

          <NewBoutDialog
            isOpen={isNewBoutDialogOpen}
            onOpenChange={setIsNewBoutDialogOpen}
            onCreateSession={handleCreateSession}
            fencerNames={allFencerNames}
          />
        </header>

        <div className="mb-5 flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Bouts</h1>
          </div>
          <p className="hidden max-w-sm text-right text-xs leading-5 text-muted-foreground sm:block">Search, open, and compare your recorded sessions.</p>
        </div>

        <div className="library-tools mb-2 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search fencer or filename..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
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
            {hasFilters ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearch("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="library-list">
          <VideoLibrary
            sessions={filteredSessions}
            onSelect={(sessionId) => router.push(`/bouts/${sessionId}`)}
            onDelete={deleteSession}
          />
        </div>

        {hasFilters ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Showing {filteredSessions.length} of {sessions.length} bout
            {sessions.length !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
