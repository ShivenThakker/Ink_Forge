import type { Point } from './types';

export type RNG = () => number;

function hashSeed(seed: string | number): number {
  const text = String(seed);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seed: string | number): RNG {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function centeredRandom(rng: RNG, amplitude: number): number {
  return (rng() * 2 - 1) * amplitude;
}

export function jitterPoints(anchors: Point[], anchorJitter: number, rng: RNG): Point[] {
  if (anchorJitter <= 0) return [...anchors];
  return anchors.map((anchor) => ({
    x: anchor.x + centeredRandom(rng, anchorJitter),
    y: anchor.y + centeredRandom(rng, anchorJitter),
  }));
}

export function wobbleBaseline(y: number, baselineJitter: number, rng: RNG): number {
  if (baselineJitter <= 0) return y;
  return y + centeredRandom(rng, baselineJitter);
}

export function jitterSpacing(spacing: number, spacingJitter: number, rng: RNG): number {
  if (spacingJitter <= 0) return spacing;
  return Math.max(0, spacing + centeredRandom(rng, spacingJitter));
}

export function jitterAngle(angle: number, angleJitter: number, rng: RNG): number {
  if (angleJitter <= 0) return angle;
  return angle + centeredRandom(rng, angleJitter);
}

export function shouldBreak(strokeBreakChance: number, rng: RNG): boolean {
  const clamped = Math.max(0, Math.min(1, strokeBreakChance));
  return rng() < clamped;
}
