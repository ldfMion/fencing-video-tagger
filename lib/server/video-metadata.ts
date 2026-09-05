import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface FfprobeOutput {
  format?: {
    duration?: string;
    tags?: { creation_time?: string };
  };
  streams?: Array<{ tags?: { creation_time?: string } }>;
}

export interface VideoTiming {
  duration: number;
  startedAt: number;
  timingSource: "embedded" | "fileModified";
}

export async function readVideoTiming(
  absolutePath: string,
  modifiedAt: number,
): Promise<VideoTiming> {
  let output: FfprobeOutput;
  try {
    const result = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:format_tags=creation_time:stream_tags=creation_time",
      "-of",
      "json",
      absolutePath,
    ], {
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
    });
    output = JSON.parse(result.stdout) as FfprobeOutput;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ffprobe error";
    throw new Error(`Could not read the attached video's timing metadata: ${message}`);
  }

  const duration = Number(output.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("The attached video does not contain a readable duration.");
  }

  const creationTime = output.format?.tags?.creation_time ??
    output.streams?.find((stream) => stream.tags?.creation_time)?.tags?.creation_time;
  const embeddedStartedAt = creationTime ? Date.parse(creationTime) : Number.NaN;
  const hasEmbeddedTime = Number.isFinite(embeddedStartedAt);

  return {
    duration,
    startedAt: hasEmbeddedTime ? embeddedStartedAt : modifiedAt - duration * 1000,
    timingSource: hasEmbeddedTime ? "embedded" : "fileModified",
  };
}
