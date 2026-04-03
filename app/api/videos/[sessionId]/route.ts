import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
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

async function getVideoResponse(request: Request, method: "GET" | "HEAD") {
  const requestUrl = new URL(request.url);
  const relativePath = requestUrl.searchParams.get("path");

  if (!relativePath) {
    return Response.json(
      { error: "Missing required video path" },
      { status: 400 },
    );
  }

  try {
    const { absolutePath, mimeType, size } = await resolveVideoLibraryFile(relativePath);
    const baseHeaders = buildBaseHeaders(mimeType, size);
    const rangeHeader = request.headers.get("range");

    if (!rangeHeader) {
      if (method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: baseHeaders,
        });
      }

      const stream = createReadStream(absolutePath);
      return new Response(Readable.toWeb(stream) as ReadableStream, {
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

    const stream = createReadStream(absolutePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stream video";
    const status = message === "Video file not found" ? 404 : 400;

    return Response.json({ error: message }, { status });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  await context.params;
  return getVideoResponse(request, "GET");
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  await context.params;
  return getVideoResponse(request, "HEAD");
}
