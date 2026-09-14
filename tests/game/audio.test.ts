import { describe, expect, it, vi } from 'vitest';
import { installAudioUnlock } from '../../game/state/audio';

function fakeContext(state: AudioContextState) {
  return { state, resume: vi.fn(() => Promise.resolve()) };
}

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
