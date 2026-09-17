// Task 21 balance checks for the 7-wave ladder (GDD §10.1–10.3, §8.2). Uses shipped data
// (`parseGameData(loadRawGameData())`) and the real command pipeline (`applyCommand`).

import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../sim/commands/applyCommand';
import { parseGameData } from '../sim/data/load';
import type { GameEvent, RunState } from '../sim/core/types';
import type { Lane } from '../sim/core/coords';
import { loadRawGameData } from './helpers/loadDataFiles';
import {
  canExactKillInAtMostNHits,
  playEndTurnOnlyRun,
  playSensibleRun,
  requireOk,
  type SensibleRunStats,
} from './helpers/sensiblePlayer';

const data = parseGameData(loadRawGameData());
const SEEDS = Array.from({ length: 100 }, (_, i) => String(i + 1));
const LADDER_TIMEOUT_MS = 60_000;

function newRun(seed: string): RunState {
  return requireOk(applyCommand(null, { type: 'newRun', seed }, data)).state;
}

function cannonLane(board: RunState['board']): Lane {
  const lane = board.cannons.findIndex(Boolean);
  if (lane === -1) throw new Error('cannonLane: no cannon on the board');
  return lane as Lane;
}

function frontmostRobotLane(board: RunState['board']): Lane | null {
  const onBoard = board.robots.filter((robot) => robot.col !== null);
  if (onBoard.length === 0) return null;
  onBoard.sort((a, b) => a.col! - b.col! || a.lane - b.lane);
  return onBoard[0]!.lane;
}

function playWave1WithFollowBot(seed: string): { finalPhase: RunState['phase']; damageEvents: GameEvent[] } {
  let state = newRun(seed);
  const damageEvents: GameEvent[] = [];
  const MAX_TURNS = 100;
  let turns = 0;

  while (state.waveIndex === 0 && state.phase === 'planning') {
    if (turns >= MAX_TURNS) {
      throw new Error(`seed ${seed}: wave 1 didn't clear within ${MAX_TURNS} turns`);
    }
    const target = frontmostRobotLane(state.board);
    const current = cannonLane(state.board);
    if (target !== null && target !== current) {
      state = requireOk(
        applyCommand(state, { type: 'moveCannon', fromLane: current, toLane: target }, data),
      ).state;
    }
    const result = requireOk(applyCommand(state, { type: 'endTurn' }, data));
    turns++;
    for (const event of result.events) {
      if (event.type === 'BaseDamaged') damageEvents.push(event);
    }
    state = result.state;
  }

  return { finalPhase: state.phase, damageEvents };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? 0;
}

function summarize(values: number[]): { min: number; median: number; max: number } {
  return { min: Math.min(...values), median: median(values), max: Math.max(...values) };
}

describe('authored ladder waves 4–7 (task 21)', () => {
  it('ships seven untraited waves, last wave is wave-7, spawn constraints hold', () => {
    expect(data.waves.waves.map((wave) => wave.id)).toEqual([
      'wave-1',
      'wave-2',
      'wave-3',
      'wave-4',
      'wave-5',
      'wave-6',
      'wave-7',
    ]);
    expect(data.robots).toEqual([{ id: 'basic', trait: { type: 'none' }, isBoss: false }]);

    for (const [index, wave] of data.waves.waves.entries()) {
      expect(wave.spawns.length).toBeGreaterThanOrEqual(3);
      expect(wave.spawns.length).toBeLessThanOrEqual(6);
      expect(wave.spawns.every((spawn) => spawn.robot === 'basic')).toBe(true);
      expect(wave.spawns.every((spawn) => spawn.hp[1] <= 99)).toBe(true);
      const letters = new Set(
        wave.spawns.map((spawn) => spawn.lane).filter((lane) => typeof lane === 'string'),
      );
      expect(letters.size).toBeLessThanOrEqual(3);
      if (index >= 3) {
        const turns = [...new Set(wave.spawns.map((spawn) => spawn.turn))].sort((a, b) => a - b);
        for (let i = 1; i < turns.length; i++) {
          expect(turns[i]! - turns[i - 1]!).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });
});

describe('sensible-player bot clears wave 1 with zero detonations (task 17 requirement 2)', () => {
  it('seeds 1–100', () => {
    for (const seed of SEEDS) {
      const { finalPhase, damageEvents } = playWave1WithFollowBot(seed);
      expect(damageEvents, `seed ${seed}`).toEqual([]);
      expect(finalPhase, `seed ${seed}`).toBe('waveCleared');
    }
  });
});

describe('7-wave ladder balance (task 21)', () => {
  it(
    'sensible player wins seeds 1–100 above 40 base HP; shops are live; End-Turn-only loses',
    { timeout: LADDER_TIMEOUT_MS },
    () => {
      const records: SensibleRunStats[] = [];

      for (const seed of SEEDS) {
        const rec = playSensibleRun(seed, data);
        records.push(rec);
        expect(rec.phase, `seed ${seed} phase`).toBe('won');
        expect(rec.minBaseHp, `seed ${seed} min HP`).toBeGreaterThanOrEqual(40);

        for (const shop of rec.shops) {
          expect(shop.hadAffordable, `seed ${seed} shop after wave ${shop.afterWave}`).toBe(true);
        }
        const wave3Shop = rec.shops.find((shop) => shop.afterWave === 3);
        expect(wave3Shop, `seed ${seed} missing wave-3 shop`).toBeDefined();
        expect(wave3Shop!.cannonAffordable, `seed ${seed} second cannon by wave-3 shop`).toBe(true);

        for (const entry of rec.waveEntries) {
          if (entry.waveIndex < 3) continue;
          for (const robot of entry.robots) {
            expect(
              canExactKillInAtMostNHits(robot, entry.values, 2),
              `seed ${seed} wave ${entry.waveIndex + 1} HP ${robot.hp} trait ${robot.trait.type} not exact-killable in ≤2 hits`,
            ).toBe(true);
          }
        }

        const careless = playEndTurnOnlyRun(seed, data);
        expect(careless.phase, `seed ${seed} End-Turn-only`).toBe('lost');
      }

      const endTurns = records.map((rec) => rec.endTurns);
      const finalHp = records.map((rec) => rec.baseHp);
      const minHp = records.map((rec) => rec.minBaseHp);
      const waveCount = data.waves.waves.length;
      const perWave = Array.from({ length: waveCount }, (_, wave) =>
        summarize(records.map((rec) => rec.turnsPerWave[wave] ?? 0)),
      );
      const shopSummaries = [1, 2, 3, 4, 5, 6].map((afterWave) => {
        const visits = records.flatMap((rec) => rec.shops.filter((shop) => shop.afterWave === afterWave));
        const purchaseCounts: Record<string, number> = {};
        for (const visit of visits) {
          for (const item of visit.purchases) {
            purchaseCounts[item] = (purchaseCounts[item] ?? 0) + 1;
          }
        }
        return {
          afterWave,
          earned: summarize(visits.map((visit) => visit.earned)),
          spent: summarize(visits.map((visit) => visit.spent)),
          leftover: summarize(visits.map((visit) => visit.leftover)),
          coinsOnEnter: summarize(visits.map((visit) => visit.coinsOnEnter)),
          purchaseCounts,
        };
      });

      const summary = {
        seeds: records.length,
        endTurns: summarize(endTurns),
        finalBaseHp: summarize(finalHp),
        minBaseHp: summarize(minHp),
        turnsPerWave: perWave,
        shops: shopSummaries,
      };
      writeFileSync('/tmp/ladder-stats.json', `${JSON.stringify(summary, null, 2)}\n`);
      // Visible in the vitest log for Completion Notes.
      console.log(`LADDER_STATS ${JSON.stringify(summary)}`);
    },
  );
});
