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

**Status:** Complete
**Completed:** 2026-09-16
**PR:** #35 · stacked on #34 (`cursor/19-shop-phase-and-flow-8f5d`)

**Acceptance criteria:**
- [x] Five fixed-position cards, wallet, owned-tiles strip and ▶ *Next wave*, all icon-led and ≥ 60 pt — Met (e2e touch targets; owned strip empty until a tile is bought or already on the board)
- [x] Buying works from the real screen; refusals shake and change nothing — Met (`e2e/shop.spec.ts`)
- [x] The upgrade card reads `1 → 2`; the cannon card keeps its slot dimmed at 5 cannons — Met (upgrade shows live `cannonBaseValue → cannonBaseValue + 1`; cannon `available: false` is `unavailable` / disabled and keeps its slot). Wave-1 e2e fixtures with `baseValue: 5` therefore read `5 → 6`.
- [x] NEW stickers appear only for never-offered tile types and persist for the whole visit — Met
- [x] Tile-face rendering exists in exactly one place — Met (`game/state/tileFace.ts`; `tileLabel` / board colour are one-liners over it)
- [x] Timings in `presentation.json` — Met
- [ ] Legibility on the iPad preview — Not met: awaiting human check on preview
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met

**Verification:** npm test ✔ (59 files / 853 tests) · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (70 webkit)

**Deviations from spec:**
- Branch name is `cursor/20-shop-screen-and-seen-log-8f5d` (stacked-PR convention) rather than `task/20-shop-screen-and-seen-log`.
- Wave-cleared overlay wallet uses `CoinStack` instead of the 🪙 emoji; `e2e/waves.spec.ts` now asserts `+3` (the numeral), not `+3 🪙`. Overlay bonus delay still uses `rewardStaggerMs`; shop wallet count-down uses `shopWalletCountMs` (not reused on the overlay).
- Upgrade card shows live `run.cannonBaseValue → cannonBaseValue + 1` rather than the frozen offer `fromValue → toValue`, so the from-value updates after a purchase.
- `loadScenario` / `loadState` for phase `shop` now set `screen: 'shop'` (was always `'game'`) so a pinned 0-coin shop is tappable in e2e.
- Bought-card second tap in e2e uses `click({ force: true })` because the card is `disabled` (Playwright otherwise waits for enabled).

**Architectural decisions made:**
- Seen-log wiring: storage stays closed over in `createAppStore`. Added store action `recordShopVisit(tileIds)` which `loadSeen`s, snapshots unseen ids into `shopNew` (`NO_SHOP_NEW` when none), then `addSeenMany`. `openShopScreen` calls that action after a successful `openShop`. `leaveShopToNextWave` sets `shopNew: NO_SHOP_NEW`. `/sim` never imports storage.
- `buyOffer` in `shopFlow.ts` returns the dispatch result so unaffordable taps can shake on `insufficient_coins` without disabling the card.
- Card interaction state is `shopCardStatus(offer, coins)` in `game/state/shopCard.ts` (pure, no React).

**Design questions raised:**
- None.

**Known issues / follow-up:**
- Reloading inside the shop loses NEW stickers (`shopNew` is memory-only; types are already in `seen`). Acceptable v1; do not put `shopNew` on `RunState`.
- Browsable collection screen remains M5.
- Human iPad legibility check still needed (numbers are large; NEW is a yellow corner sticker; cannon glyph is a simple side-on shape).

**Files created:** `game/state/tileFace.ts`, `game/state/shopCard.ts`, `game/ui/CoinStack.tsx`, `game/ui/TileFaceChip.tsx`, `tests/game/tileFace.test.ts`, `tests/game/shopCard.test.ts`
**Files modified:** `game/ui/{ShopScreen,WaveClearedOverlay,icons,ui.css}.tsx/.css`, `game/board/pieces.ts`, `game/state/{store,shopFlow,storage,testHandle,index}.ts`, `data/presentation.json`, `sim/data/schemas.ts`, `tests/helpers/dragSettings.ts`, `tests/game/{storage,shopFlow,testHandle}.test.ts`, `e2e/{shop,waves}.spec.ts`, `TECHNICAL_REFERENCE.md`, `TASKS.md`, this file

**Notes for next agent:**
- Shop UI is live. Task 21 authors ladder waves 4–7 and the Playtest 3 checklist; do not reroll offers on render — they live on `RunState.shop`. `schemaVersion` is 3. `shopNew` is store-only. Overlay bonus stagger is still `rewardStaggerMs`. Keep testids `shop`, `shop-offer-<slot>`, `shop-next`, `shop-wallet`. NEW testids are `shop-new-<slot>` (slot, not tile id — duplicate `+1` offers would collide). H2 is still Not Started and is a task-21 dependency.

