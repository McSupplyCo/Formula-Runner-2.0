import { SCORE } from "./tuning";
import { clamp } from "./math";

export function speedMultiplier(speedKph: number, topSpeed: number): number {
  const t = clamp(speedKph / Math.max(1, topSpeed), 0, 1.15);
  return 1 + t * SCORE.maxSpeedBonus;
}

export function distanceScore(distanceDelta: number, speedKph: number, topSpeed: number): number {
  return Math.max(0, distanceDelta) * SCORE.distanceWeight * speedMultiplier(speedKph, topSpeed);
}

export function comboMultiplier(combo: number): number {
  return clamp(combo, 1, SCORE.maxCombo);
}

export function nearMissScore(combo: number, clearance: number): number {
  const closeness = clamp(1 - clearance / SCORE.closeNearMiss, 0.25, 1);
  return Math.round(SCORE.nearMissBase * comboMultiplier(combo) * (0.6 + closeness * 0.8));
}

export function overtakeScore(combo: number): number {
  return Math.round(SCORE.overtakeBase * (0.7 + 0.3 * comboMultiplier(combo)));
}

export function tickCombo(combo: number, timer: number, dt: number): { combo: number; timer: number } {
  if (combo <= 0) return { combo: 0, timer: 0 };
  const next = timer - dt;
  if (next <= 0) return { combo: 0, timer: 0 };
  return { combo, timer: next };
}

export function registerNearMiss(
  combo: number,
): { combo: number; timer: number } {
  return {
    combo: clamp(combo + 1, 1, SCORE.maxCombo),
    timer: SCORE.comboWindow,
  };
}

export type Difficulty = {
  spawnInterval: number;
  trafficSpeed: number;
  patternBias: number;
  moverChance: number;
};

export function difficultyAt(distance: number): Difficulty {
  const t = clamp(distance / 4500, 0, 1);
  return {
    spawnInterval: lerpRange(1.08, 0.64, t),
    trafficSpeed: lerpRange(96, 205, t),
    patternBias: t,
    moverChance: lerpRange(0.12, 0.55, t),
  };
}

function lerpRange(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
