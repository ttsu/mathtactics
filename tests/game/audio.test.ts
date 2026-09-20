import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindAudio,
  clearLastCues,
  getLastCues,
  installAudioUnlock,
  playCue,
  resetAudioForTests,
  setAudioTestSink,
  setFoleyEngine,
  stopAllCues,
  type AudioTestSink,
  type FoleyEngine,
} from '../../game/state/audio';
import { fakeAudioSettings } from '../helpers/playbackSettings';

function fakeContext(state: AudioContextState) {
  return { state, resume: vi.fn(() => Promise.resolve()) };
}

function recordingSink() {
  const started: { type: string; hz?: number; peakGain: number; stopped: boolean }[] = [];
  const sink: AudioTestSink = {
    start(voice) {
      const record = { ...voice, stopped: false };
      started.push(record);
      return {
        stop() {
          record.stopped = true;
        },
      };
    },
  };
  return { sink, started };
}

afterEach(() => {
  resetAudioForTests();
});

describe('installAudioUnlock', () => {
  it('resumes a suspended context on the first pointerdown only', () => {
    const target = new EventTarget();
    const context = fakeContext('suspended');
    installAudioUnlock(target, context);

    expect(context.resume).not.toHaveBeenCalled();
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('pointerdown'));
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('does not resume a context that is already running', () => {
    const target = new EventTarget();
    const context = fakeContext('running');
    installAudioUnlock(target, context);
    target.dispatchEvent(new Event('pointerdown'));
    expect(context.resume).not.toHaveBeenCalled();
  });

  it('can be removed before it fires', () => {
    const target = new EventTarget();
    const context = fakeContext('suspended');
    const remove = installAudioUnlock(target, context);
    remove();
    target.dispatchEvent(new Event('pointerdown'));
    expect(context.resume).not.toHaveBeenCalled();
  });

  it('swallows a rejected resume', async () => {
    const target = new EventTarget();
    const context = {
      state: 'suspended' as const,
      resume: vi.fn(() => Promise.reject(new Error('no'))),
    };
    installAudioUnlock(target, context);
    target.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
  });
});

describe('playCue', () => {
  it('starts nothing when muted and does not append last cues', () => {
    const { sink, started } = recordingSink();
    bindAudio({ soundEnabled: () => false, audio: () => fakeAudioSettings() });
    setAudioTestSink(sink);
    playCue('uiTap');
    expect(started).toEqual([]);
    expect(getLastCues()).toEqual([]);
  });

  it('does not throw without a context', () => {
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    setAudioTestSink(null);
    expect(() => playCue('uiTap')).not.toThrow();
    expect(getLastCues()).toEqual([]);
  });

  it('records started cues and stopAllCues stops them', () => {
    const { sink, started } = recordingSink();
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    setAudioTestSink(sink);
    playCue('uiTap');
    expect(started).toHaveLength(1);
    expect(getLastCues()).toEqual([{ name: 'uiTap' }]);
    stopAllCues();
    expect(started[0]?.stopped).toBe(true);
  });

  it('stops the oldest voice when over maxVoices', () => {
    const { sink, started } = recordingSink();
    const audio = { ...fakeAudioSettings(), maxVoices: 2 };
    bindAudio({ soundEnabled: () => true, audio: () => audio });
    setAudioTestSink(sink);
    playCue('uiTap');
    playCue('trayTick');
    playCue('spawn');
    expect(started).toHaveLength(3);
    expect(started[0]?.stopped).toBe(true);
    expect(started[1]?.stopped).toBe(false);
    expect(started[2]?.stopped).toBe(false);
  });

  it('pitches tilePop from operator and chainDepth, never from a missing kind defaulting silently off-curve', () => {
    const { sink, started } = recordingSink();
    const audio = fakeAudioSettings();
    bindAudio({ soundEnabled: () => true, audio: () => audio });
    setAudioTestSink(sink);
    playCue('tilePop', { kind: 'add', chainDepth: 1 });
    playCue('tilePop', { kind: 'add', chainDepth: 3 });
    playCue('tilePop', { kind: 'sub', chainDepth: 1 });
    playCue('tilePop', { kind: 'mul', chainDepth: 1 });
    const add1 = audio.tilePop.add.baseHz * 2 ** (audio.tilePop.add.offsetSemitones / 12);
    const add3 = add1 * audio.tilePop.depthRatio ** 2;
    const sub1 = audio.tilePop.sub.baseHz * 2 ** (audio.tilePop.sub.offsetSemitones / 12);
    const mul1 = audio.tilePop.mul.baseHz * 2 ** (audio.tilePop.mul.offsetSemitones / 12);
    expect(started[0]?.hz).toBeCloseTo(add1);
    expect(started[1]?.hz).toBeCloseTo(add3);
    expect(started[1]!.hz!).toBeGreaterThan(started[0]!.hz!);
    expect(started[2]?.hz).toBeCloseTo(sub1);
    expect(started[2]!.hz!).toBeLessThan(started[0]!.hz!);
    expect(started[3]?.hz).toBeCloseTo(mul1);
    expect(started[4]?.hz).toBeCloseTo(mul1 * (audio.tilePop.mul.harmonicRatio ?? 2));
    expect(getLastCues().map((cue) => cue.params?.kind)).toEqual(['add', 'add', 'sub', 'mul']);
  });

  it('keeps a ring of last cues and clearLastCues empties it', () => {
    const { sink } = recordingSink();
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    setAudioTestSink(sink);
    playCue('uiTap');
    playCue('preview');
    expect(getLastCues().map((cue) => cue.name)).toEqual(['uiTap', 'preview']);
    clearLastCues();
    expect(getLastCues()).toEqual([]);
  });
});

function recordingFoley() {
  const plays: { name: string; opts?: { pitch?: number; volume?: number } }[] = [];
  const sets: { muted?: boolean; volume?: number; theme?: string; space?: number }[] = [];
  let stopped = 0;
  const engine: FoleyEngine = {
    play(name, opts) {
      plays.push(opts === undefined ? { name } : { name, opts });
      return {
        stop() {
          stopped += 1;
        },
      };
    },
    set(opts) {
      sets.push(opts);
    },
    unlock() {},
    audioContext() {
      return null;
    },
  };
  return { engine, plays, sets, stopped: () => stopped };
}

describe('Foley tactile cues', () => {
  it('routes buttons and tile drag through Foley, not homemade voices', () => {
    const { engine, plays } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('uiTap');
    playCue('pickupTile');
    playCue('dropTile');
    playCue('snapBack');
    playCue('trayTick');
    expect(plays.map((play) => play.name)).toEqual(['tap', 'press', 'release', 'denied', 'tick']);
    expect(getLastCues().map((cue) => cue.name)).toEqual([
      'uiTap',
      'pickupTile',
      'dropTile',
      'snapBack',
      'trayTick',
    ]);
  });

  it('pitches cannon pickup/drop as heavier Foley siblings', () => {
    const { engine, plays } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('pickupCannon');
    playCue('dropCannon');
    expect(plays).toEqual([
      { name: 'press', opts: { pitch: -7 } },
      { name: 'drop', opts: { pitch: -5 } },
    ]);
  });

  it('plays preview as Foley on, and mutes Foley when sound is off', () => {
    const { engine, plays, sets } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => false, audio: () => fakeAudioSettings() });
    playCue('preview');
    expect(plays).toEqual([]);
    expect(sets.some((entry) => entry.muted === true)).toBe(true);
    expect(getLastCues()).toEqual([]);

    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('preview');
    expect(plays).toEqual([{ name: 'on' }]);
  });

  it('leaves teaching playback off Foley', () => {
    const { engine, plays } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('tilePop', { kind: 'add', chainDepth: 1 });
    playCue('cannonThump');
    playCue('exactKill');
    expect(plays).toEqual([]);
  });

  it('stopAllCues stops a Foley handle', () => {
    const { engine, stopped } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('uiTap');
    expect(stopped()).toBe(0);
    stopAllCues();
    expect(stopped()).toBe(1);
  });
});
