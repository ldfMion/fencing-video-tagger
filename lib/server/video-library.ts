import "server-only";

import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import type { VideoLibraryItem } from "@/lib/video-library";

const VIDEO_MIME_TYPES: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".webm": "video/webm",
};
const VIDEO_LIBRARY_CACHE_TTL_MS = 15_000;
let cachedLibraryItems: {
  root: string;
  fetchedAt: number;
  items: VideoLibraryItem[];
} | null = null;

export type VideoLibraryErrorCode =
  | "VIDEO_LIBRARY_CONFIG_MISSING"
  | "VIDEO_LIBRARY_ROOT_UNREADABLE"
  | "VIDEO_LIBRARY_ROOT_NOT_DIRECTORY"
  | "VIDEO_PATH_INVALID"
  | "VIDEO_PATH_OUTSIDE_ROOT"
  | "VIDEO_FILE_NOT_FOUND"
  | "VIDEO_FILE_UNREADABLE";

export class VideoLibraryError extends Error {
  readonly code: VideoLibraryErrorCode;
  readonly status: number;

  constructor(
    code: VideoLibraryErrorCode,
    message: string,
    status = 400,
  ) {
    super(message);
    this.name = "VideoLibraryError";
    this.code = code;
    this.status = status;
  }
}

export function isVideoLibraryError(error: unknown): error is VideoLibraryError {
  return error instanceof VideoLibraryError;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function getVideoLibraryRoot(): string {
  const configuredRoot = process.env.VIDEO_LIBRARY_ROOT?.trim();

  if (!configuredRoot) {
    throw new VideoLibraryError(
      "VIDEO_LIBRARY_CONFIG_MISSING",
      "VIDEO_LIBRARY_ROOT is not configured",
      500,
    );
  }

  return path.resolve(configuredRoot);
}

async function assertReadablePath(
  targetPath: string,
  errorMessage: string,
  code: VideoLibraryErrorCode,
  status = 500,
): Promise<void> {
  try {
    await fs.access(targetPath, fsConstants.R_OK);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "EACCES" || error.code === "EPERM")
    ) {
      throw new VideoLibraryError(code, errorMessage, status);
    }

    throw error;
  }
}

export function getVideoLibraryRootName(): string {
  const root = getVideoLibraryRoot();
  return path.basename(root) || root;
}

function getMimeType(filePath: string): string {
  return VIDEO_MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function isAllowedVideoFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() in VIDEO_MIME_TYPES;
}

function isSafeRelativePath(relativePath: string): boolean {
  return (
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    !relativePath.split("/").includes("..")
  );
}

async function walkDirectory(
  root: string,
  currentPath: string,
  items: VideoLibraryItem[],
): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(root, absolutePath, items);
      continue;
    }

    if (!entry.isFile() || !isAllowedVideoFile(absolutePath)) {
      continue;
    }

    const stats = await fs.stat(absolutePath);
    const relativePath = toPosixPath(path.relative(root, absolutePath));

    items.push({
      relativePath,
      fileName: entry.name,
      size: stats.size,
      modifiedAt: stats.mtimeMs,
      mimeType: getMimeType(absolutePath),
    });
  }
}

export async function listVideoLibraryItems(): Promise<VideoLibraryItem[]> {
  const root = getVideoLibraryRoot();
  if (
    cachedLibraryItems &&
    cachedLibraryItems.root === root &&
    Date.now() - cachedLibraryItems.fetchedAt < VIDEO_LIBRARY_CACHE_TTL_MS
  ) {
    return cachedLibraryItems.items;
  }

  await assertReadablePath(
    root,
    "Video library root cannot be read",
    "VIDEO_LIBRARY_ROOT_UNREADABLE",
    500,
  );
  const stats = await fs.stat(root);

  if (!stats.isDirectory()) {
    throw new VideoLibraryError(
      "VIDEO_LIBRARY_ROOT_NOT_DIRECTORY",
      "VIDEO_LIBRARY_ROOT must point to a directory",
      500,
    );
  }

  const items: VideoLibraryItem[] = [];
  await walkDirectory(root, root, items);
  const sortedItems = items.sort((left, right) => right.modifiedAt - left.modifiedAt);
  cachedLibraryItems = {
    root,
    fetchedAt: Date.now(),
    items: sortedItems,
  };
  return sortedItems;
}

export async function resolveVideoLibraryFile(relativePath: string): Promise<{
  absolutePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  modifiedAt: number;
}> {
  const root = getVideoLibraryRoot();
  const normalizedRelativePath = relativePath.trim();

  if (!isSafeRelativePath(normalizedRelativePath)) {
    throw new VideoLibraryError("VIDEO_PATH_INVALID", "Invalid video path");
  }

  const absolutePath = path.resolve(root, normalizedRelativePath);
  const relativeFromRoot = path.relative(root, absolutePath);

  if (
    relativeFromRoot.startsWith("..") ||
    path.isAbsolute(relativeFromRoot) ||
    !isAllowedVideoFile(absolutePath)
  ) {
    throw new VideoLibraryError(
      "VIDEO_PATH_OUTSIDE_ROOT",
      "Video path is outside the library root",
    );
  }

  let stats: Awaited<ReturnType<typeof fs.stat>>;

  try {
    stats = await fs.stat(absolutePath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new VideoLibraryError("VIDEO_FILE_NOT_FOUND", "Video file not found", 404);
    }

    throw error;
  }

  if (!stats.isFile()) {
    throw new VideoLibraryError("VIDEO_FILE_NOT_FOUND", "Video file not found", 404);
  }

  await assertReadablePath(
    absolutePath,
    "Video file cannot be read",
    "VIDEO_FILE_UNREADABLE",
  );

  try {
    const fileHandle = await fs.open(absolutePath, "r");
    await fileHandle.close();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "EACCES" || error.code === "EPERM")
    ) {
      throw new VideoLibraryError(
        "VIDEO_FILE_UNREADABLE",
        "Video file cannot be read",
      );
    }

    throw error;
  }

  return {
    absolutePath,
    fileName: path.basename(absolutePath),
    mimeType: getMimeType(absolutePath),
    size: stats.size,
    modifiedAt: stats.mtimeMs,
  };
}
