import type { VideoSession } from "@/lib/types";

export interface VideoLibraryItem {
  relativePath: string;
  fileName: string;
  size: number;
  modifiedAt: number;
  mimeType: string;
}

export function buildSessionVideoUrl(
  session: Pick<VideoSession, "id" | "videoRelativePath">,
): string | null {
  if (!session.videoRelativePath) {
    return null;
  }

  const params = new URLSearchParams({
    path: session.videoRelativePath,
  });

  return `/api/videos/${encodeURIComponent(session.id)}?${params.toString()}`;
}
