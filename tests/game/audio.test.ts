import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindAudio,
  clearLastCues,
  getLastCues,
  installAudioUnlock,
  playCue,
  resetAudioForTests,
  setFoleyEngine,
  stopAllCues,
  type FoleyEngine,
} from '../../game/state/audio';
import { fakeAudioSettings } from '../helpers/playbackSettings';

function fakeContext(state: AudioContextState) {
  return { state, resume: vi.fn(() => Promise.resolve()) };
}

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
    const { engine, plays } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => false, audio: () => fakeAudioSettings() });
    playCue('uiTap');
    expect(plays).toEqual([]);
    expect(getLastCues()).toEqual([]);
  });

  it('does not throw without a Foley handle', () => {
    const engine = recordingFoley().engine;
    engine.play = () => undefined;
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    expect(() => playCue('uiTap')).not.toThrow();
    expect(getLastCues()).toEqual([]);
  });

  it('records started cues and stopAllCues stops them', () => {
    const { engine, plays, stopped } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('uiTap');
    expect(plays).toEqual([{ name: 'tap' }]);
    expect(getLastCues()).toEqual([{ name: 'uiTap' }]);
    expect(stopped()).toBe(0);
    stopAllCues();
    expect(stopped()).toBe(1);
  });

  it('stops the oldest voice when over maxVoices', () => {
    const { engine, plays, stopped } = recordingFoley();
    const audio = { ...fakeAudioSettings(), maxVoices: 2 };
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => audio });
    playCue('uiTap');
    playCue('trayTick');
    playCue('spawn');
    expect(plays.map((play) => play.name)).toEqual(['tap', 'tick', 'drop']);
    expect(stopped()).toBe(1);
  });

  it('pitches tilePop from operator and chainDepth, never from a missing kind defaulting silently off-curve', () => {
    const { engine, plays } = recordingFoley();
    const audio = fakeAudioSettings();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => audio });
    playCue('tilePop', { kind: 'add', chainDepth: 1 });
    playCue('tilePop', { kind: 'add', chainDepth: 3 });
    playCue('tilePop', { kind: 'sub', chainDepth: 1 });
    playCue('tilePop', { kind: 'mul', chainDepth: 1 });
    const semitones = (kind: 'add' | 'sub' | 'mul', chainDepth: number) => {
      const tuning = audio.tilePop[kind];
      const hz =
        tuning.baseHz *
        audio.tilePop.depthRatio ** (chainDepth - 1) *
        2 ** (tuning.offsetSemitones / 12);
      return 12 * Math.log2(hz / audio.tilePop.add.baseHz);
    };
    expect(plays.map((play) => play.name)).toEqual(['chime', 'chime', 'chime', 'chime']);
    expect(plays[0]?.opts?.pitch).toBeCloseTo(semitones('add', 1));
    expect(plays[1]?.opts?.pitch).toBeCloseTo(semitones('add', 3));
    expect(plays[1]!.opts!.pitch!).toBeGreaterThan(plays[0]!.opts!.pitch!);
    expect(plays[2]?.opts?.pitch).toBeCloseTo(semitones('sub', 1));
    expect(plays[2]!.opts!.pitch!).toBeLessThan(plays[0]!.opts!.pitch!);
    expect(plays[3]?.opts?.pitch).toBeCloseTo(semitones('mul', 1));
    expect(getLastCues().map((cue) => cue.params?.kind)).toEqual(['add', 'add', 'sub', 'mul']);
  });

  it('keeps a ring of last cues and clearLastCues empties it', () => {
    const { engine } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('uiTap');
    playCue('preview');
    expect(getLastCues().map((cue) => cue.name)).toEqual(['uiTap', 'preview']);
    clearLastCues();
    expect(getLastCues()).toEqual([]);
  });
});

describe('Foley cues', () => {
  it('plays buttons as tap and tile pickup/drop as tap/thock', () => {
    const { engine, plays } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('uiTap');
    playCue('pickupTile');
    playCue('dropTile');
    playCue('snapBack');
    playCue('trayTick');
    expect(plays.map((play) => play.name)).toEqual(['tap', 'tap', 'thock', 'denied', 'tick']);
    expect(getLastCues().map((cue) => cue.name)).toEqual([
      'uiTap',
      'pickupTile',
      'dropTile',
      'snapBack',
      'trayTick',
    ]);
  });

  it('pitches cannon pickup/drop as heavier tap/thock siblings', () => {
    const { engine, plays } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('pickupCannon');
    playCue('dropCannon');
    expect(plays).toEqual([
      { name: 'tap', opts: { pitch: -7 } },
      { name: 'thock', opts: { pitch: -5 } },
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

  it('routes teaching playback through Foley names', () => {
    const { engine, plays } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    playCue('cannonThump');
    playCue('exactKill');
    playCue('buy');
    playCue('nope');
    expect(plays.map((play) => play.name)).toEqual(['press', 'sparkle', 'success', 'error']);
  });

  it('plays tilePop as a default-theme chime, then restores mechanical', () => {
    const { engine, plays, sets } = recordingFoley();
    setFoleyEngine(engine);
    bindAudio({ soundEnabled: () => true, audio: () => fakeAudioSettings() });
    const themesBefore = sets.filter((entry) => entry.theme !== undefined).length;
    playCue('tilePop', { kind: 'add', chainDepth: 1 });
    expect(plays.map((play) => play.name)).toEqual(['chime']);
    const themes = sets.map((entry) => entry.theme).filter((theme) => theme !== undefined);
    expect(themes[themes.length - 2]).toBe('default');
    expect(themes[themes.length - 1]).toBe('mechanical');
    expect(themes.length).toBeGreaterThan(themesBefore);
  });
});
