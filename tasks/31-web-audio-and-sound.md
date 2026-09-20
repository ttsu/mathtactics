# 31 — Web Audio, Cue Table & Settings Sound Row

**Milestone:** M5 · **Layer:** state / ui / board · **Depends on:** — · **Branch:** `task/31-web-audio-and-sound`

## Task

Ship generated Web Audio and the Settings Sound row. Every kid-facing control and every
playback outcome that teaches (tile pop, impact, exact kill, bounce-back, clonk, detonation,
spawn, shop buy/nope, win/lose) makes a sound. Unlock already exists (`game/state/audio.ts`);
`settings.sound` already defaults on; nothing plays and Settings still asserts **no** Sound
text (`e2e/settings.spec.ts`).

Visual juice (trails, louder stars, purchase flight), art, gallery, and title are **out**.
This task wires sound to the placeholder beats that already play.

## References

- GDD v0.9 §0, §11.1, §11.8, §12.2 (skip/replay), §12.3, §12.4, §13, §18.4
- TR §2 (board ↔ ui ban), §9 (`presentation.json`), §10 (`settings.sound`), §11.4 (Director
  skip/stop), §14 (test handle), §15 (shared `AudioContext`)
- `game/state/audio.ts` (`getAudioContext`, `installAudioUnlock`)
- `game/state/storage.ts` (`DEFAULT_SETTINGS.sound === true`)
- `game/ui/SettingsScreen.tsx`, `e2e/settings.spec.ts` (must grow a Sound row; do **not**
  rename `menu-settings` / `settings` / `settings-hints` / `settings-home` /
  `settings-difficulty-*`)
- `game/board/playback/SegmentPlayer.ts`, `game/board/playback/Director.ts`
- `game/board/DragController.ts`, `game/board/dragTargets.ts` (`command` / `origin` / `invalid`)
- `game/ui/{MainMenu,DifficultyScreen,Hud,ShopScreen,WaveClearedOverlay,LevelClearedOverlay,WinScreen,LoseScreen,AllDoneScreen,UpdateBanner}.tsx`

## Context

GDD §12.2 already names rising pitch per tile, cannon thump, clonk, exact-kill celebration.
Those are visual today. M4 deferred the Sound row because a mute that changed nothing would
look broken (task 24). This task ships the player **and** the row together.

Board and UI cannot import each other (TR §2). The player lives in `/game/state` next to the
existing unlock helper. Phaser already receives the shared context so it will not open a
second one; **do not use Phaser's sound manager**.

iOS: `AudioContext.resume()` is async. `playCue` must call `resume()` itself (without
awaiting) when `state !== 'running'` and then start nodes in the same turn, so the first
pickup on the first gesture can be heard. The one-shot window listener is not enough.

## Requirements

### 1. Cue table in `presentation.json`

Add a schema'd `audio` object. No Hz, gain, duration, or filter corner in code — CLAUDE.md
rule 3. Starting numbers are the implementer's; record the chosen keys in Completion Notes
if you add any beyond this shape. **Keys below are locked.**

Aesthetic (GDD §12.4 / §18.4): tactile ASMR — rubber, wood, felt. Soft attack (about 4–20 ms),
short decay (most cues ≤ 400 ms; `exactKill` / `bounceBack` / `win` / `lose` may go to
~600 ms). Voice types **allowed:** `sine`, `triangle`, bandpassed `noise`. **Forbidden:**
square, saw, long delay/reverb. Peak per-voice gain before master is small (≤ ~0.15). A
3-lane chain must not clip or fatigue.

Closed cue-name set:

| Name | When | Job |
|---|---|---|
| `uiTap` | Every **enabled** kid-facing button listed in req. 5 | Soft click |
| `preview` | Sound toggle off → on | Proof the row works |
| `pickupTile` | Tile actually lifts (`hold`, or pending → `piece`) | Lift |
| `pickupCannon` | Cannon lifts | Heavier sibling of pickup |
| `dropTile` | Tile drop `command` or `origin` | Settle |
| `dropCannon` | Cannon drop `command` or `origin` | Heavier settle |
| `snapBack` | Tile or cannon drop `invalid` | Short dud |
| `trayTick` | Tray scroll crosses a whole slot | Quiet picker tick |
| `cannonThump` | `BallFired` (not also `LaneStarted`) | Lane begins |
| `tilePop` | `BallTransformed` | Operator-coloured pop; pitch from `chainDepth` |
| `impact` | `RobotDamaged` | Hit; optional louder when `doubled` |
| `kill` | `RobotDefeated` and `exact === false` | Smaller than exact |
| `exactKill` | `RobotDefeated` and `exact === true` | **Fixed** sparkle figure, not chain-end pitch |
| `bounceBack` | `RobotBouncedBack` | Remainder pop then downward suck (one cue, two notes) |
| `clonk` | `BallBlocked` | Unpitched wood; not a rising pop |
| `detonate` | `RobotDetonated` | Low hit on the base |
| `spawn` | `RobotSpawned` | Drop into col 7 |
| `buy` | Affordable shop card success | Not `uiTap` |
| `nope` | Unaffordable shop card | Shake's twin |
| `waveCleared` | `WaveCleared` **or** `LevelCleared` | Quiet sting, quieter than `win` |
| `win` | `RunWon` | Cheerful sting |
| `lose` | `RunLost` | Distinct from `win`, **not** sad |

`tilePop` tuning (locked behaviour, numbers in data):

```
hz = baseHz * depthRatio ^ (chainDepth - 1) * 2^(offsetSemitones/12)
```

- `add` / `sub` / `mul` each have `baseHz` (or a shared base plus `offsetSemitones`).
- `+` leans up, `−` leans down, `×` brighter (extra harmonic and/or higher offset).
- `chainDepth` still **rises** through a subtract. **Never** map ball `value` to Hz.

Also in `audio`: `masterGain`, `maxVoices` (stop oldest when over). A muted `playCue` starts
nothing.

Hand-built `GameData` fixtures need a `fakeAudioSettings()` next to
`tests/helpers/playbackSettings.ts` (same pattern). Every fixture that embeds `presentation`
must include it or `parseGameData` / typecheck will fail.

### 2. Player in `/game/state`

Extend `game/state/audio.ts` (or a sibling it re-exports). Sketch:

```ts
export type CueName =
  | 'uiTap' | 'preview' | 'pickupTile' | 'pickupCannon' | 'dropTile' | 'dropCannon'
  | 'snapBack' | 'trayTick' | 'cannonThump' | 'tilePop' | 'impact' | 'kill' | 'exactKill'
  | 'bounceBack' | 'clonk' | 'detonate' | 'spawn' | 'buy' | 'nope'
  | 'waveCleared' | 'win' | 'lose';

export function playCue(
  name: CueName,
  params?: { chainDepth?: number; kind?: 'add' | 'sub' | 'mul'; doubled?: boolean },
): void;

export function stopAllCues(): void;
```

- Reads `settings.sound` at call time (store). False → no voices, no last-cue append.
- Missing / closed context → no-op, never throw.
- `playCue` calls `resume()` if not running, then starts nodes (req. Context, iOS).
- `stopAllCues()` used by Director `stop` / skip / `skipAll`.
- Export from `game/state/index.ts`. Phaser Sound plugin stays unused.

**Event mapper** (Phaser-free, in `/game/state` so tests do not boot a scene):

```ts
export function cueForEvent(event: GameEvent): { name: CueName; params?: object } | null;
```

| Event | Cue |
|---|---|
| `BallFired` | `cannonThump` |
| `BallTransformed` | `tilePop` + `kind` from `tileId` + `chainDepth` |
| `RobotDamaged` | `impact` + `doubled` |
| `RobotDefeated` | `exactKill` or `kill` |
| `RobotBouncedBack` | `bounceBack` |
| `BallBlocked` | `clonk` |
| `RobotDetonated` | `detonate` |
| `RobotSpawned` | `spawn` |
| `WaveCleared`, `LevelCleared` | `waveCleared` |
| `RunWon` | `win` |
| `RunLost` | `lose` |
| everything else | `null` (incl. `BallMoved`, `LaneStarted`, `LaneEnded`, `BallExited`, `RobotAdvanced`, `RobotWaiting`, `CoinsChanged`, `BaseDamaged`, shop events, `OfferBought`) |

Shop purchase sound is **UI-fired** (`buy` / `nope`), not `cueForEvent(OfferBought)` — otherwise
it would double.

Unit tests on `cueForEvent` for every row above, including `exact: true` vs false and
`tileId` `add:` / `sub:` / `mul:`. Player tests use a fake context (record
`createOscillator` / `createGain` starts, or an injected sink): mute starts nothing; `stopAllCues`
stops started nodes; over-`maxVoices` stops the oldest.

### 3. Playback wiring

`SegmentPlayer.play` calls `playCue` from `cueForEvent(event)` at the **start** of that beat.
`finish()` / Director `stop()` / tap-to-skip / `skipAll()` call `stopAllCues()` so skipped
lanes do not beep after the board has jumped. `skipAnimation()` in tests is silent for
unplayed beats (voices never start, or they start and are immediately stopped — either is
fine; do not leave oscillators running).

**Replay plays sound** (GDD v0.9). `commitEvent` staying a no-op while `replaying` does not
mute the player.

Do not add a `uiTap` on canvas skip.

### 4. Drag wiring

In `DragController`:

- Play `pickupTile` / `pickupCannon` when the piece **actually lifts**. Overflowing-tray
  `pending` plays pickup only when the gesture becomes `piece`. Pending → `scroll` plays
  **no** pickup (and no snap).
- On `pointerup`: `command` or `origin` → `dropTile` / `dropCannon`. `invalid` → `snapBack`.
- `wasCanceled` / `cancel()`: silence (abandon, not a failed drop).
- Tray `scroll`: `trayTick` when the integer slot index changes, not on every pixel.

### 5. React wiring — every enabled kid-facing button

Play `uiTap` at the start of the enabled `onClick`, **except** shop cards (`buy` / `nope`).
Disabled / `inert` / `visibility: hidden` HUD buttons stay silent.

| Surface | Control | Cue |
|---|---|---|
| Main menu | Keep Going, New Game, Puzzles, Settings | `uiTap` |
| Difficulty picker | Back, Easy, Normal, Hard | `uiTap` |
| Settings | Hints, Easy, Normal, Hard, Home | `uiTap` |
| Settings | Sound off → on | `preview` (after the flag is on) |
| Settings | Sound on → off | `uiTap` **then** write `sound: false` (or `playCue` with a force flag). He must hear the off click. |
| HUD | Home, Replay, Undo, Go | `uiTap` |
| Shop | Affordable card | `buy` only |
| Shop | `insufficient_coins` | `nope` only |
| Shop | bought / unavailable | silence (GDD §8.6) |
| Shop | Next wave | `uiTap` |
| Wave-cleared / Level-cleared | Next | `uiTap` |
| Win / Lose | menu | `uiTap` |
| All done | Play again | `uiTap` |
| Update banner | Reload, Dismiss | `uiTap` |

A small helper (`playUiTap()` or `withSound('uiTap', fn)`) is fine; record the choice.
**Do not** sonify the debug menu, secret long-press, title secret-tap, or Go nudge.

### 6. Settings Sound row

- Icon (speaker) + the word *Sound*, same pattern as Hints. `data-testid="settings-sound"`.
  `aria-pressed` reflects `settings.sound`. `is-pressed` when sound is **on** (the default).
- Place **in a row with Hints** so the difficulty star three-way stays full width. Home stays
  the big control. Touch target ≥ 60 pt.
- Toggles call `setSettings`. Reload keeps the value (`loadSettings` / `saveSettings` already
  wired).
- Turning **on** plays `preview`. Turning **off** plays the last click (req. 5).
- **Do not** rename existing Settings testids. Flip the two e2e assertions that currently
  say the screen must not contain `/sound/i`.

### 7. Test handle

Add to `TestHandle` and TR §14:

```ts
getLastCues(): { name: string; params?: Record<string, unknown> }[];
clearLastCues(): void;
```

A ring of the cues that actually started voices (mute does not append). e2e uses this —
Playwright cannot hear oscillators. Record the ring size in Completion Notes.

Also update TR §9 (`presentation.json` audio), §11.4 (skip stops cues; replay plays them),
§15 (player + `playCue` + Settings row).

### 8. Tests / e2e

- `cueForEvent` table (req. 2).
- Player: mute, `stopAllCues`, maxVoices, no throw without a context.
- Drag unit tests if you can fire cues from a Phaser-free seam (the existing
  `dragTargets` tests stay; a thin wrapper that decides pickup/drop/snap from
  `DropResolution` + source kind is enough).
- e2e Settings: Sound visible, default `aria-pressed="true"`, toggle off → reload → still
  off; toggle on → `getLastCues()` includes `preview`. Touch target ≥ 60 pt.
- e2e: mute, load an exact-kill scenario, `endTurn` (let a beat start, or assert via
  `getLastCues` after a short wait **without** requiring full playback). At minimum:
  with sound on, `endTurn` on
  `scenarios/core/exact-kill-order-of-operations.scenario.yaml` eventually records
  `tilePop` and `exactKill` unless the test skips immediately — if skip-all is the only
  e2e handle, assert `cueForEvent` in unit tests and e2e only the Settings row + a
  `playCue` smoke via clicking New Game (`uiTap` in `getLastCues`).
- Existing settings / difficulty / run e2e stay green.

## Out of Scope

Visual juice (trails, louder exact-kill art, bounce-back / clonk redesign, purchase flight
into the Phaser tray). AI art. Seen-tiles gallery. Kid-facing title. Music. Volume slider.
Sample files. Debug sounds. Changing leftover HP. Difficulty overlay behaviour.

## Acceptance Criteria

- [ ] Generated Web Audio only; no binary sound assets; Phaser Sound unused
- [ ] All locked cue names exist in data; `tilePop` uses operator + `chainDepth`, never ball value
- [ ] Exact-kill sting is a fixed figure; bounce-back and clonk are distinct families
- [ ] Every enabled kid-facing button in req. 5 sounds; debug does not
- [ ] Pickup / drop / snap-back / tray tick / cannon thump / spawn play
- [ ] Shop buy / nope do not double with `uiTap`; inert cards silent
- [ ] Skip stops voices; Replay plays them; mute no-ops `playCue`
- [ ] Settings Sound row: `settings-sound`, default on, persists, preview on enable
- [ ] Existing Settings / difficulty testids unchanged
- [ ] `getLastCues` / `clearLastCues` on the test handle; TR §9, §11.4, §14, §15 updated
- [ ] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass
- [ ] iPad preview check (first-gesture sound, mute, exact kill, clonk, bounce-back, shop nope) — awaiting human

## Completion Notes

**Status:** Complete (iPad check pending)
**Completed:** 2026-09-20
**PR:** #57 · Preview: https://mathtactics.timtsu.com/pr/pr-57/
**Branch:** `cursor/31-web-audio-and-sound-cfef` (not `task/31-web-audio-and-sound`)

**Acceptance criteria:**
- [x] Generated Web Audio only; no binary sound assets; Phaser Sound unused — Met (`game/state/audio.ts`; Phaser still only receives the shared `audio.context`)
- [x] All locked cue names exist in data; `tilePop` uses operator + `chainDepth`, never ball value — Met (`presentation.json` `audio.foley.cues` + `audio.tilePop`; Foley `success` + per-cue theme `glass`; pitch from the GDD Hz curve converted to semitones)
- [x] Exact-kill sting is a fixed figure; bounce-back and clonk are distinct families — Met (Foley `sparkle` / `rise` / `thock` at −8 st — nearest built-ins, retune on iPad)
- [x] Every enabled kid-facing button in req. 5 sounds; debug does not — Met (`playUiTap()` on those `onClick`s; debug / title secret-tap / Go nudge untouched)
- [x] Pickup / drop / snap-back / tray tick / cannon thump / spawn play — Met (`DragController` + `cueForEvent` / `SegmentPlayer.play`)
- [x] Shop buy / nope do not double with `uiTap`; inert cards silent — Met (`ShopScreen` plays `buy`/`nope` only; disabled bought/unavailable cards never fire)
- [x] Skip stops voices; Replay plays them; mute no-ops `playCue` — Met (`SegmentPlayer.finish` → `stopAllCues`; Replay still calls `play`; mute skips voices and last-cue append)
- [x] Settings Sound row: `settings-sound`, default on, persists, preview on enable — Met (e2e `settings.spec.ts`)
- [x] Existing Settings / difficulty testids unchanged — Met
- [x] `getLastCues` / `clearLastCues` on the test handle; TR §9, §11.4, §14, §15 updated — Met (ring size **32**)
- [x] `npm test`, `typecheck`, `lint`, `build`, `test:e2e` pass — Met
- [ ] iPad preview check (first-gesture sound, mute, exact kill, clonk, bounce-back, shop nope) — awaiting human check on preview

**Verification:** npm test ✔ (835) · typecheck ✔ · lint ✔ · build ✔ · e2e ✔ (95, including Settings Sound row, preview cue, New Game `uiTap`, existing settings/difficulty/run specs)

**Deviations from spec:**
- **Branch name** is `cursor/31-web-audio-and-sound-cfef` (cloud-agent prefix), not `task/31-web-audio-and-sound`.
- **Pending overflowing-tray tap-up is silent.** Pickup only plays when the gesture becomes `piece`; a pending release calls `release()` with no drop/snap cue (spec: pending → scroll has no pickup and no snap; a tap that never leaves pending is the same family).
- **All cues through Foley** (human follow-up). Still generated Web Audio, no sample files. Homemade oscillator recipes and `masterGain` are gone. Theme is `mechanical` (clicky buttons, not a tone). Tile pickup is Foley `tap`, drop is `thock`. `tilePop` is Foley `success` with per-cue theme `glass` so operator pops stay bright and melodic under a mechanical global theme. Teaching names are nearest Foley built-ins plus `pitch`/`volume` in data.

**Architectural decisions made:**
- **`bindAudio({ soundEnabled, audio })`** from `game/main.tsx` instead of importing the store into `audio.ts` (avoids a cycle; tests inject mute + recipes).
- **`playUiTap()`** is the UI helper (req. 5). Shop cards call `playCue('buy'|'nope')` directly.
- **Injected `FoleyEngine`** for player unit tests; production uses `@foleyjs/core`.
- **Phaser-free drag seam** in `game/state/cues.ts`: `cueForPickup` / `cueForDrop` / `traySlotChanged`.
- **Extra data keys**, all in `presentation.json` `audio`: `maxVoices`, `impactDoubledGain`, `tilePop.{depthRatio,add,sub,mul}`, `foley.{theme,volume,space,cues}` with per-cue Foley `name` / `pitch` / `volume` / optional `theme`.
- **Foley `play()` only** — not `bind()`. Phaser drags have no DOM attributes; mute and last-cues stay on `playCue`. `getAudioContext()` reuses Foley's context via `getAnalyser().context`. `tilePop` pitch is `12 * log2(hz / add.baseHz)` so operator colour and `chainDepth` still rise, never from ball value.

**Design questions raised:**
- Teaching Foley names (`exactKill` → `sparkle`, `bounceBack` → `rise`, `lose` → `off`, …) are starting nearest-cue picks. Retune `audio.foley.cues` after the iPad listen if a built-in is the wrong family.

**Known issues / follow-up:**
- First-gesture / exact-kill / clonk / bounce-back / shop-nope / mechanical tap-thock / **glass-theme success tilePop vs clicky buttons** still need an iPad listen on the preview. Shop `buy` also maps to Foley `success` but stays on the global mechanical theme.
- Later juice tasks may retune `audio.foley` but must not rename locked game cue names.

**Files created:** `game/state/cues.ts`, `tests/game/cues.test.ts`
**Files modified:** `data/presentation.json`, `sim/data/schemas.ts`, `game/state/audio.ts`, `game/state/index.ts`, `game/state/testHandle.ts`, `game/main.tsx`, `game/board/playback/SegmentPlayer.ts`, `game/board/DragController.ts`, `game/ui/{SettingsScreen,MainMenu,DifficultyScreen,Hud,ShopScreen,WaveClearedOverlay,LevelClearedOverlay,WinScreen,LoseScreen,AllDoneScreen,UpdateBanner,icons}.tsx`, `game/ui/ui.css`, `TECHNICAL_REFERENCE.md`, `TASKS.md`, `CLAUDE.md`, `e2e/{settings,difficulty}.spec.ts`, `tests/helpers/playbackSettings.ts`, fake `GameData` fixtures, `tests/game/{audio,testHandle,store}.test.ts`, `tests/sim/data/load.test.ts`, `package.json`

**Notes for next agent:**
- Retune sound in `data/presentation.json` `audio.foley` only. Locked game cue names are unchanged; Foley ids (`tap`, `thock`, …) are the mapping. `playCue` is a no-op until `bindAudio` has run (`game/main.tsx`). Last-cue ring is 32. Shop purchase sound is UI-fired, not `cueForEvent(OfferBought)`. Do not call Foley `bind()` for board drags.

