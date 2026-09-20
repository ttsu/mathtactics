// Shared Web Audio unlock + generated cue player (TR §15, GDD §12.4, task 31).
//
// Lives in /game/state (framework-free) because both /game/board and /game/ui play sounds
// and neither may import the other (TR §2). Phaser's sound manager stays unused; one
// AudioContext is created here (Foley's, reused) and handed to Phaser so the app never holds two.
// Tactile cues (buttons, tile/cannon drag) play through @foleyjs/core `play()`. Teaching
// playback cues stay on the homemade oscillator recipes in presentation.json.

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

/** Cue names Foley performs. Teaching playback stays on homemade recipes. */
export const FOLEY_CUE_NAMES = [
  'uiTap',
  'preview',
  'pickupTile',
  'pickupCannon',
  'dropTile',
  'dropCannon',
  'snapBack',
  'trayTick',
] as const satisfies readonly CueName[];

type FoleyMappedCue = (typeof FOLEY_CUE_NAMES)[number];

export interface FoleyPlayOptions {
  pitch?: number;
  volume?: number;
}

/** Test double / live Foley. `play` names are Foley cue ids (`tap`, `press`, …). */
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
type CueVoice = AudioSettings['cues'][CueName]['voices'][number];

export interface AudioBindings {
  soundEnabled(): boolean;
  audio(): AudioSettings | undefined;
}

/** Test double: records started voices without a real AudioContext. */
export interface AudioTestSink {
  start(voice: { type: CueVoice['type']; hz?: number; peakGain: number }): { stop(): void };
}

interface ActiveVoice {
  stop(): void;
}

let shared: AudioContext | null = null;
let bindings: AudioBindings | null = null;
let testSink: AudioTestSink | null | undefined;
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
 * Prefers Foley's context so tactile cues, teaching cues, and Phaser share one graph.
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
  };
  const remove = () => target.removeEventListener('pointerdown', unlock, { capture: true });
  target.addEventListener('pointerdown', unlock, { capture: true });
  return remove;
}

/** Wire the player to the live store (sound flag + recipes). Call once from `game/main.tsx`. */
export function bindAudio(next: AudioBindings | null): void {
  bindings = next;
  const audio = next?.audio();
  if (audio !== undefined) {
    configureFoley(audio, next !== null && !next.soundEnabled());
  }
}

/** Inject a sink for unit tests (`null` = no context). `undefined` restores Web Audio. */
export function setAudioTestSink(sink: AudioTestSink | null | undefined): void {
  testSink = sink;
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

/** Test-only: stop voices, clear the ring, unbind store, sink, and Foley. */
export function resetAudioForTests(): void {
  stopAllCues();
  clearLastCues();
  bindings = null;
  testSink = undefined;
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

  if (testSink === undefined && playFoleyCue(name, audio, params)) return;

  const recipe = audio.cues[name];
  const compiled = compileVoices(name, recipe.voices, audio, params);
  if (compiled.length === 0) return;

  if (testSink === null) return;
  if (testSink !== undefined) {
    startViaSink(name, compiled, audio.maxVoices, params);
    return;
  }

  const context = getAudioContext();
  if (context === null || context.state === 'closed') return;
  if (context.state !== 'running') {
    // iOS: resume is async; start nodes in this same turn without awaiting.
    context.resume().catch(() => undefined);
  }
  startViaContext(name, compiled, audio, context, params);
}

function compileVoices(
  name: CueName,
  voices: readonly CueVoice[],
  audio: AudioSettings,
  params?: CueParams,
): CompiledVoice[] {
  const gainScale = name === 'impact' && params?.doubled === true ? audio.impactDoubledGain : 1;
  const out: CompiledVoice[] = [];
  const tileHz = name === 'tilePop' ? tilePopHz(audio, params) : undefined;

  for (const voice of voices) {
    const hz = voice.type === 'noise' ? undefined : (tileHz ?? voice.hz);
    if (voice.type !== 'noise' && hz === undefined) continue;
    out.push({
      type: voice.type,
      hz,
      offsetMs: voice.offsetMs ?? 0,
      attackMs: voice.attackMs,
      decayMs: voice.decayMs,
      peakGain: voice.peakGain * gainScale,
      filter: voice.filter,
    });
  }

  if (name === 'tilePop' && tileHz !== undefined) {
    const kind = params?.kind ?? 'add';
    const harmonicGain = audio.tilePop[kind].harmonicGain ?? 0;
    const harmonicRatio = audio.tilePop[kind].harmonicRatio ?? 2;
    const template = voices[0];
    if (harmonicGain > 0 && template !== undefined) {
      out.push({
        type: 'sine',
        hz: tileHz * harmonicRatio,
        offsetMs: template.offsetMs ?? 0,
        attackMs: template.attackMs,
        decayMs: template.decayMs,
        peakGain: harmonicGain * gainScale,
      });
    }
  }
  return out;
}

function tilePopHz(audio: AudioSettings, params?: CueParams): number {
  const kind = params?.kind ?? 'add';
  const depth = Math.max(1, params?.chainDepth ?? 1);
  const tuning = audio.tilePop[kind];
  return (
    tuning.baseHz *
    audio.tilePop.depthRatio ** (depth - 1) *
    2 ** (tuning.offsetSemitones / 12)
  );
}

function startViaSink(
  name: CueName,
  voices: readonly CompiledVoice[],
  maxVoices: number,
  params?: CueParams,
): void {
  const sink = testSink;
  if (sink === undefined || sink === null) return;
  let started = 0;
  for (const voice of voices) {
    reserveVoiceSlot(maxVoices);
    const handle = sink.start({
      type: voice.type,
      hz: voice.hz,
      peakGain: voice.peakGain,
    });
    trackVoice(handle);
    started += 1;
  }
  if (started > 0) recordCue(name, params);
}

function startViaContext(
  name: CueName,
  voices: readonly CompiledVoice[],
  audio: AudioSettings,
  context: AudioContext,
  params?: CueParams,
): void {
  let started = 0;
  const now = context.currentTime;
  for (const voice of voices) {
    reserveVoiceSlot(audio.maxVoices);
    const handle = startGraphVoice(context, voice, audio.masterGain, now);
    if (handle === null) continue;
    trackVoice(handle);
    started += 1;
  }
  if (started > 0) recordCue(name, params);
}

function startGraphVoice(
  context: AudioContext,
  voice: CompiledVoice,
  masterGain: number,
  now: number,
): ActiveVoice | null {
  const startAt = now + voice.offsetMs / 1000;
  const attack = voice.attackMs / 1000;
  const decay = voice.decayMs / 1000;
  const peak = voice.peakGain * masterGain;
  const stopAt = startAt + attack + decay + 0.02;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + Math.max(attack, 0.001));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + attack + decay);

  let source: OscillatorNode | AudioBufferSourceNode;
  let filter: BiquadFilterNode | null = null;
  if (voice.type === 'noise') {
    const buffer = noiseBuffer(context);
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    source = noise;
  } else {
    const osc = context.createOscillator();
    osc.type = voice.type;
    osc.frequency.setValueAtTime(voice.hz ?? 440, startAt);
    source = osc;
  }

  if (voice.filter) {
    filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(voice.filter.frequencyHz, startAt);
    filter.Q.setValueAtTime(voice.filter.Q, startAt);
    source.connect(filter);
    filter.connect(gain);
  } else {
    source.connect(gain);
  }
  gain.connect(context.destination);

  try {
    source.start(startAt);
    source.stop(stopAt);
  } catch {
    disconnectAll(source, filter, gain);
    return null;
  }

  const stop = () => {
    try {
      source.stop();
    } catch {
      // already stopped
    }
    disconnectAll(source, filter, gain);
  };
  source.onended = () => {
    forgetVoice(stop);
    disconnectAll(source, filter, gain);
  };
  return { stop };
}

function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.ceil(context.sampleRate * 0.5));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function disconnectAll(
  source: AudioNode,
  filter: AudioNode | null,
  gain: AudioNode,
): void {
  try {
    source.disconnect();
  } catch {
    // already disconnected
  }
  try {
    filter?.disconnect();
  } catch {
    // already disconnected
  }
  try {
    gain.disconnect();
  } catch {
    // already disconnected
  }
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

function forgetVoice(stop: () => void): void {
  activeVoices = activeVoices.filter((voice) => voice.stop !== stop);
}

function recordCue(name: CueName, params?: CueParams): void {
  const recorded = recordedParams(params);
  lastCues.push(recorded === undefined ? { name } : { name, params: recorded });
  if (lastCues.length > LAST_CUE_RING) {
    lastCues.splice(0, lastCues.length - LAST_CUE_RING);
  }
}

function isFoleyMappedCue(name: CueName): name is FoleyMappedCue {
  return (FOLEY_CUE_NAMES as readonly CueName[]).includes(name);
}

function configureFoley(audio: AudioSettings, muted: boolean): void {
  foleyEngine.set({
    muted,
    volume: audio.foley.volume,
    theme: audio.foley.theme,
    space: audio.foley.space,
  });
}

/**
 * Production tactile path. Returns true when this cue is a Foley mapping (even if Foley
 * swallowed the play — cooldown — so we do not also fire the homemade recipe).
 */
function playFoleyCue(name: CueName, audio: AudioSettings, params?: CueParams): boolean {
  if (!isFoleyMappedCue(name)) return false;
  const mapping = audio.foley.cues[name];
  const opts: FoleyPlayOptions = {};
  if (mapping.pitch !== undefined) opts.pitch = mapping.pitch;
  if (mapping.volume !== undefined) opts.volume = mapping.volume;
  const playOpts = mapping.pitch === undefined && mapping.volume === undefined ? undefined : opts;
  let handle: { stop(): void } | undefined;
  try {
    handle = foleyEngine.play(mapping.name, playOpts);
  } catch {
    return false;
  }
  if (handle === undefined) return true;
  reserveVoiceSlot(audio.maxVoices);
  trackVoice({ stop: handle.stop });
  recordCue(name, params);
  return true;
}

function recordedParams(params?: CueParams): Record<string, unknown> | undefined {
  if (params === undefined) return undefined;
  const out: Record<string, unknown> = {};
  if (params.chainDepth !== undefined) out.chainDepth = params.chainDepth;
  if (params.kind !== undefined) out.kind = params.kind;
  if (params.doubled !== undefined) out.doubled = params.doubled;
  return Object.keys(out).length === 0 ? undefined : out;
}

interface CompiledVoice {
  type: CueVoice['type'];
  hz?: number;
  offsetMs: number;
  attackMs: number;
  decayMs: number;
  peakGain: number;
  filter?: CueVoice['filter'];
}
