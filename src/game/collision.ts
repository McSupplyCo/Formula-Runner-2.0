import { DRIVE } from "./tuning";
import { aabbOverlap, sweptOverlap, type Aabb } from "./math";

export type Body = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  width: number;
  length: number;
};

export function bodyAabb(body: Body, scale = DRIVE.hitboxScale): Aabb {
  return {
    x: body.x,
    z: body.z,
    halfW: (body.width * scale) / 2,
    halfL: (body.length * scale) / 2,
  };
}

export function hits(a: Body, b: Body, dt: number): boolean {
  const boxA = bodyAabb(a);
  const boxB = bodyAabb(b);
  if (aabbOverlap(boxA, boxB)) return true;
  return sweptOverlap(boxA, a.vz * dt, boxB, b.vz * dt);
}

export function hitsBarrier(x: number, limit: number, halfWidth: number): boolean {
  return Math.abs(x) + halfWidth * DRIVE.hitboxScale > limit + 0.12;
}

export function nearMissClearance(player: Body, other: Body): number | null {
  const longOverlap =
    Math.abs(player.z - other.z) < (player.length + other.length) * 0.55;
  if (!longOverlap) return null;
  const gap = Math.abs(player.x - other.x) - (player.width + other.width) * 0.5;
  if (gap < 0 || gap > 2.4) return null;
  return gap;
}
