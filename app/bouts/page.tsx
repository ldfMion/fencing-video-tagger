"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoLibrary } from "@/components/video-library";
import { ExportButton } from "@/components/export-button";
import { useSessions } from "@/hooks/use-sessions";
import { useVideoContext } from "@/contexts/video-context";
import { ArrowLeft, FileVideo, Hash } from "lucide-react";

export default function BoutsPage() {
  const router = useRouter();
  const { fileName: currentFileName, setFileName, clearVideo } = useVideoContext();
  const { sessions, deleteSession, exportToCSV } = useSessions();

  const totalTags = useMemo(
    () => sessions.reduce((sum, s) => sum + s.tags.length, 0),
    [sessions],
  );

  const handleSelect = (selectedFileName: string) => {
    // Clear the previous video to avoid showing the wrong video with the new bout's tags
    clearVideo();
    // Set the fileName in context so tags will show even without video loaded
    setFileName(selectedFileName);
    // Navigate to main page using client-side navigation (preserves state)
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tagger
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Bouts Library</h1>
          </div>
          <ExportButton
            exportToCSV={exportToCSV}
            disabled={sessions.length === 0}
          />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileVideo className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{sessions.length}</p>
                  <p className="text-sm text-muted-foreground">
                    Video{sessions.length !== 1 ? "s" : ""} Analyzed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Hash className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{totalTags}</p>
                  <p className="text-sm text-muted-foreground">Total Tags</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions List */}
        <Card>
          <CardHeader>
            <CardTitle>All Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <VideoLibrary
              sessions={sessions}
              currentFileName={currentFileName}
              onSelect={handleSelect}
              onDelete={deleteSession}
              expanded
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
