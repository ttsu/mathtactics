// `buyOffer` (GDD §8.6, TR §5/§7): one purchase during phase `shop`. Deducts coins, marks the
// slot bought, and applies the effect. Never advances `rng.shop` (offers are already rolled)
// and never pushes onto `undo` (GDD §4.3: undo never reverts a purchase).

import type { Lane } from '../core/coords';
import type { Command, GameEvent, RunState } from '../core/types';
import { allocatePieceId } from './ids';

export type BuyOfferResult =
  | { ok: true; state: RunState; events: GameEvent[] }
  | { ok: false; error: 'wrong_phase' | 'offer_unavailable' | 'insufficient_coins' };

export function buyOffer(
  state: RunState,
  cmd: Extract<Command, { type: 'buyOffer' }>,
): BuyOfferResult {
  if (state.phase !== 'shop' || state.shop === null) {
    return { ok: false, error: 'wrong_phase' };
  }

  const index = state.shop.offers.findIndex((offer) => offer.slot === cmd.slot);
  const offer = index === -1 ? undefined : state.shop.offers[index];
  if (
    offer === undefined ||
    offer.bought ||
    (offer.kind === 'cannon' && !offer.available)
  ) {
    return { ok: false, error: 'offer_unavailable' };
  }
  if (state.coins < offer.price) {
    return { ok: false, error: 'insufficient_coins' };
  }

  const coins = state.coins - offer.price;
  const offers = state.shop.offers.map((item, i) =>
    i === index ? { ...item, bought: true } : item,
  );
  let next: RunState = {
    ...state,
    coins,
    shop: { ...state.shop, offers },
  };

  const events: GameEvent[] = [
    {
      step: 0,
      group: 'shop',
      type: 'OfferBought',
      slot: offer.slot,
      kind: offer.kind,
      price: offer.price,
    },
  ];

  if (offer.kind === 'tile') {
    const [pieceId, nextIds] = allocatePieceId(next.nextIds);
    next = {
      ...next,
      nextIds,
      pieces: { ...next.pieces, [pieceId]: { pieceId, tileId: offer.tileId } },
      tray: [...next.tray, pieceId],
    };
    events.push({
      step: 1,
      group: 'shop',
      type: 'TilesGranted',
      tiles: [{ pieceId, tileId: offer.tileId }],
    });
  } else if (offer.kind === 'cannon') {
    const lane = next.board.cannons.findIndex((occupied) => !occupied);
    if (lane === -1) {
      throw new Error('buyOffer: cannon offer bought with every slot full');
    }
    const cannons = [...next.board.cannons];
    cannons[lane] = true;
    next = { ...next, board: { ...next.board, cannons } };
    events.push({ step: 1, group: 'shop', type: 'CannonPlaced', lane: lane as Lane });
  } else {
    const from = next.cannonBaseValue;
    const to = from + 1;
    next = {
      ...next,
      cannonBaseValue: to,
      upgradesBought: next.upgradesBought + 1,
    };
    events.push({ step: 1, group: 'shop', type: 'BaseValueChanged', from, to });
  }

  events.push({
    step: 2,
    group: 'shop',
    type: 'CoinsChanged',
    delta: -offer.price,
    total: coins,
    reason: 'purchase',
  });

  return { ok: true, state: next, events };
}
