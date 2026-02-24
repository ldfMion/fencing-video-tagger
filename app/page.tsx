"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSessions } from "@/hooks/use-sessions";
import { useVideoContext } from "@/contexts/video-context";
import { Upload, Library, Swords } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { setVideo } = useVideoContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getOrCreateSession } = useSessions();

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      setVideo(url, file.name);

      const session = getOrCreateSession(file.name);
      router.push(`/bouts/${session.id}`);
    },
    [setVideo, getOrCreateSession, router],
  );

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background gap-6">
      <div className="flex flex-col items-center gap-2">
        <Swords className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Fencing Video Tagger</h1>
        <p className="text-muted-foreground text-sm">
          Analyze fencing videos with timestamped tags
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button size="lg" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-5 w-5 mr-2" />
          Select Video
        </Button>

        <Link href="/bouts">
          <Button variant="ghost" size="sm">
            <Library className="h-4 w-4 mr-1.5" />
            Bouts Library
          </Button>
        </Link>
      </div>
    </div>
  );
}
