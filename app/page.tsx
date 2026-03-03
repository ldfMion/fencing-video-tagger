"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoLibrary } from "@/components/video-library";
import { ExportButton } from "@/components/export-button";
import { NewBoutDialog } from "@/components/new-bout-dialog";
import { useSessions } from "@/hooks/use-sessions";
import { useVideoContext } from "@/contexts/video-context";
import { Search, X, Plus, Swords } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { setVideo } = useVideoContext();
  const {
    sessions,
    createSessionWithVideo,
    createSession,
    deleteSession,
    exportToCSV,
    allFencerNames,
  } = useSessions();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isNewBoutDialogOpen, setIsNewBoutDialogOpen] = useState(false);

  const hasFilters = search || dateFrom || dateTo;

  const filteredSessions = useMemo(() => {
    let result = sessions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const left = s.leftFencer?.toLowerCase() ?? "";
        const right = s.rightFencer?.toLowerCase() ?? "";
        const file = s.fileName?.toLowerCase() ?? "";
        const source = s.externalSource?.toLowerCase() ?? "";
        return left.includes(q) || right.includes(q) || file.includes(q) || source.includes(q);
      });
    }

    if (dateFrom) {
      result = result.filter((s) => {
        if (!s.boutDate) return false;
        return s.boutDate >= dateFrom;
      });
    }

    if (dateTo) {
      result = result.filter((s) => {
        if (!s.boutDate) return false;
        return s.boutDate <= dateTo;
      });
    }

    return result;
  }, [sessions, search, dateFrom, dateTo]);

  const handleSelectSession = (sessionId: string) => {
    router.push(`/bouts/${sessionId}`);
  };

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
      const url = URL.createObjectURL(file);
      setVideo(url, file.name);

      const session = createSessionWithVideo(file.name, file.lastModified);
      // Merge metadata params if provided
      if (
        params.leftFencer ||
        params.rightFencer ||
        params.boutDate ||
        params.externalSource
      ) {
        // These would be set through metadata form updates after navigation
        // For now, just navigate - user can edit metadata on bout page
      }

      router.push(`/bouts/${session.id}`);
      return session;
    },
    [setVideo, createSessionWithVideo, router],
  );

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Swords className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Fencing Video Tagger</h1>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              exportToCSV={exportToCSV}
              disabled={sessions.length === 0}
            />
            <Button onClick={() => setIsNewBoutDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Bout
            </Button>
          </div>

          <NewBoutDialog
            isOpen={isNewBoutDialogOpen}
            onOpenChange={setIsNewBoutDialogOpen}
            onCreateSession={handleCreateSessionWithoutVideo}
            onCreateWithVideo={handleCreateSessionWithVideo}
            fencerNames={allFencerNames}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fencer or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 items-center">
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
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Bout List */}
        <VideoLibrary
          sessions={filteredSessions}
          onSelect={handleSelectSession}
          onDelete={deleteSession}
        />

        {/* Results count when filtered */}
        {hasFilters && (
          <p className="text-sm text-muted-foreground mt-3">
            Showing {filteredSessions.length} of {sessions.length} bout{sessions.length !== 1 && "s"}
          </p>
        )}
      </div>
    </div>
  );
}
