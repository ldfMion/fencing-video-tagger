import { z } from "zod";

/** A crop rectangle in normalized 0–1 coordinates of the source frame. */
export const CropRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().gt(0).max(1),
  height: z.number().gt(0).max(1),
}).refine(
  (crop) => crop.x + crop.width <= 1.0001 && crop.y + crop.height <= 1.0001,
  { message: "Crop must stay inside the frame" },
);

export type CropRect = z.infer<typeof CropRectSchema>;

export interface FrameTile {
  /** Row-major position in the sheet, starting at 0. */
  index: number;
  /** Source presentation timestamp in seconds, the same clock the player seeks with. */
  time: number;
}

export interface FrameSheet {
  imagePath: string;
  columns: number;
  rows: number;
  tiles: FrameTile[];
  start: number;
  end: number;
}

export interface VideoStreamInfo {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
}

export function describeFrameSheetTiles(sheet: Pick<FrameSheet, "columns" | "rows" | "tiles">): string {
  const tileTimes = sheet.tiles
    .map((tile) => `${tile.index + 1}=${tile.time.toFixed(3)}s`)
    .join(", ");
  return `${sheet.columns}x${sheet.rows} grid, row-major, left to right then top to bottom. Tile times: ${tileTimes}`;
}
