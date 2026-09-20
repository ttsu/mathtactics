// Shared Web Audio unlock + Foley cue player (TR §15, GDD §12.4, task 31).
//
// Lives in /game/state (framework-free) because both /game/board and /game/ui play sounds
// and neither may import the other (TR §2). Phaser's sound manager stays unused. One
// AudioContext: Foley's, reused and handed to Phaser so the app never holds two. Every
// locked cue name plays through @foleyjs/core `play()` (not `bind()` — Phaser drags have
// no DOM attributes; mute and last-cues stay on `playCue`).

import {
  getAnalyser,
  play as foleyPlay,
  set as foleySet,
  unlock as foleyUnlock,
  type CueName as FoleyCueName,
  type ThemeName as FoleyThemeName,
} from '@foleyjs/core';
import type { GameData } from '../../sim/data/schemas';
import type { TileKind } from '../../sim/core/types';

export const CUE_NAMES = [
  'uiTap',
  'preview',
  'pickupTile',
  'pickupCannon',
  'dropTile',
  'dropCannon',
  'snapBack',
  'trayTick',
  'cannonThump',
  'tilePop',
  'impact',
  'kill',
  'exactKill',
  'bounceBack',
  'clonk',
  'detonate',
  'spawn',
  'buy',
  'nope',
  'waveCleared',
  'win',
  'lose',
] as const;

export type CueName = (typeof CUE_NAMES)[number];

export interface FoleyPlayOptions {
  pitch?: number;
  volume?: number;
}

/** Test double / live Foley. `play` names are Foley cue ids (`tap`, `thock`, …). */
export interface FoleyEngine {
  play(name: string, opts?: FoleyPlayOptions): { stop(): void } | undefined;
  set(opts: { muted?: boolean; volume?: number; theme?: string; space?: number }): void;
  unlock(): void;
  audioContext(): AudioContext | null;
}

export interface CueParams {
  chainDepth?: number;
  kind?: TileKind;
  doubled?: boolean;
}

export interface LastCue {
  name: string;
  params?: Record<string, unknown>;
}

/** Ring of cues that actually started voices. Mute / missing context do not append. */
export const LAST_CUE_RING = 32;

type AudioSettings = GameData['presentation']['audio'];
type FoleyMapping = AudioSettings['foley']['cues'][CueName];

export interface AudioBindings {
  soundEnabled(): boolean;
  audio(): AudioSettings | undefined;
}

interface ActiveVoice {
  stop(): void;
}

let shared: AudioContext | null = null;
let bindings: AudioBindings | null = null;
let lastCues: LastCue[] = [];
let activeVoices: ActiveVoice[] = [];
let foleyEngine: FoleyEngine = liveFoleyEngine();

function liveFoleyEngine(): FoleyEngine {
  return {
    play(name, opts) {
      return foleyPlay(name as FoleyCueName, opts);
    },
    set(opts) {
      foleySet({
        muted: opts.muted,
        volume: opts.volume,
        space: opts.space,
        theme: opts.theme as FoleyThemeName | undefined,
      });
    },
    unlock: foleyUnlock,
    audioContext() {
      const analyser = getAnalyser();
      return analyser !== null ? (analyser.context as AudioContext) : null;
    },
  };
}

/**
 * The app's single AudioContext, created lazily. Returns null where Web Audio is unavailable.
 * Prefers Foley's context so cues and Phaser share one graph.
 */
export function getAudioContext(): AudioContext | null {
  if (shared) return shared;
  try {
    foleyEngine.unlock();
    shared = foleyEngine.audioContext();
  } catch {
    shared = null;
  }
  if (!shared && typeof AudioContext !== 'undefined') {
    shared = new AudioContext();
  }
  return shared;
}

/**
 * Resumes `context` on the first `pointerdown` on `target`, then stops listening.
 * Returns a function that removes the listener if it hasn't fired yet.
 */
export function installAudioUnlock(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  context: Pick<AudioContext, 'state' | 'resume'>,
): () => void {
  const unlock = () => {
    remove();
    if (context.state !== 'running') {
      // A rejected resume leaves the context suspended; nothing useful to do about it here.
      context.resume().catch(() => undefined);
    }
    try {
      foleyEngine.unlock();
    } catch {
      // Foley creates/resumes its own graph; a missing AudioContext is a silent no-op.
    }
  };
  const remove = () => target.removeEventListener('pointerdown', unlock, { capture: true });
  target.addEventListener('pointerdown', unlock, { capture: true });
  return remove;
}

/** Wire the player to the live store (sound flag + Foley recipes). Call once from `game/main.tsx`. */
export function bindAudio(next: AudioBindings | null): void {
  bindings = next;
  const audio = next?.audio();
  if (audio !== undefined) {
    configureFoley(audio, next !== null && !next.soundEnabled());
  }
}

/** Inject Foley for unit tests. `undefined` restores `@foleyjs/core`. */
export function setFoleyEngine(engine: FoleyEngine | undefined): void {
  foleyEngine = engine ?? liveFoleyEngine();
}

export function getLastCues(): LastCue[] {
  return lastCues.slice();
}

export function clearLastCues(): void {
  lastCues = [];
}

export function playUiTap(): void {
  playCue('uiTap');
}

export function playCue(name: CueName, params?: CueParams): void {
  try {
    playCueInner(name, params);
  } catch {
    // Missing / closed context, or a start() that Web Audio rejects — never throw.
  }
}

export function stopAllCues(): void {
  const voices = activeVoices.splice(0);
  for (const voice of voices) {
    try {
      voice.stop();
    } catch {
      // already stopped
    }
  }
}

/** Test-only: stop voices, clear the ring, unbind store and Foley. */
export function resetAudioForTests(): void {
  stopAllCues();
  clearLastCues();
  bindings = null;
  foleyEngine = liveFoleyEngine();
  try {
    foleyEngine.set({ muted: false });
  } catch {
    // Foley settings are JS state; ignore if set throws
  }
}

function playCueInner(name: CueName, params?: CueParams): void {
  const audio = bindings?.audio();
  if (audio === undefined) return;
  const muted = bindings !== null && !bindings.soundEnabled();
  configureFoley(audio, muted);
  if (muted) return;
  playFoleyCue(name, audio, params);
}

function configureFoley(audio: AudioSettings, muted: boolean): void {
  foleyEngine.set({
    muted,
    volume: audio.foley.volume,
    theme: audio.foley.theme,
    space: audio.foley.space,
  });
}

function playFoleyCue(name: CueName, audio: AudioSettings, params?: CueParams): void {
  const mapping = audio.foley.cues[name];
  const opts = playOptions(name, audio, mapping, params);
  const handle = foleyEngine.play(mapping.name, opts);
  if (handle === undefined) return;
  reserveVoiceSlot(audio.maxVoices);
  trackVoice({ stop: handle.stop });
  recordCue(name, params);
}

function playOptions(
  name: CueName,
  audio: AudioSettings,
  mapping: FoleyMapping,
  params?: CueParams,
): FoleyPlayOptions | undefined {
  const pitch = foleyPitch(name, audio, mapping, params);
  const volume = foleyVolume(name, audio, mapping, params);
  if (pitch === undefined && volume === undefined) return undefined;
  const opts: FoleyPlayOptions = {};
  if (pitch !== undefined) opts.pitch = pitch;
  if (volume !== undefined) opts.volume = volume;
  return opts;
}

function foleyPitch(
  name: CueName,
  audio: AudioSettings,
  mapping: FoleyMapping,
  params?: CueParams,
): number | undefined {
  if (name !== 'tilePop') return mapping.pitch;
  return (mapping.pitch ?? 0) + tilePopSemitones(audio, params);
}

/** Operator colour + chainDepth as Foley transpose, never ball value (GDD §12.4). */
function tilePopSemitones(audio: AudioSettings, params?: CueParams): number {
  const kind = params?.kind ?? 'add';
  const depth = Math.max(1, params?.chainDepth ?? 1);
  const tuning = audio.tilePop[kind];
  const hz =
    tuning.baseHz *
    audio.tilePop.depthRatio ** (depth - 1) *
    2 ** (tuning.offsetSemitones / 12);
  return 12 * Math.log2(hz / audio.tilePop.add.baseHz);
}

function foleyVolume(
  name: CueName,
  audio: AudioSettings,
  mapping: FoleyMapping,
  params?: CueParams,
): number | undefined {
  if (name === 'impact' && params?.doubled === true) {
    return (mapping.volume ?? 1) * audio.impactDoubledGain;
  }
  return mapping.volume;
}

function reserveVoiceSlot(maxVoices: number): void {
  while (activeVoices.length >= maxVoices) {
    const oldest = activeVoices.shift();
    try {
      oldest?.stop();
    } catch {
      // already stopped
    }
  }
}

function trackVoice(voice: ActiveVoice): void {
  activeVoices.push(voice);
}

function recordCue(name: CueName, params?: CueParams): void {
  const recorded = recordedParams(params);
  lastCues.push(recorded === undefined ? { name } : { name, params: recorded });
  if (lastCues.length > LAST_CUE_RING) {
    lastCues.splice(0, lastCues.length - LAST_CUE_RING);
  }
}

function recordedParams(params?: CueParams): Record<string, unknown> | undefined {
  if (params === undefined) return undefined;
  const out: Record<string, unknown> = {};
  if (params.chainDepth !== undefined) out.chainDepth = params.chainDepth;
  if (params.kind !== undefined) out.kind = params.kind;
  if (params.doubled !== undefined) out.doubled = params.doubled;
  return Object.keys(out).length === 0 ? undefined : out;
}
