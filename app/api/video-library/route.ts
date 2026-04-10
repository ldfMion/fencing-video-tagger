import {
  getVideoLibraryRootName,
  listVideoLibraryItems,
} from "@/lib/server/video-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listVideoLibraryItems();
    return Response.json({
      rootName: getVideoLibraryRootName(),
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const allowedErrors = new Set([
      "VIDEO_LIBRARY_ROOT is not configured",
      "VIDEO_LIBRARY_ROOT must point to a directory",
      "Video library root cannot be read",
    ]);

    return Response.json(
      {
        error: allowedErrors.has(message)
          ? message
          : "Failed to read video library",
      },
      { status: 500 },
    );
  }
}
