export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const laneCenter = (lane: number, laneWidth: number, laneCount: number) =>
  (lane - (laneCount - 1) / 2) * laneWidth;

export type Aabb = {
  x: number;
  z: number;
  halfW: number;
  halfL: number;
};

export function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return (
    Math.abs(a.x - b.x) < a.halfW + b.halfW &&
    Math.abs(a.z - b.z) < a.halfL + b.halfL
  );
}

/** Conservative swept test along Z (primary motion) plus current X. */
export function sweptOverlap(a: Aabb, aDz: number, b: Aabb, bDz: number): boolean {
  const aMoved: Aabb = {
    ...a,
    z: a.z + aDz * 0.5,
    halfL: a.halfL + Math.abs(aDz) * 0.5,
  };
  const bMoved: Aabb = {
    ...b,
    z: b.z + bDz * 0.5,
    halfL: b.halfL + Math.abs(bDz) * 0.5,
  };
  return aabbOverlap(aMoved, bMoved);
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.floor(meters)} m`;
}

export function formatScore(score: number): string {
  return Math.floor(score).toLocaleString("en-US");
}
