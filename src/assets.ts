import * as C from "./constants";
export const imagePaths = [
  C.LAMPLIGHTER_IDLE_PATH,
  C.GROUND_TILE_PATH,
  "sprites/cover.png",
  ...Array.from(
    { length: C.LAMPLIGHTER_WALK_SHEET.frames },
    (_, i) => `${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`,
  ),
  ...C.ENEMY_IDS.flatMap((id) =>
    Array.from(
      { length: C.ENEMY_FRAMES },
      (_, i) => `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
    ),
  ),
  ...Array.from(
    { length: C.PUFF_SHEET.frames },
    (_, i) => `${C.PUFF_SHEET.dir}/${i}.png`,
  ),
  ...Object.values(C.GEM_PATHS),
  ...Object.values(C.PICKUP_PATHS),
  ...Object.values(C.ICON_PATHS),
  ...Object.values(C.EFFECT_SPRITES).flatMap((a) =>
    a.frames === 1
      ? [a.path]
      : Array.from({ length: a.frames }, (_, i) => `${a.path}/${i}.png`),
  ),
];
/** Immutable decoded resources, never simulation state. */
export const images = new Map<string, ImageBitmap>();
