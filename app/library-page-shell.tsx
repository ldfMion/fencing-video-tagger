"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Swords, X } from "lucide-react";
import { ExportButton } from "@/components/export-button";
import { ImportButton } from "@/components/import-button";
import { NewBoutDialog } from "@/components/new-bout-dialog";
import { VideoLibrary } from "@/components/video-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVideoContext } from "@/contexts/video-context";
import { filterSessionsBySearchAndDate } from "@/lib/session-selectors";
import type { VideoLibraryItem } from "@/lib/video-library";
import { useSessions } from "@/hooks/use-sessions";

export function LibraryPageShell() {
  const router = useRouter();
  const { setVideo } = useVideoContext();
  const {
    sessions,
    createSession,
    createSessionWithLibraryVideo,
    createSessionWithVideo,
    deleteSession,
    exportToCSV,
    allFencerNames,
  } = useSessions();

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

  const handleCreateSessionWithoutVideo = useCallback(
    (params: {
      leftFencer?: string;
      rightFencer?: string;
      boutDate?: string;
      externalSource?: string;
    }) => {
      const session = createSession(params);
      router.push(`/bouts/${session.id}`);
      return session;
    },
    [createSession, router],
  );

  const handleCreateSessionWithVideo = useCallback(
    (
      file: File,
      params: {
        leftFencer?: string;
        rightFencer?: string;
        boutDate?: string;
        externalSource?: string;
      },
    ) => {
      const session = createSessionWithVideo(file.name, file.lastModified, params);
      const url = URL.createObjectURL(file);
      setVideo(session.id, url, file.name, "blob");
      router.push(`/bouts/${session.id}`);
      return session;
    },
    [createSessionWithVideo, router, setVideo],
  );

  const handleCreateSessionWithLibraryVideo = useCallback(
    (
      video: VideoLibraryItem,
      params: {
        leftFencer?: string;
        rightFencer?: string;
        boutDate?: string;
        externalSource?: string;
      },
    ) => {
      const session = createSessionWithLibraryVideo(video, params);
      router.push(`/bouts/${session.id}`);
      return session;
    },
    [createSessionWithLibraryVideo, router],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Fencing Video Tagger</h1>
          </div>
          <div className="flex items-center gap-2">
            <ImportButton />
            <ExportButton
              exportToCSV={exportToCSV}
              disabled={sessions.length === 0}
            />
            <Button onClick={() => setIsNewBoutDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Bout
            </Button>
          </div>

          <NewBoutDialog
            isOpen={isNewBoutDialogOpen}
            onOpenChange={setIsNewBoutDialogOpen}
            onCreateSession={handleCreateSessionWithoutVideo}
            onCreateWithVideo={handleCreateSessionWithVideo}
            onCreateWithLibraryVideo={handleCreateSessionWithLibraryVideo}
            fencerNames={allFencerNames}
          />
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
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

        <VideoLibrary
          sessions={filteredSessions}
          onSelect={(sessionId) => router.push(`/bouts/${sessionId}`)}
          onDelete={deleteSession}
        />

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
