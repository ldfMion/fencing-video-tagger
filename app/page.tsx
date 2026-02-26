"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoLibrary } from "@/components/video-library";
import { ExportButton } from "@/components/export-button";
import { useSessions } from "@/hooks/use-sessions";
import { useVideoContext } from "@/contexts/video-context";
import { Search, X, Upload, Swords } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { setVideo } = useVideoContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sessions, getSession, getOrCreateSession, deleteSession, exportToCSV } =
    useSessions();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasFilters = search || dateFrom || dateTo;

  const filteredSessions = useMemo(() => {
    let result = sessions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const left = s.leftFencer?.toLowerCase() ?? "";
        const right = s.rightFencer?.toLowerCase() ?? "";
        return left.includes(q) || right.includes(q);
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

  const handleSelect = (selectedFileName: string) => {
    const session = getSession(selectedFileName);
    if (session) {
      router.push(`/bouts/${session.id}`);
    }
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      setVideo(url, file.name);

      const session = getOrCreateSession(file.name, file.lastModified);
      router.push(`/bouts/${session.id}`);
    },
    [setVideo, getOrCreateSession, router],
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
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              New Bout
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fencer name..."
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
          onSelect={handleSelect}
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
