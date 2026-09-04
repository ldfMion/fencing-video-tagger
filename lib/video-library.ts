import type { VideoSession } from "@/lib/types";

export interface VideoLibraryItem {
  relativePath: string;
  fileName: string;
  size: number;
  modifiedAt: number;
  mimeType: string;
}

export interface VideoLibraryResponse {
  rootName: string;
  items: VideoLibraryItem[];
}

export function buildSessionVideoUrl(
  session: Pick<VideoSession, "id">,
): string {
  return `/api/videos/${encodeURIComponent(session.id)}`;
}
