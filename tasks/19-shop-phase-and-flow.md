# 19 — Shop Phase, Commands & Run Flow

**Milestone:** M3 · **Layer:** sim / state · **Depends on:** 18 · **Branch:** `task/19-shop-phase-and-flow`

## Task

Make the shop part of a run: the `shop` phase, the `openShop` / `buyOffer` commands, `nextWave` moving from the
shop into the next wave, purchase effects (tile → tray, cannon → topmost empty slot, upgrade → base value), and
the removal of M2's wave tile rewards.

## References

- GDD §8.1–8.6, §10.2, §10.4, §10.5 (removed by this task), §4 step 5 · TR §4, §5, §6, §7, §9, §10, §12, §13
- Task 18's Completion Notes (`rollShop`, pricing, `ShopOffer` shape)

## Context

Today a cleared non-final wave ends in phase `waveCleared` with authored reward tiles already appended to the
tray (`TilesGranted`), and the wave-cleared overlay's ▶ dispatches `nextWave` (`game/state/waveFlow.ts`
`continueToNextWave`). `applyCommand` returns `wrong_phase` for `buyOffer`/`leaveShop`.

After this task the between-wave flow is:

```
wave clears → phase `waveCleared`  (overlay: star, wave dots, coins)
  ▶ Next    → `openShop`  → phase `shop`   (offers rolled once, stored in the run)
  ▶ Next wave → `nextWave` → phase `planning` of the next wave
```

**`leaveShop` is folded into `nextWave`** — leaving the shop *is* starting the next wave in v1, and two commands
doing one job is a bug farm. `leaveShop` is removed from the `Command` union (TR §5 updated); `nextWave` now
requires phase `shop` instead of `waveCleared`.

## Requirements

1. **Remove the M2 wave-reward stand-in** (GDD §10.5): drop `reward` from `waves.json` and its schema (including
   the "last wave has no reward" rule), stop emitting `TilesGranted` from `resolveTurn`'s END CHECK, and delete
   `waveRewardTiles` from `waveFlow.ts`. The shop is the only way tiles enter a run. `TilesGranted` itself
   **stays** in the event union — requirement 4 reuses it for purchases (update its doc comment).

   Blast radius (`rg -i 'reward|TilesGranted'`), so none of it is missed: `data/waves.json`,
   `sim/data/schemas.ts`, `sim/resolve/resolveTurn.ts`, `sim/core/types.ts`, `game/state/waveFlow.ts`,
   `game/ui/WaveClearedOverlay.tsx`, `game/ui/ui.css`, `game/board/playback/timeline.ts` (`RUN_END_TYPES` —
   `TilesGranted` no longer appears in an `end` group), `data/presentation.json` (`screens.rewardStaggerMs`),
   `scenarios/run/wave-clear-coins-and-tiles.scenario.yaml` and `final-wave-clear-wins.scenario.yaml`, plus the
   tests in `tests/sim/{data,resolve,commands}`, `tests/game/*`, `tests/ladder.test.ts`,
   `tests/helpers/dragSettings.ts`, `e2e/waves.spec.ts` and `e2e/playback.spec.ts`. Scenario and wave-flow tests
   already use inline `waves:` fixtures (task 16), so retuning is safe — but the reward assertions in them go.

2. **`openShop`** (`/sim/commands/openShop.ts`): requires phase `waveCleared` (else `wrong_phase`). Calls
   `rollShop(waveIndex + 1, state, data)` — `afterWave` is 1-based (`waveIndex + 1`); comment the conversion.
   Stores `shop: { afterWave, offers }`, sets phase `shop`, writes the returned `rng` back onto `state.rng`
   (only the `shop` stream has changed), and emits **no events** (like a planning command — there is nothing
   for the board to play). Offers are rolled **once, here**, so a reopened app shows the same offers with the
   same slots already bought (GDD §8.5; no reroll-by-reload). Add `{ type: 'openShop' }` to the `Command`
   union; remove `{ type: 'leaveShop' }`.

3. **`buyOffer { slot }`** (`/sim/commands/buyOffer.ts`): requires phase `shop`. Errors:
   - `offer_unavailable` — unknown slot, slot already `bought`, or the cannon slot with `available: false`.
   - `insufficient_coins` — `coins < offer.price`.

   On success: `coins -= price`, the slot is marked `bought: true` (one purchase per slot per visit, GDD v0.6 §0),
   and the effect applies. **Never** advances `rng.shop` — offers are already rolled.

4. **Purchase effects and events**, group `"shop"`, in this order per purchase:
   `OfferBought` → the effect event → `CoinsChanged { delta: −price, reason: 'purchase' }`.

   | Slot | Effect | Effect event |
   |---|---|---|
   | `tile:N` | a new `TilePiece` appended to the end of `tray` (GDD §8.6), id from `allocatePieceId` (`piece:${nextIds.piece}`) and also inserted into `pieces` | `TilesGranted { tiles: [{ pieceId, tileId }] }` |
   | `cannon` | `board.cannons[lane] = true` for the **topmost empty** slot (lowest lane index with `false`, GDD §8.6/§18.1) | `CannonPlaced { lane }` |
   | `upgrade` | `cannonBaseValue += 1`, `upgradesBought += 1`, applies to every cannon at once (GDD §5.1) | `BaseValueChanged { from, to }` |

   Add `OfferBought`, `CannonPlaced`, and `BaseValueChanged` to the `GameEvent` union (TR §7) — they are
   sketched in the TR but missing from `sim/core/types.ts`. `CoinsChanged.reason: 'purchase'` already exists.
   Event `step` starts at 0 per purchase; all three events share `group: "shop"`.

   A bought cannon never enters the tray. Buying a cannon when every slot is full is impossible (requirement 3's
   `available: false` covers it) — assert it, don't handle it silently.

5. **`nextWave` now leaves the shop**: requires phase `shop` (change the guard in `applyCommand`; today it
   requires `waveCleared`), clears `shop: null` inside `buildNextWave`, and otherwise behaves exactly as
   today (`waveIndex += 1`, roll the wave from the `wave` stream, `turn = 1`, spawn turn 1, phase `planning`,
   `undo: []`, `lastTurnEvents: []`). Unbought offers vanish (GDD §8.3); coins, tray, pieces, cannons,
   `cannonBaseValue`, `upgradesBought`, `exactKills`, and `baseHp` carry over. The last wave never reaches
   `waveCleared` (it goes to `won`), so `openShop`/`nextWave` are never called after it.

6. **Undo never reverts a purchase** (GDD §4.3): `undo` is refused outside phase `planning`, and `buyOffer` pushes
   nothing onto `undo`. Add a test — this is a rule, not an accident of the current guard.

7. **`schemaVersion` 2 → 3** in `economy.json`. `RunState` gains a real `ShopState` and waves lose `reward`, so any
   in-flight save is silently discarded on load (TR §13 — no migrations in v1).

8. **Store wiring** (`/game/state`):
   - **A dispatch whose result phase is `shop` never starts playback.** `buyOffer` returns events for tests and
     scenarios, but there is no board animation for a purchase and the board is behind a modal screen — so the
     store commits `display` from the new run immediately, exactly as it already does for `newRun`/`nextWave`.
     In `store.ts` `dispatch`, the current `if (result.events.length > 0)` branch starts playback; change it to
     also skip when `result.state.phase === 'shop'` (and still update `display` from the new run, and **keep**
     the existing `lastTurn` snapshot — a purchase must not clear Replay). `openShop` already takes the
     no-events branch. `lastTurnEvents` on `RunState` is untouched by a purchase, so the Replay snapshot
     survives a shop visit.
   - **`/game/state/shopFlow.ts`** (framework-free, unit-tested, mirroring `waveFlow.ts`): `openShopScreen(store)`
     (guard phase `waveCleared` → dispatch `openShop` → `setScreen('shop')`), `buyOffer(store, slot)`,
     `leaveShopToNextWave(store)` (guard phase `shop` → dispatch `nextWave` → `setScreen('game')`), and
     `shopOffers(state)`. Guard every entry point on phase, so a double tap cannot open two shops or start two
     waves — do not rely on `wrong_phase` for UI state (the task 16 rule).
   - **Resume:** `isResumable` in `runFlow.ts` accepts phase `shop`, and `continueRun` lands on
     `screen: 'shop'` for such a run (`screen: 'game'` otherwise). A run saved in the shop must reopen with the
     same offers and the same bought slots.
   - **⌂ Home is not available in the shop** (the HUD only renders on `screen: 'game'`). The run is saved in phase
     `shop`, so ▶ Continue returns to it. Note this in the TR rather than adding a second exit.

9. **Wave-cleared overlay becomes the coin beat** (`WaveClearedOverlay.tsx`): the reward chips are gone, so it shows
   the star, the wave dots, and the **wallet** with the wave-clear bonus popping in (`+3` 🪙) — derived from the
   `CoinsChanged { reason: 'waveCleared' }` event in `run.lastTurnEvents` via a new `waveClearCoins(run)` in
   `waveFlow.ts`, the same way `waveRewardTiles` derived chips. Its ▶ now calls `openShopScreen`. Any new selector
   returning an array or object must return a **stable reference** for the empty case (task 16's `NO_REWARDS`
   lesson: a fresh `[]` from a Zustand selector loops React forever).

10. **A placeholder `ShopScreen`** so `main` is never stranded: wallet, the offer list as plain text rows with a
    buy button each (`data-testid="shop-offer-<slot>"`, e.g. `shop-offer-tile:0`), and a big ▶ *Next wave*
    (`data-testid="shop-next"`, label *Next wave* per GDD §11.1). Render it from `App.tsx` when
    `screen === 'shop'`. Task 20 replaces it wholesale. Without this, clearing a wave lands in phase `shop`
    with nothing rendered — the exact stranding bug tasks 14 and 16 each hit once. Do **not** implement
    `shopNew`, NEW stickers, or `addSeenMany` — those are task 20.

## Tests

- Unit (`tests/sim/commands/`): `openShop` phase guard, offers stored, `rng.shop` advanced, no events;
  `buyOffer` both errors, coin deduction, one-purchase-per-slot, tray append order, topmost-empty-slot cannon
  placement, upgrade raising `cannonBaseValue` for all cannons, `rng` untouched; `nextWave` phase guard and
  `shop: null`; `undo` refused in the shop.
- **Scenarios** (`/scenarios/shop/`, `npm run sim -- scenarios`), asserting on the event list per CLAUDE.md rule 2:
  `buy-tile-goes-to-tray`, `buy-cannon-topmost-empty-slot`, `buy-upgrade-raises-every-lane-ball` (buy, then
  `nextWave`, then `endTurn` and assert `BallFired.value`), `insufficient-coins-expect-error`,
  `already-bought-expect-error`, `cannon-offer-unavailable-at-max`, `unbought-offers-vanish-on-next-wave`,
  `purchase-does-not-advance-the-wave-stream` (same wave rolled with and without a purchase → identical spawns).
  Extend the scenario parser (TR §12). Grammar, so task 19 and the scenarios agree:

  - `phase: shop` (and still `planning` / `waveCleared` / etc. when needed). Default remains `planning` for a
    `board` scenario.
  - `shop:` — an inline list of `ShopOffer` objects (the TR §4 discriminated union). When present, installed
    as `RunState.shop = { afterWave: waveIndex + 1, offers }` so a scenario can pin exact offers without RNG.
    A `phase: shop` scenario without `shop:` is an error.
  - `cannons:` — length-5 boolean array, overrides `board.cannons` (so "topmost empty slot" and "at max" are
    pin-able without encoding five `C` tokens).
  - `upgradesBought:` — integer, default 0.
  - Commands: string `'openShop'`; shorthand `{ buy: "tile:0" }` / `{ buy: "cannon" }` / `{ buy: "upgrade" }`
    (slot is a `ShopSlotId` string). Full `{ type: 'buyOffer', slot }` objects also parse.
  - `expectState.shop` — partial match, same helper as the rest of `expectState`.

  A typical shop scenario starts `phase: shop` with a pinned `shop:` block and a `buy` command — it never
  calls `openShop`. The `purchase-does-not-advance-the-wave-stream` scenario *does* call `openShop` from
  `waveCleared` so it exercises the roll.
- Store/unit: a `buyOffer` dispatch does not start playback and updates `display.coins` at once; `shopFlow` guards;
  `isResumable`/`continueRun` for a shop-phase save; a schema-version-2 save is discarded.
- e2e (WebKit iPad): clear a non-final wave (inline `waves:` fixture, as task 16 established) → overlay ▶ → shop
  screen → buy one tile → ▶ *Next wave* → planning with the tile in the tray; reload inside the shop → ▶ Continue →
  the same offers with the same slot still marked bought.

## Acceptance Criteria

- [ ] Wave rewards are gone from data, schema, resolution and UI; the shop is the only tile source
- [ ] `openShop` / `buyOffer` / `nextWave` implement GDD §8.6 with the event order of requirement 4
- [ ] Offers are rolled once and survive a reload; unbought offers vanish on leaving
- [ ] A purchase never starts playback, never advances the `wave` stream, and cannot be undone
- [ ] A run saved in the shop resumes into the shop
- [ ] `schemaVersion` is 3
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e`, `npm run sim -- scenarios` pass

## Completion Notes

**Status:** Complete
**Completed:** 2026-09-16
**PR:** not opened (stacked on `cursor/18-shop-data-and-offers-8f5d`; user asked to skip `gh pr create`)

**Acceptance criteria:**
- [x] Wave rewards are gone from data, schema, resolution and UI; the shop is the only tile source — Met
- [x] `openShop` / `buyOffer` / `nextWave` implement GDD §8.6 with the event order of requirement 4 — Met
- [x] Offers are rolled once and survive a reload; unbought offers vanish on leaving — Met (`e2e/shop.spec.ts`, `unbought-offers-vanish-on-next-wave`)
- [x] A purchase never starts playback, never advances the `wave` stream, and cannot be undone — Met
- [x] A run saved in the shop resumes into the shop — Met
- [x] `schemaVersion` is 3 — Met (`data/economy.json`)
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e`, `npm run sim -- scenarios` pass — Met

**Verification:** npm test ✔ (57 files / 839 tests) · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (67 webkit, including shop buy + shop reload) · `npm run sim -- scenarios` ✔ (39/39)

**Deviations from spec:**
- Branch name is `cursor/19-shop-phase-and-flow-8f5d` (stacked-PR convention) rather than `task/19-shop-phase-and-flow`.
- The wave-cleared overlay ▶ stays icon-only (`aria-label="Next"`), matching the pre-M3 overlay. The shop's ▶ carries the GDD §11.1 label *Next wave*.
- `purchase-does-not-advance-the-wave-stream.scenario.yaml` pins wave-2 HP at `[7, 7]` and buys after `openShop`. A unit test in `tests/sim/commands/openShop.test.ts` compares the same seed with and without a purchase.
- Ladder wave-2/3 reward-tile reachability tests are removed (comment only); the unlosable-M2 worst-case test and the wave-1 sensible-player test remain. End-Turn-only and termination bots now `openShop` then `nextWave` between waves.

**Architectural decisions made:**
- `buyOffer` returns events itself (`ApplyCommandResult`); `openShop` uses the no-events planning path.
- Store `dispatch` skips playback when `result.state.phase === 'shop'` (events still exist for tests/scenarios). `lastTurn` is kept because purchases do not rewrite `lastTurnEvents`.
- `continueRun` maps phase `shop` → `screen: 'shop'`, everything else resumable → `'game'`.
- Placeholder `ShopScreen` disables a buy button when the slot is already bought or the cannon is `available: false`. Task 20 replaces the screen.

**Design questions raised:**
- None.

**Known issues / follow-up:**
- None beyond task 20's wholesale shop UI (NEW stickers, seen log, card layout).

**Files created:** `sim/commands/openShop.ts`, `sim/commands/buyOffer.ts`, `game/state/shopFlow.ts`, `game/ui/ShopScreen.tsx`, `e2e/shop.spec.ts`, `tests/sim/commands/{openShop,buyOffer}.test.ts`, `tests/game/shopFlow.test.ts`, `scenarios/shop/*.scenario.yaml` (8 files)
**Files modified:** `data/{economy,waves}.json`, `sim/core/types.ts`, `sim/data/schemas.ts`, `sim/resolve/resolveTurn.ts`, `sim/commands/{applyCommand,index,nextWave}.ts`, `sim/scenario/{parse,run}.ts`, `game/state/{store,runFlow,waveFlow}.ts`, `game/ui/{App,WaveClearedOverlay,ui.css}`, `game/board/playback/timeline.ts`, run/wave/e2e specs and matching unit tests, `TASKS.md`, this file

**Notes for next agent:**
- Shop commands and run flow are live. Task 20 owns `shopNew`, `addSeenMany`, NEW stickers, and replacing `ShopScreen`. Do not roll offers again on render — they live on `RunState.shop` after `openShop`. `afterWave = waveIndex + 1`. `schemaVersion` is already 3. HUD is not on `screen === 'shop'`; Continue is the way back in. Wire seen-log writes in `openShopScreen`, not in `/sim`.

