import {
  getVideoLibraryRootName,
  isVideoLibraryError,
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
    if (isVideoLibraryError(error)) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        error: "Failed to read video library",
        code: "VIDEO_LIBRARY_UNKNOWN",
      },
      { status: 500 },
    );
  }
}
