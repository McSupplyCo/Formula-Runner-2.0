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
    name: "leave-left",
    minDistance: 160,
    cars: [
      { lane: 1, zOffset: 0, speedOffset: 0, kind: "gt" },
      { lane: 2, zOffset: 10, speedOffset: -8, kind: "support" },
      { lane: 3, zOffset: 6, speedOffset: 3, kind: "gt" },
    ],
  },
  {
    name: "checker",
    minDistance: 420,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: -2, kind: "gt" },
      { lane: 2, zOffset: 16, speedOffset: 6, kind: "support" },
      { lane: 1, zOffset: 34, speedOffset: -10, kind: "gt" },
      { lane: 3, zOffset: 48, speedOffset: 2, kind: "safety" },
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
    minDistance: 1100,
    cars: [
      { lane: 1, zOffset: 0, speedOffset: 8, kind: "safety", weave: 1.4 },
      { lane: 3, zOffset: 22, speedOffset: -6, kind: "gt" },
    ],
  },
  {
    name: "wall-with-slot",
    minDistance: 1600,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 0, kind: "gt" },
      { lane: 1, zOffset: 2, speedOffset: 0, kind: "support" },
      { lane: 3, zOffset: 3, speedOffset: -2, kind: "gt" },
    ],
  },
  {
    name: "double-stagger",
    minDistance: 2400,
    cars: [
      { lane: 0, zOffset: 0, speedOffset: 4, kind: "gt", weave: 0.8 },
      { lane: 2, zOffset: 12, speedOffset: -8, kind: "support" },
      { lane: 1, zOffset: 28, speedOffset: 10, kind: "gt" },
      { lane: 3, zOffset: 40, speedOffset: -4, kind: "safety", weave: 1.1 },
    ],
  },
];

export function openLanes(pattern: Pattern): number[] {
  const blocked = new Set(pattern.cars.filter((car) => car.zOffset < 12).map((car) => car.lane));
  const open: number[] = [];
  for (let i = 0; i < L; i++) if (!blocked.has(i)) open.push(i);
  return open;
}

export function pickPattern(distance: number, random: () => number): Pattern {
  const eligible = PATTERNS.filter((pattern) => distance >= pattern.minDistance);
  const pool = eligible.length ? eligible : PATTERNS.slice(0, 2);
  const openPool = pool.filter((pattern) => openLanes(pattern).length > 0);
  const list = openPool.length ? openPool : pool;
  return list[Math.floor(random() * list.length)] ?? list[0];
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
