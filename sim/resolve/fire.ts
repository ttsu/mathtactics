// FIRE (GDD §4 step 3, §5, §3.5; TR §7): each lane whose cannon slot holds a cannon fires
// exactly one ball, independently of every other lane (GDD §5.1 — lanes never interact in v1).
// Pure: takes `state`/`data`, returns the events plus the updated board/coins/id counters;
// `resolveTurn.ts` folds those back into a new `RunState`.

import type { Cell, Col } from '../core/coords';
import { COLS, lanes } from '../core/coords';
import { allocateBallId } from '../commands/ids';
import { robotAt, tileAt } from '../commands/boardQueries';
import { applyTile } from '../core/tiles';
import type { Board, GameEvent, RunState } from '../core/types';
import type { GameData } from '../data/schemas';
import { resolveImpact } from './impact';

export interface FireResult {
  events: GameEvent[];
  board: Board;
  coins: number;
  nextIds: RunState['nextIds'];
}

/**
 * Resolves FIRE for every lane, 0 -> 4 (task 07 requirement 2). All events from this call share
 * one strictly-increasing `step` sequence (task 07 ruling) even though each lane's events also
 * carry their own `group: "fire:lane:<n>"` for playback.
 */
export function resolveFire(state: RunState, data: GameData): FireResult {
  const events: GameEvent[] = [];
  let step = 0;
  let board = state.board;
  let coins = state.coins;
  let nextIds = state.nextIds;

  for (const lane of lanes()) {
    if (!board.cannons[lane]) continue;
    const group = `fire:lane:${lane}`;

    const [ballId, allocated] = allocateBallId(nextIds);
    nextIds = allocated;

    events.push({ step: step++, group, type: 'LaneStarted', lane });

    let value = state.cannonBaseValue;
    const startCell: Cell = { lane, col: 0 };
    events.push({ step: step++, group, type: 'BallFired', ballId, lane, at: startCell, value });

    let chainDepth = 0;
    let hit = false;

    for (let col = 1; col < COLS; col++) {
      const cell: Cell = { lane, col: col as Col };
      const from: Cell = { lane, col: (col - 1) as Col };
      events.push({ step: step++, group, type: 'BallMoved', ballId, lane, from, to: cell });

      const robot = robotAt(board, cell);
      if (robot) {
        hit = true;
        const outcome = resolveImpact(robot, value);

        if (outcome.kind === 'blocked') {
          events.push({
            step: step++,
            group,
            type: 'BallBlocked',
            ballId,
            robotId: robot.robotId,
            at: cell,
            value,
            reason: outcome.reason,
          });
        } else {
          events.push({
            step: step++,
            group,
            type: 'RobotDamaged',
            robotId: robot.robotId,
            ballId,
            at: cell,
            ballValue: value,
            damage: outcome.damage,
            doubled: outcome.doubled,
            hpBefore: outcome.hpBefore,
            hpAfter: outcome.hpAfter,
          });

          if (outcome.bounceBack) {
            events.push({
              step: step++,
              group,
              type: 'RobotBouncedBack',
              robotId: robot.robotId,
              at: cell,
              hpBefore: outcome.hpBefore,
              hpAfter: outcome.hpAfter,
              overshoot: outcome.bounceBack.overshoot,
            });
          }

          if (outcome.result === 'exact' || outcome.result === 'kill') {
            events.push({
              step: step++,
              group,
              type: 'RobotDefeated',
              robotId: robot.robotId,
              at: cell,
              exact: outcome.result === 'exact',
            });
            board = {
              ...board,
              robots: board.robots.filter((r) => r.robotId !== robot.robotId),
            };

            const reason = outcome.result === 'exact' ? 'exactKill' : 'kill';
            const delta =
              outcome.result === 'exact' ? data.economy.income.exactKill : data.economy.income.kill;
            coins += delta;
            events.push({ step: step++, group, type: 'CoinsChanged', delta, total: coins, reason });
          } else {
            board = {
              ...board,
              robots: board.robots.map((r) =>
                r.robotId === robot.robotId ? { ...r, hp: outcome.hpAfter } : r,
              ),
            };
          }
        }

        break; // The ball is consumed on impact (GDD §5.3) — no tiles beyond it apply.
      }

      const pieceId = tileAt(board, cell);
      if (pieceId !== null) {
        const piece = state.pieces[pieceId];
        if (!piece) {
          throw new Error(
            `fire: cell ${cell.lane},${cell.col} references unknown piece "${pieceId}"`,
          );
        }
        const tileDef = data.tiles.find((t) => t.id === piece.tileId);
        if (!tileDef) {
          throw new Error(`fire: unknown tile id "${piece.tileId}"`);
        }

        const oldValue = value;
        value = applyTile(value, tileDef);
        chainDepth += 1;
        events.push({
          step: step++,
          group,
          type: 'BallTransformed',
          ballId,
          at: cell,
          tileId: tileDef.id,
          pieceId,
          oldValue,
          newValue: value,
          chainDepth,
        });
      }
    }

    if (!hit) {
      const lastCell: Cell = { lane, col: (COLS - 1) as Col };
      events.push({ step: step++, group, type: 'BallExited', ballId, lane, at: lastCell });
    }

    events.push({ step: step++, group, type: 'LaneEnded', lane });
  }

  return { events, board, coins, nextIds };
}
