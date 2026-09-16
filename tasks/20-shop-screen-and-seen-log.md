# 20 — Shop Screen, Seen-Tiles Log & NEW Badge

**Milestone:** M3 · **Layer:** ui / state · **Depends on:** 19 · **Branch:** `task/20-shop-screen-and-seen-log`

## Task

Build the real shop screen: five offer cards, the wallet, the tiles he already owns, purchase and refusal
feedback, a big ▶ *Next wave* — plus the seen-tiles log and the NEW sticker on a tile type this device has never
been offered.

## References

- GDD §8.1, §8.3, §8.4, §8.6, §8.7, §9.1, §11 (all of it), §12.2 req. 6 · TR §9 (`presentation.json`), §10, §11.3, §13
- Task 19's Completion Notes (`shopFlow.ts`, `ShopOffer`, the placeholder screen this replaces)
- `WaveClearedOverlay.tsx`, `LevelClearedOverlay.tsx`, `AllDoneScreen.tsx` — the established screen pattern
  (derived visibility, SVG glyphs, `screens.popInMs`, double-tap guard)

## Context

Task 19 ships a placeholder `ShopScreen` (text rows + a buy button each) and `shopFlow.ts`. `loadSeen`/`addSeen`
already exist in `game/state/storage.ts` under the path-scoped `seen` key and are **unused** — this task is their
first consumer. Tile chip rendering (operator glyph + number + category colour) is currently duplicated between
`game/board/pieces.ts` (`tileFace`) and `WaveClearedOverlay.tsx` (`OPERATOR_GLYPH`/`rewardLabel`), because
`/game/ui` may not import `/game/board` (TR §2).

## Requirements

1. **Hoist tile-face rendering** to framework-free `/game/state/tileFace.ts` (`tileFace(tileId) → { glyph, n,
   colorKey, starred }`) and have both `game/board/pieces.ts` and `/game/ui` use it. `colorKey` is the tile's
   `tiles.json` `color` (`green` / `blue` / `orange`); callers still resolve the hex via `presentation.json`
   `tileColors` — `tileFace` itself must not read presentation, so `/sim` tests and the board stay free of a
   colour-table dependency. Keep `tileLabel` as a one-liner over `tileFace` if the board still wants a string.
   The shop needs chips in three places (offer cards, owned strip, and the wave-cleared overlay); a third copy
   is not acceptable.

2. **Shop screen** (`game/ui/ShopScreen.tsx`, rendered for `screen === 'shop'` in `App.tsx`; the HUD does not
   render here). Replaces task 19's placeholder wholesale, keeping its testids (`shop-offer-<slot>`,
   `shop-next`) so the task-19 e2e keeps passing. Layout per GDD §8.3, left to right, positions **fixed**
   so they never move between visits:

   - **3 tile cards** — big operator and number (numbers are the largest element, GDD §11 pillar 2), category
     colour, a ★ for `×6`+ (`starred`), price below as a numeral **and** a coin stack (GDD §8.1).
   - **1 cannon card** — a cannon glyph plus 5 pips showing how many are owned. When `available` is `false`
     (5 owned) the card is dimmed and inert, keeping its slot (GDD v0.6 §0).
   - **1 upgrade card** — a cannon glyph with the base value written as **`1 → 2`** (`fromValue → toValue`), which
     reads without words and is itself a small piece of arithmetic (GDD v0.6 §0).
   - **Wallet** — the coin total, large, as a numeral and a coin stack. The stack is a small overlapping
     cluster of gold circles (a glyph, **not** one circle per coin — a 30-coin wallet must not grow). The
     numeral is the source of truth (GDD §11 pillar 2). Reuse the same glyph next to each card's price.
     Extract a `CoinStack` in `/game/ui` so the overlay, the cards, and the wallet share it.
   - **Owned tiles** — a read-only strip of the tiles he already has (`run.tray` plus tiles on the board), so
     "do I need another `+2`?" is answerable without leaving the screen. Scrolls or wraps; never pushes a card.
   - **▶ *Next wave*** — big, bottom-right, with the short label per GDD §11.1. Guarded against double taps.

3. **Purchase feedback.** Tapping an affordable card: the card pops, stamps itself bought (dimmed + tick), the
   wallet counts down to the new total, and the bought item appears in the owned strip (for a tile) / the pips (for
   a cannon) / the upgrade's `from` value everywhere (for an upgrade). **No cross-renderer flight** — nothing
   animates from this React screen into the Phaser tray in M3; the tray simply contains the tile when the shop
   closes. Full juice is M5.

4. **Refusal feedback.** Tapping a card he can't afford shakes the card and flashes its price. Tapping a bought or
   unavailable card does nothing. No dialog, no error text, no sentences (GDD §11 pillar 1).

5. **Seen-tiles log** (GDD §8.7): when the shop **opens**, every offered tile type is written to the `seen` key
   (`addSeenMany` — add this helper next to `addSeen` in `storage.ts`; storage failure still never throws),
   and the set of ids that were *not* already there is snapshotted into memory as `AppState.shopNew` (add the
   field to the store; TR §10 already sketches it; default `[]`, and a stable empty-array constant for the
   selector). Wire this in `openShopScreen` / `leaveShopToNextWave` (task 19's `shopFlow.ts`). The NEW sticker
   renders from that snapshot, so it stays put for the whole visit instead of vanishing under his finger.
   Cleared when the shop closes (`leaveShopToNextWave` sets `shopNew: []`).
   - Only **tile** offers are logged; the cannon and upgrade cards have no NEW state.
   - The log is additive, sorted, device-local, path-scoped, and survives runs and schema bumps (TR §13) — it is a
     discovery log, never power progression.
   - **Known limitation to record in Completion Notes:** reloading inside the shop loses the stickers (the types
     are already logged, and `shopNew` is memory-only). Acceptable in v1; do **not** put device-local state into
     `RunState` to fix it.

6. **A browsable collection screen is out of scope** (deferred to M5 with the art pass, GDD v0.6 §0). Ship the log
   and the sticker only.

7. **Timings in data** (`presentation.json` `screens`). No duration in a component (CLAUDE.md rule 3, TR §9).
   Ship these values (analogous to the existing screen timings — a recorded minor call, not a GDD number):

   | Key | Value | Used for |
   |---|---|---|
   | `shopCardStaggerMs` | 80 | delay between each of the 5 cards popping in |
   | `shopPurchasePopMs` | 220 | bought-card pop |
   | `shopWalletCountMs` | 280 | wallet numeral counting down to the new total |
   | `shopRefusalShakeMs` | 320 | unaffordable-card shake |
   | `shopNewPopMs` | 180 | NEW sticker pop |

   Keep `rewardStaggerMs` — the wave-cleared overlay still staggers the wallet pop with it (or reuse
   `shopWalletCountMs` there; pick one and use it in both, recorded in Completion Notes). Add the new keys
   to `PresentationFileSchema` and `fakeScreenSettings()`.

8. **Touch targets ≥ 60 pt** for every card and button; drag is not involved here, but a 7-year-old's finger still
   is. No reading required to understand any card.

## Tests

- Unit: `tileFace` for all 29 tiles (and that `pieces.ts` still renders identically); `shopNew` computed from
  `loadSeen` at open; `addSeenMany` is additive, sorted and de-duplicated; storage failure never throws (TR §13).
- Unit: a card's state machine — affordable / unaffordable / bought / unavailable — derived from
  `ShopOffer` + `run.coins`, as a pure helper so it is testable without React.
- e2e (WebKit iPad, inline `waves:` fixture): clear a wave → ▶ → shop shows 5 cards and the wallet from
  `getState().coins` → buy a tile (real tap) → card marked bought, wallet decremented, `getState().tray` grew →
  tap the same card again → nothing changes → ▶ *Next wave* → planning, tile draggable from the tray.
  A second run (same device, fresh `newRun`) shows **no** NEW sticker on a type offered in the first.
  Unaffordable card: install a 0-coin shop state → tap → wallet and `getState()` unchanged.
  All cards and buttons ≥ 60 pt.
- Screenshots (not committed) of the shop with and without NEW stickers for the iPad legibility check.

## Acceptance Criteria

- [ ] Five fixed-position cards, wallet, owned-tiles strip and ▶ *Next wave*, all icon-led and ≥ 60 pt
- [ ] Buying works from the real screen; refusals shake and change nothing
- [ ] The upgrade card reads `1 → 2`; the cannon card keeps its slot dimmed at 5 cannons
- [ ] NEW stickers appear only for never-offered tile types and persist for the whole visit
- [ ] Tile-face rendering exists in exactly one place
- [ ] Timings in `presentation.json`
- [ ] Legibility on the iPad preview (human check)
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass

## Completion Notes

_(filled in by `/finish-task`)_
