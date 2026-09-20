import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../sim/core/types';
import { cueForDrop, cueForEvent, cueForPickup, traySlotChanged } from '../../game/state/cues';

const cell = { lane: 0 as const, col: 1 as const };

function event<T extends GameEvent['type']>(
  type: T,
  extra: Omit<Extract<GameEvent, { type: T }>, 'type' | 'step' | 'group'> | Record<string, never> = {},
): Extract<GameEvent, { type: T }> {
  return { type, step: 0, group: 'test', ...extra } as Extract<GameEvent, { type: T }>;
}

describe('cueForEvent', () => {
  it('maps every playback-teaching event to its locked cue', () => {
    expect(cueForEvent(event('BallFired', { ballId: 'b', lane: 0, at: cell, value: 1 }))).toEqual({
      name: 'cannonThump',
    });
    expect(
      cueForEvent(
        event('BallTransformed', {
          ballId: 'b',
          at: cell,
          tileId: 'add:4',
          pieceId: 'p',
          oldValue: 1,
          newValue: 5,
          chainDepth: 2,
        }),
      ),
    ).toEqual({ name: 'tilePop', params: { kind: 'add', chainDepth: 2 } });
    expect(
      cueForEvent(
        event('BallTransformed', {
          ballId: 'b',
          at: cell,
          tileId: 'sub:3',
          pieceId: 'p',
          oldValue: 5,
          newValue: 2,
          chainDepth: 3,
        }),
      ),
    ).toEqual({ name: 'tilePop', params: { kind: 'sub', chainDepth: 3 } });
    expect(
      cueForEvent(
        event('BallTransformed', {
          ballId: 'b',
          at: cell,
          tileId: 'mul:3',
          pieceId: 'p',
          oldValue: 2,
          newValue: 6,
          chainDepth: 1,
        }),
      ),
    ).toEqual({ name: 'tilePop', params: { kind: 'mul', chainDepth: 1 } });
    expect(
      cueForEvent(
        event('RobotDamaged', {
          robotId: 'r',
          ballId: 'b',
          at: cell,
          ballValue: 10,
          damage: 20,
          doubled: true,
          hpBefore: 30,
          hpAfter: 10,
        }),
      ),
    ).toEqual({ name: 'impact', params: { doubled: true } });
    expect(cueForEvent(event('RobotDefeated', { robotId: 'r', at: cell, exact: true }))).toEqual({
      name: 'exactKill',
    });
    expect(cueForEvent(event('RobotDefeated', { robotId: 'r', at: cell, exact: false }))).toEqual({
      name: 'kill',
    });
    expect(
      cueForEvent(
        event('RobotBouncedBack', {
          robotId: 'r',
          at: cell,
          hpBefore: 4,
          hpAfter: 8,
          overshoot: 4,
        }),
      ),
    ).toEqual({ name: 'bounceBack' });
    expect(
      cueForEvent(
        event('BallBlocked', { ballId: 'b', robotId: 'r', at: cell, value: 3, reason: 'oddOnly' }),
      ),
    ).toEqual({ name: 'clonk' });
    expect(cueForEvent(event('RobotDetonated', { robotId: 'r', lane: 0, damage: 5 }))).toEqual({
      name: 'detonate',
    });
    expect(
      cueForEvent(
        event('RobotSpawned', {
          robotId: 'r',
          at: { lane: 0, col: 7 },
          hp: 8,
          maxHp: 8,
          trait: { type: 'none' },
          isBoss: false,
        }),
      ),
    ).toEqual({ name: 'spawn' });
    expect(cueForEvent(event('WaveCleared', { waveIndex: 0 }))).toEqual({ name: 'waveCleared' });
    expect(cueForEvent(event('LevelCleared', { levelId: 'level-1' }))).toEqual({
      name: 'waveCleared',
    });
    expect(cueForEvent(event('RunWon'))).toEqual({ name: 'win' });
    expect(cueForEvent(event('RunLost'))).toEqual({ name: 'lose' });
  });

  it('returns null for events that must stay silent (including shop)', () => {
    expect(cueForEvent(event('LaneStarted', { lane: 0 }))).toBeNull();
    expect(
      cueForEvent(event('BallMoved', { ballId: 'b', lane: 0, from: cell, to: { lane: 0, col: 2 } })),
    ).toBeNull();
    expect(cueForEvent(event('LaneEnded', { lane: 0 }))).toBeNull();
    expect(cueForEvent(event('BallExited', { ballId: 'b', lane: 0, at: cell }))).toBeNull();
    expect(
      cueForEvent(event('RobotAdvanced', { robotId: 'r', from: cell, to: { lane: 0, col: 2 } })),
    ).toBeNull();
    expect(
      cueForEvent(
        event('RobotWaiting', {
          robotId: 'r',
          lane: 0,
          hp: 4,
          maxHp: 4,
          trait: { type: 'none' },
        }),
      ),
    ).toBeNull();
    expect(
      cueForEvent(event('CoinsChanged', { delta: 2, total: 5, reason: 'exactKill' })),
    ).toBeNull();
    expect(cueForEvent(event('BaseDamaged', { amount: 4, hpBefore: 100, hpAfter: 96 }))).toBeNull();
    expect(
      cueForEvent(event('OfferBought', { slot: 'tile:0', kind: 'tile', price: 4 })),
    ).toBeNull();
    expect(cueForEvent(event('TilesGranted', { tiles: [] }))).toBeNull();
    expect(cueForEvent(event('CannonPlaced', { lane: 1 }))).toBeNull();
    expect(cueForEvent(event('BaseValueChanged', { from: 1, to: 2 }))).toBeNull();
  });
});

describe('drag cues', () => {
  it('picks pickup/drop/snap from source kind and drop resolution', () => {
    expect(cueForPickup('trayTile')).toBe('pickupTile');
    expect(cueForPickup('cellTile')).toBe('pickupTile');
    expect(cueForPickup('cannon')).toBe('pickupCannon');
    expect(cueForDrop('trayTile', 'command')).toBe('dropTile');
    expect(cueForDrop('cellTile', 'origin')).toBe('dropTile');
    expect(cueForDrop('cannon', 'command')).toBe('dropCannon');
    expect(cueForDrop('cannon', 'origin')).toBe('dropCannon');
    expect(cueForDrop('trayTile', 'invalid')).toBe('snapBack');
    expect(cueForDrop('cannon', 'invalid')).toBe('snapBack');
  });

  it('ticks the tray only when the integer slot changes', () => {
    expect(traySlotChanged(0, 0.4)).toBe(false);
    expect(traySlotChanged(0, 0.6)).toBe(true);
    expect(traySlotChanged(1, 1)).toBe(false);
  });
});
