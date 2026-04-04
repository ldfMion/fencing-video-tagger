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

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function getVideoLibraryRoot(): string {
  const configuredRoot = process.env.VIDEO_LIBRARY_ROOT?.trim();

  if (!configuredRoot) {
    throw new Error("VIDEO_LIBRARY_ROOT is not configured");
  }

  return path.resolve(configuredRoot);
}

async function assertReadablePath(
  targetPath: string,
  errorMessage: string,
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
      throw new Error(errorMessage);
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
  await assertReadablePath(root, "Video library root cannot be read");
  const stats = await fs.stat(root);

  if (!stats.isDirectory()) {
    throw new Error("VIDEO_LIBRARY_ROOT must point to a directory");
  }

  const items: VideoLibraryItem[] = [];
  await walkDirectory(root, root, items);

  return items.sort((left, right) => right.modifiedAt - left.modifiedAt);
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
    throw new Error("Invalid video path");
  }

  const absolutePath = path.resolve(root, normalizedRelativePath);
  const relativeFromRoot = path.relative(root, absolutePath);

  if (
    relativeFromRoot.startsWith("..") ||
    path.isAbsolute(relativeFromRoot) ||
    !isAllowedVideoFile(absolutePath)
  ) {
    throw new Error("Video path is outside the library root");
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
      throw new Error("Video file not found");
    }

    throw error;
  }

  if (!stats.isFile()) {
    throw new Error("Video file not found");
  }

  await assertReadablePath(absolutePath, "Video file cannot be read");

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
      throw new Error("Video file cannot be read");
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
