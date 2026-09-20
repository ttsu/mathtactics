// Phaser-free cue mapping (task 31): events → playback cues, drag outcomes → pickup/drop/snap.
// Lives in /game/state so unit tests do not boot a scene (TR §2).

import type { GameEvent, TileId, TileKind } from '../../sim/core/types';
import type { CueName, CueParams } from './audio';

export type DragPieceKind = 'trayTile' | 'cellTile' | 'cannon';
export type DropKind = 'command' | 'origin' | 'invalid';

export function cueForEvent(event: GameEvent): { name: CueName; params?: CueParams } | null {
  switch (event.type) {
    case 'BallFired':
      return { name: 'cannonThump' };
    case 'BallTransformed':
      return {
        name: 'tilePop',
        params: { kind: tileKind(event.tileId), chainDepth: event.chainDepth },
      };
    case 'RobotDamaged':
      return { name: 'impact', params: { doubled: event.doubled } };
    case 'RobotDefeated':
      return { name: event.exact ? 'exactKill' : 'kill' };
    case 'RobotBouncedBack':
      return { name: 'bounceBack' };
    case 'BallBlocked':
      return { name: 'clonk' };
    case 'RobotDetonated':
      return { name: 'detonate' };
    case 'RobotSpawned':
      return { name: 'spawn' };
    case 'WaveCleared':
    case 'LevelCleared':
      return { name: 'waveCleared' };
    case 'RunWon':
      return { name: 'win' };
    case 'RunLost':
      return { name: 'lose' };
    default:
      return null;
  }
}

export function cueForPickup(kind: DragPieceKind): CueName {
  return kind === 'cannon' ? 'pickupCannon' : 'pickupTile';
}

export function cueForDrop(kind: DragPieceKind, resolution: DropKind): CueName {
  if (resolution === 'invalid') return 'snapBack';
  return kind === 'cannon' ? 'dropCannon' : 'dropTile';
}

/** Tray scroll is in slots; tick when the integer index changes, not on every pixel. */
export function traySlotChanged(previousScroll: number, nextScroll: number): boolean {
  return Math.round(previousScroll) !== Math.round(nextScroll);
}

function tileKind(tileId: TileId): TileKind {
  if (tileId.startsWith('add:')) return 'add';
  if (tileId.startsWith('sub:')) return 'sub';
  return 'mul';
}
