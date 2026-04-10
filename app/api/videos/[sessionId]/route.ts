import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getSessionById } from "@/lib/server/session-service";
import { resolveVideoLibraryFile } from "@/lib/server/video-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildBaseHeaders(mimeType: string, size: number): Headers {
  return new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Length": String(size),
    "Content-Type": mimeType,
  });
}

function parseRangeHeader(
  rangeHeader: string,
  fileSize: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());

  if (!match) {
    return null;
  }

  const [, startText, endText] = match;

  if (!startText && !endText) {
    return null;
  }

  if (!startText) {
    const suffixLength = Number(endText);

    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    const start = Math.max(fileSize - suffixLength, 0);
    return { start, end: fileSize - 1 };
  }

  const start = Number(startText);
  const end = endText ? Number(endText) : fileSize - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start > end ||
    start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

function createVideoStream(
  absolutePath: string,
  options?: { start?: number; end?: number },
): ReadableStream<Uint8Array> {
  const stream = createReadStream(absolutePath, options);
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

async function getVideoResponse(
  request: Request,
  sessionId: string,
  method: "GET" | "HEAD",
) {
  const requestUrl = new URL(request.url);
  const session = await getSessionById(sessionId);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.videoRelativePath) {
    return Response.json(
      { error: "Session does not have an attached library video" },
      { status: 404 },
    );
  }

  const relativePath = requestUrl.searchParams.get("path");
  if (relativePath && relativePath !== session.videoRelativePath) {
    return Response.json(
      { error: "Requested video path does not match the session attachment" },
      { status: 400 },
    );
  }

  try {
    const { absolutePath, mimeType, size } = await resolveVideoLibraryFile(
      session.videoRelativePath,
    );
    const baseHeaders = buildBaseHeaders(mimeType, size);
    const rangeHeader = request.headers.get("range");

    if (!rangeHeader) {
      if (method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: baseHeaders,
        });
      }

      return new Response(createVideoStream(absolutePath), {
        status: 200,
        headers: baseHeaders,
      });
    }

    const parsedRange = parseRangeHeader(rangeHeader, size);

    if (!parsedRange) {
      const headers = buildBaseHeaders(mimeType, size);
      headers.set("Content-Range", `bytes */${size}`);

      return new Response(null, {
        status: 416,
        headers,
      });
    }

    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;
    const headers = buildBaseHeaders(mimeType, chunkSize);
    headers.set("Content-Length", String(chunkSize));
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

    if (method === "HEAD") {
      return new Response(null, {
        status: 206,
        headers,
      });
    }

    return new Response(createVideoStream(absolutePath, { start, end }), {
      status: 206,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const allowedErrors = new Set([
      "Video file not found",
      "Invalid video path",
      "Video path is outside the library root",
      "Video file cannot be read",
      "VIDEO_LIBRARY_ROOT is not configured",
      "Video library root cannot be read",
    ]);
    const safeMessage = allowedErrors.has(message)
      ? message
      : "Failed to stream video";
    const status = safeMessage === "Video file not found" ? 404 : 400;

    return Response.json({ error: safeMessage }, { status });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  return getVideoResponse(request, sessionId, "GET");
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  return getVideoResponse(request, sessionId, "HEAD");
}
