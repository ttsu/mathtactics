// Seeded, pure RNG (TR §8). `Math.random` and `Date.now` are banned in /sim by lint (CLAUDE.md
// rule 1) — every draw here takes an explicit state and returns the next state, so `RunState`
// can persist and replay exact sequences.
//
// Algorithm: sfc32 (a small, fast, statistically solid 32-bit PRNG), seeded from a string via
// the cyrb128 hash. Both are well-known public-domain generators (Tommy Ettinger's sfc32 port;
// bryc's cyrb128), reimplemented here in a pure, state-in/state-out style instead of the usual
// closure-with-mutable-state form, so the state is plain JSON (`RngState`) rather than a
// generator function.

/** sfc32 internal state: four 32-bit words. Plain numbers, JSON-serializable (TR §8). */
export type RngState = [number, number, number, number];

/**
 * Hashes an arbitrary string into four well-mixed 32-bit words (cyrb128). Used only to turn a
 * human-readable seed string into sfc32's initial state — not a general-purpose hash.
 */
function cyrb128(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i += 1) {
    const k = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ k, 597399067);
    h2 = Math.imul(h2 ^ k, 2869860233);
    h3 = Math.imul(h3 ^ k, 951274213);
    h4 = Math.imul(h4 ^ k, 2716044179);
    h1 = (h1 << 13) | (h1 >>> 19);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067) ^ h4;
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233) ^ h1;
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213) ^ h2;
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179) ^ h3;
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** One pure sfc32 step: `[a, b, c, d] -> [randomFloat in [0, 1), nextState]`. */
function step(state: RngState): [number, RngState] {
  let [a, b, c, d] = state;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  let t = (a + b) | 0;
  a = (b ^ (b >>> 9)) | 0;
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  const value = (t >>> 0) / 4294967296;
  return [value, [a >>> 0, b >>> 0, c >>> 0, d >>> 0]];
}

/** Number of warm-up steps discarded after seeding, standard practice for sfc32 to shed any
 * weak correlation in the first few outputs of a freshly hashed seed. */
const WARMUP_STEPS = 15;

/** Turns a seed string into an `RngState` ready for `nextInt` / `pickWeighted`. */
export function seedRng(seed: string): RngState {
  let state = cyrb128(seed);
  for (let i = 0; i < WARMUP_STEPS; i += 1) {
    [, state] = step(state);
  }
  return state;
}

/**
 * Draws a random integer in `[min, max]` inclusive (both bounds included; `min` must be
 * `<= max`). Pure: returns the drawn value and the state to use for the next draw.
 */
export function nextInt(state: RngState, min: number, max: number): [number, RngState] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError(`nextInt: invalid range [${min}, ${max}]`);
  }
  const [f, next] = step(state);
  const span = max - min + 1;
  const value = min + Math.floor(f * span);
  return [Math.min(value, max), next];
}

/** One weighted candidate for `pickWeighted`. `weight` must be > 0. */
export interface WeightedItem<T> {
  item: T;
  weight: number;
}

/**
 * Draws one item from `items`, with probability proportional to each item's `weight`. Pure:
 * returns the drawn item and the state to use for the next draw. Throws if `items` is empty or
 * all weights are <= 0.
 */
export function pickWeighted<T>(state: RngState, items: WeightedItem<T>[]): [T, RngState] {
  const totalWeight = items.reduce((sum, entry) => sum + entry.weight, 0);
  if (items.length === 0 || totalWeight <= 0) {
    throw new RangeError('pickWeighted: items must be non-empty with a positive total weight');
  }
  const [f, next] = step(state);
  let roll = f * totalWeight;
  for (const entry of items) {
    if (entry.weight <= 0) continue;
    if (roll < entry.weight) {
      return [entry.item, next];
    }
    roll -= entry.weight;
  }
  // Floating-point edge case: `roll` landed exactly on (or past, by an epsilon) the total.
  // Fall back to the last positively-weighted item rather than throwing.
  const last = [...items].reverse().find((entry) => entry.weight > 0);
  if (!last) {
    throw new RangeError('pickWeighted: items must be non-empty with a positive total weight');
  }
  return [last.item, next];
}

/** Named RNG streams (TR §8): `wave` (robot HP, lanes, timing, procedural waves) and `shop`
 * (offers). Drawing from one must never advance the other, so they are seeded independently
 * (`${seed}:wave` / `${seed}:shop`) rather than derived from a single shared stream. */
export interface RngStreams {
  wave: RngState;
  shop: RngState;
}

export function createStreams(seed: string): RngStreams {
  return {
    wave: seedRng(`${seed}:wave`),
    shop: seedRng(`${seed}:shop`),
  };
}
