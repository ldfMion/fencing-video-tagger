"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ExternalLink, RotateCcw, X } from "lucide-react";
import { VideoPlayer } from "@/components/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVideo } from "@/hooks/use-video";
import type { CommentSearchResult } from "@/lib/comment-search";
import { buildSessionVideoUrl } from "@/lib/video-library";

const BEFORE_SECONDS = 4;
const AFTER_SECONDS = 3;

export function TouchReplay({ result, onClose }: { result: CommentSearchResult; onClose: () => void }) {
  const video = useVideo();
  const { resetPlaybackState } = video;
  const timestamp = result.timestamp ?? 0;
  const start = Math.max(0, timestamp - BEFORE_SECONDS);
  const end = timestamp + AFTER_SECONDS;
  const videoUrl = result.videoRelativePath ? buildSessionVideoUrl({ id: result.boutId }) : null;

  const replay = () => {
    video.playAt(start);
  };

  useEffect(() => {
    resetPlaybackState();
  }, [resetPlaybackState, result.boutId, result.tagId]);

  return <aside className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 lg:sticky lg:top-[10.5rem] lg:z-20 lg:max-h-[calc(100vh-12rem)] lg:rounded-lg lg:border lg:bg-card lg:p-4"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Replay window</p><h2 className="mt-2 text-lg font-semibold">{result.taggedFencer || "Tagged touch"}{result.opponent && ` vs ${result.opponent}`}</h2></div><Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close replay"><X className="h-4 w-4" /></Button></div><div className="mt-4"><VideoPlayer key={`${result.boutId}:${result.tagId}`} videoUrl={videoUrl} video={video} playbackWindow={{ start, end, autoPlay: true }} /></div><div className="mt-3 flex items-center justify-between"><p className="text-xs text-muted-foreground">{start.toFixed(1)}s–{end.toFixed(1)}s around the tag</p><Button variant="outline" size="sm" onClick={replay}><RotateCcw className="h-3.5 w-3.5" /> Replay</Button></div><div className="mt-5 space-y-3"><div className="flex flex-wrap gap-2">{result.action && <Badge>{result.action}</Badge>}{result.mistake && <Badge variant="outline" className="capitalize">{result.mistake}</Badge>}{result.period && <Badge variant="secondary">Period {result.period}</Badge>}{result.matchClock && <Badge variant="secondary">{result.matchClock}</Badge>}</div><p className="text-sm leading-6">{result.comment || "No comment"}</p><p className="text-xs text-muted-foreground">{result.boutDate || "Date unknown"}</p><Button asChild variant="outline" className="w-full"><Link href={`/bouts/${encodeURIComponent(result.boutId)}?tag=${encodeURIComponent(result.tagId)}`}><ExternalLink className="h-4 w-4" /> Open full bout</Link></Button></div></aside>;
}
