// Web Audio unlock (TR §15). iOS Safari starts every AudioContext suspended; it may only be
// resumed from a user gesture. No sounds exist yet (M5) — this just guarantees that by the time
// something wants to play, the shared context is running.
//
// Lives in /game/state (framework-free) because both /game/board and /game/ui will play sounds
// and neither may import the other (TR §2).

let shared: AudioContext | null = null;

/**
 * The app's single AudioContext, created lazily. Returns null where Web Audio is unavailable.
 */
export function getAudioContext(): AudioContext | null {
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
