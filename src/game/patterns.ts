import { ROAD } from "./tuning";
import { laneCenter } from "./math";

export type TrafficKind = "gt" | "support" | "safety";

export type TrafficCar = {
  lane: number;
  x: number;
  z: number;
  speed: number;
  kind: TrafficKind;
  weave: number;
  weavePhase: number;
  passed: boolean;
  nearMissed: boolean;
};

export type Pattern = {
  name: string;
  minDistance: number;
  cars: Array<{
    lane: number;
    zOffset: number;
    speedOffset: number;
    kind: TrafficKind;
    weave?: number;
  }>;
};

const L = ROAD.laneCount;

export const PATTERNS: Pattern[] = [
  {
    name: "single",
    minDistance: 0,
    cars: [{ lane: 1, zOffset: 0, speedOffset: 0, kind: "gt" }],
  },
  {
    name: "offset-pair",
    minDistance: 0,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: -4, kind: "support" },
      { lane: 2, zOffset: 18, speedOffset: 2, kind: "gt" },
    ],
  },
  {
    name: "leave-right",
    minDistance: 80,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 0, kind: "gt" },
      { lane: 1, zOffset: 8, speedOffset: -6, kind: "support" },
      { lane: 2, zOffset: 4, speedOffset: 4, kind: "gt" },
    ],
  },
  {
    name: "pinch",
    minDistance: 100,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: -3, kind: "gt" },
      { lane: 2, zOffset: 3, speedOffset: 2, kind: "support" },
      { lane: 3, zOffset: 5, speedOffset: -1, kind: "gt" },
    ],
  },
  {
    name: "leave-left",
    minDistance: 160,
    cars: [
      { lane: 1, zOffset: 0, speedOffset: 0, kind: "gt" },
      { lane: 2, zOffset: 10, speedOffset: -8, kind: "support" },
      { lane: 3, zOffset: 6, speedOffset: 3, kind: "gt" },
    ],
  },
  {
    name: "rolling-block",
    minDistance: 250,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 2, kind: "gt" },
      { lane: 1, zOffset: 6, speedOffset: -4, kind: "support" },
      { lane: 0, zOffset: 28, speedOffset: 4, kind: "gt" },
      { lane: 3, zOffset: 32, speedOffset: -2, kind: "safety" },
    ],
  },
  {
    name: "checker",
    minDistance: 420,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: -2, kind: "gt" },
      { lane: 2, zOffset: 10, speedOffset: 6, kind: "support" },
      { lane: 1, zOffset: 26, speedOffset: -10, kind: "gt" },
      { lane: 3, zOffset: 36, speedOffset: 2, kind: "safety" },
    ],
  },
  {
    name: "wall-with-slot",
    minDistance: 550,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 0, kind: "gt" },
      { lane: 1, zOffset: 2, speedOffset: 0, kind: "support" },
      { lane: 3, zOffset: 3, speedOffset: -2, kind: "gt" },
    ],
  },
  {
    name: "pack-gap-mid",
    minDistance: 700,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 0, kind: "gt" },
      { lane: 1, zOffset: 6, speedOffset: -4, kind: "gt" },
      { lane: 3, zOffset: 4, speedOffset: 5, kind: "support" },
    ],
  },
  {
    name: "weaver",
    minDistance: 800,
    cars: [
      { lane: 1, zOffset: 0, speedOffset: 8, kind: "safety", weave: 0.85 },
      { lane: 3, zOffset: 22, speedOffset: -6, kind: "gt" },
    ],
  },
  {
    name: "split-pack",
    minDistance: 950,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: -2, kind: "gt" },
      { lane: 3, zOffset: 5, speedOffset: 3, kind: "support" },
      { lane: 1, zOffset: 26, speedOffset: -6, kind: "gt" },
      { lane: 3, zOffset: 38, speedOffset: 4, kind: "safety" },
    ],
  },
  {
    name: "mid-sweep",
    minDistance: 1400,
    cars: [
      { lane: 3, zOffset: 0, speedOffset: 2, kind: "gt" },
      { lane: 2, zOffset: 16, speedOffset: -5, kind: "support" },
      { lane: 0, zOffset: 22, speedOffset: 4, kind: "gt" },
      { lane: 3, zOffset: 40, speedOffset: -3, kind: "safety", weave: 0.7 },
    ],
  },
  {
    name: "late-zipper",
    minDistance: 1900,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 0, kind: "gt" },
      { lane: 1, zOffset: 14, speedOffset: -8, kind: "support" },
      { lane: 2, zOffset: 28, speedOffset: 6, kind: "gt" },
      { lane: 0, zOffset: 44, speedOffset: -4, kind: "gt", weave: 0.75 },
    ],
  },
  {
    name: "double-stagger",
    minDistance: 2400,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 4, kind: "gt", weave: 0.8 },
      { lane: 2, zOffset: 12, speedOffset: -8, kind: "support" },
      { lane: 1, zOffset: 28, speedOffset: 10, kind: "gt" },
      { lane: 3, zOffset: 40, speedOffset: -4, kind: "safety", weave: 0.9 },
    ],
  },
  {
    name: "hook-left",
    minDistance: 2600,
    cars: [
      { lane: 1, zOffset: 0, speedOffset: 2, kind: "gt" },
      { lane: 2, zOffset: 3, speedOffset: 0, kind: "support" },
      { lane: 3, zOffset: 8, speedOffset: -2, kind: "gt" },
      { lane: 0, zOffset: 34, speedOffset: 8, kind: "safety", weave: 0.85 },
    ],
  },
  {
    name: "apex-gate",
    minDistance: 3400,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: -3, kind: "gt" },
      { lane: 1, zOffset: 6, speedOffset: 2, kind: "support" },
      { lane: 3, zOffset: 4, speedOffset: 1, kind: "gt" },
      { lane: 2, zOffset: 26, speedOffset: -8, kind: "safety", weave: 0.8 },
      { lane: 0, zOffset: 42, speedOffset: 6, kind: "gt" },
    ],
  },
];

const BLOCK_SPAN = 7.6;

export function openLanes(pattern: Pattern): number[] {
  const blocked = new Set(pattern.cars.filter((car) => car.zOffset < 12).map((car) => car.lane));
  const open: number[] = [];
  for (let i = 0; i < L; i++) if (!blocked.has(i)) open.push(i);
  return open;
}

/** True if a driver can thread the pattern by moving at most one lane at a time. */
export function patternHasThread(pattern: Pattern): boolean {
  const maxZ = Math.max(0, ...pattern.cars.map((car) => car.zOffset)) + 10;
  const slices: number[][] = [];
  for (let z = 0; z <= maxZ; z += 4) {
    const blocked = new Set<number>();
    for (const car of pattern.cars) {
      if (Math.abs(car.zOffset - z) < BLOCK_SPAN) blocked.add(car.lane);
    }
    const open: number[] = [];
    for (let lane = 0; lane < L; lane++) if (!blocked.has(lane)) open.push(lane);
    if (!open.length) return false;
    slices.push(open);
  }
  let reach = new Set(slices[0]);
  for (let i = 1; i < slices.length; i++) {
    const next = new Set<number>();
    for (const lane of slices[i]) {
      if (reach.has(lane) || reach.has(lane - 1) || reach.has(lane + 1)) next.add(lane);
    }
    if (!next.size) return false;
    reach = next;
  }
  return true;
}

export function lanesBlockedNear(
  cars: Array<{ lane: number; z: number }>,
  z: number,
  window = 12,
): Set<number> {
  const blocked = new Set<number>();
  for (const car of cars) {
    if (Math.abs(car.z - z) <= window) blocked.add(car.lane);
  }
  return blocked;
}

export function patternPoolAt(distance: number): Pattern[] {
  const eligible = PATTERNS.filter((pattern) => pattern.minDistance <= distance);
  const pool = eligible.length ? eligible : PATTERNS.slice(0, 2);
  return pool.length > 3 ? pool.slice(-3) : pool;
}

export function pickFairPattern(
  distance: number,
  random: () => number,
  blocked: Iterable<number> = [],
): Pattern | null {
  const closed = new Set(blocked);
  const pool = patternPoolAt(distance).filter((pattern) => patternHasThread(pattern));
  const fair = pool.filter((pattern) => openLanes(pattern).some((lane) => !closed.has(lane)));
  const list = fair.length ? fair : closed.size >= 3 ? [] : pool;
  if (!list.length) return null;
  return list[Math.floor(random() * list.length)] ?? list[0];
}

export function pickPattern(distance: number, random: () => number): Pattern {
  return pickFairPattern(distance, random) ?? patternPoolAt(distance)[0] ?? PATTERNS[0];
}

export function materializePattern(
  pattern: Pattern,
  originZ: number,
  baseSpeed: number,
  moverChance: number,
  random: () => number,
): TrafficCar[] {
  return pattern.cars.map((spec) => ({
    lane: spec.lane,
    x: laneCenter(spec.lane, ROAD.laneWidth, ROAD.laneCount),
    z: originZ + spec.zOffset,
    speed: Math.max(40, baseSpeed + spec.speedOffset),
    kind: spec.kind,
    weave: spec.weave && random() < moverChance + 0.35 ? spec.weave : spec.weave ? spec.weave * 0.35 : 0,
    weavePhase: random() * Math.PI * 2,
    passed: false,
    nearMissed: false,
  }));
}
