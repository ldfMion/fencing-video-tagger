"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoPlayer } from "@/components/video-player";
import { TagForm } from "@/components/tag-form";
import { TagList } from "@/components/tag-list";
import { VideoLibrary } from "@/components/video-library";
import { useVideo } from "@/hooks/use-video";
import { useSessions } from "@/hooks/use-sessions";
import { Upload } from "lucide-react";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const video = useVideo();
  const { sessions, getSession, addTag, deleteTag, deleteSession } =
    useSessions();

  const currentSession = fileName ? getSession(fileName) : undefined;
  const tags = currentSession?.tags ?? [];

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Revoke previous URL to avoid memory leak
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      // Reset zoom/pan state when switching videos
      video.resetZoom();

      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setFileName(file.name);
    },
    [videoUrl, video],
  );

  const handleLibrarySelect = useCallback(
    (selectedFileName: string) => {
      // User clicked on a previous session - prompt them to select the file
      setFileName(selectedFileName);
      // Clear current video since we need the user to re-select the file
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
      // Trigger file picker
      fileInputRef.current?.click();
    },
    [videoUrl],
  );

  const handleAddTag = useCallback(
    (text: string, timestamp: number) => {
      if (!fileName) return;
      addTag(fileName, text, timestamp);
    },
    [fileName, addTag],
  );

  const handleDeleteTag = useCallback(
    (tagId: string) => {
      if (!fileName) return;
      deleteTag(fileName, tagId);
    },
    [fileName, deleteTag],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Fencing Video Tagger</h1>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Select Video
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video player - takes 2 columns on large screens */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {fileName ?? "No video selected"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VideoPlayer videoUrl={videoUrl} video={video} />
              </CardContent>
            </Card>
          </div>

          {/* Tags panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <TagList
                  tags={tags}
                  onSeek={video.seek}
                  onDelete={handleDeleteTag}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <TagForm
                  currentTime={video.currentTime}
                  onAddTag={handleAddTag}
                  disabled={!fileName}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Video library */}
        <div className="mt-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Previous Videos</CardTitle>
            </CardHeader>
            <CardContent>
              <VideoLibrary
                sessions={sessions}
                currentFileName={fileName}
                onSelect={handleLibrarySelect}
                onDelete={deleteSession}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
