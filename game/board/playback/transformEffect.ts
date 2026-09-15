// How hard a ball passing through a tile is emphasised (GDD §12.2: a pop per tile, escalating
// across a chain). `×N` tiles get a stronger effect than `+N` / `−N`. Phaser-free so it is
// unit-testable in node; every number comes from `presentation.json`.

import type { TileId, TileKind } from '../../../sim/core/types';
import type { GameData } from '../../../sim/data/schemas';

type TransformSettings = GameData['presentation']['playback']['transform'];
export type TransformStrength = TransformSettings['additive'];

export interface TransformEffect extends TransformStrength {
  /** True for `×N` tiles. */
  multiply: boolean;
  /** Peak ball scale for this tile: the chain's escalating pop plus the tile kind's bonus. */
  ballPopScale: number;
}

export function tileKind(tileId: TileId): TileKind {
  return tileId.split(':')[0] as TileKind;
}

export function transformEffect(
  event: { tileId: TileId; chainDepth: number },
  settings: TransformSettings,
): TransformEffect {
  const multiply = tileKind(event.tileId) === 'mul';
  const strength = multiply ? settings.multiply : settings.additive;
  const chainPop = Math.min(
    settings.popScaleMax,
    settings.popScale + settings.popScalePerChain * (event.chainDepth - 1),
  );
  return { ...strength, multiply, ballPopScale: chainPop + strength.popBonus };
}
