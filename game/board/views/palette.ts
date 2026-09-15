// Placeholder chrome colours and text styles for the board (task 03/09) — replaced by the art
// pass (M5); not gameplay tuning. Tile face colours are NOT here: they come from
// presentation.json (GDD §13).

export const PLACEHOLDER = {
  base: 0x6d4c8f,
  cannonSlot: 0xdfe4ea,
  cannonSlotOutline: 0x7d8a9c,
  tileCell: 0xf4efe3,
  cellOutline: 0xc9bfa8,
  tray: 0xd9cfb8,
  trayMarker: 0x8a7f68,
  cannon: 0x141b24,
  cannonBand: 0x6b7788,
  robot: 0x4a4f5c,
  robotOutline: 0x1f2229,
  tileOutline: 0x000000,
  /** Drop feedback while dragging. */
  dropValid: 0xffffff,
  dropInvalid: 0xe53935,
  hpBarBack: 0x1f2229,
  hpBarFill: 0x9be15d,
  /** Playback (task 10). Balls read as red rubber balls (GDD §12.1). */
  ball: 0xe53935,
  ballOutline: 0x8e1b18,
  ballShine: 0xffffff,
  tileFlash: 0xffffff,
  laneWash: 0x000000,
  laneHighlight: 0xffd54f,
  celebration: 0xffc107,
  celebrationOutline: 0xff8f00,
  clonk: 0x9aa5b1,
  puff: 0xb0b7c3,
  /** A detonation's flash at the base strip (task 15). */
  detonateFlash: 0xffab40,
} as const;

export const FONT_FAMILY = 'system-ui, -apple-system, sans-serif';
/** Near-black reads best on all three tile colours (contrast ≥ 6:1 on green, blue and orange). */
export const TILE_TEXT_COLOR = '#1a1a1a';
export const LIGHT_TEXT_COLOR = '#ffffff';
export const DARK_STROKE_COLOR = '#000000';
export const COIN_TEXT_COLOR = '#ffd54f';
export const DOUBLED_DAMAGE_TEXT_COLOR = '#ffab40';
