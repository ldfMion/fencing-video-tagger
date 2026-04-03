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
    const message =
      error instanceof Error ? error.message : "Failed to read video library";

    return Response.json({ error: message }, { status: 500 });
  }
}
