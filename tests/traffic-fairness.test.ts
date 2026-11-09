import { describe, expect, it } from "vitest";
import { damp, laneCenter } from "../src/game/math";
import { defaultSave } from "../src/game/save";
import { fittedSpec } from "../src/game/garage";
import { difficultyAt } from "../src/game/scoring";
import { DRIVE, CARS, MAX_PART_RANK, ROAD, SPAWN, type CarId } from "../src/game/tuning";
import {
  lanesBlockedNear,
  materializePattern,
  PATTERNS,
  pickFairPattern,
  patternPoolAt,
  type Pattern,
} from "../src/game/patterns";

const STEP = 1 / 60;
const LAT_HALF = ((DRIVE.playerWidth + DRIVE.trafficWidth) * DRIVE.hitboxScale) / 2;
const LONG_HALF = ((DRIVE.playerLength + DRIVE.trafficLength) * DRIVE.hitboxScale) / 2;

type State = { x: number; vx: number };
type PlayerModel = { id: CarId; topSpeed: number; steer: number; grip: number; steerLossScale: number };
type Traffic = {
  lane: number;
  x: number;
  relativeZ: number;
  speed: number;
  closing: number;
  weave: number;
  phase: number;
  initialRelativeZ: number;
  spawnTime: number;
};

const freeStateCache = new Map<string, Map<string, State>>();

function stockModel(id: CarId): PlayerModel {
  const car = CARS.find((candidate) => candidate.id === id)!;
  return { id: car.id, topSpeed: car.topSpeed, steer: car.steer, grip: car.grip, steerLossScale: 1 };
}

function maxUpgradedModel(id: CarId): PlayerModel {
  const save = defaultSave();
  const row = save.garage[id];
  save.garage[id] = { ...row, engine: MAX_PART_RANK, tires: MAX_PART_RANK, turbo: MAX_PART_RANK, aero: MAX_PART_RANK };
  const fitted = fittedSpec(save, id);
  return {
    id,
    topSpeed: fitted.topSpeed,
    steer: fitted.steer,
    grip: fitted.grip,
    steerLossScale: fitted.steerLossScale,
  };
}

function stateKey(x: number, vx: number) {
  return `${Math.round(x * 5)}:${Math.round(vx * 2)}`;
}

function freeReachableStates(steer: number, grip: number, authority: number, seconds: number) {
  let states = new Map<string, State>([[stateKey(0, 0), { x: 0, vx: 0 }]]);
  const steps = Math.ceil(seconds / STEP);
  for (let frame = 0; frame < steps; frame++) {
    const next = new Map<string, State>();
    for (const state of states.values()) {
      for (const input of [-1, 0, 1]) {
        const vx = damp(state.vx, input * steer * authority, grip, STEP);
        let x = state.x + vx * STEP;
        let safeVx = vx;
        if (x > ROAD.driveLimit) {
          x = ROAD.driveLimit;
          safeVx = Math.min(0, vx);
        } else if (x < -ROAD.driveLimit) {
          x = -ROAD.driveLimit;
          safeVx = Math.max(0, vx);
        }
        const key = stateKey(x, safeVx);
        if (!next.has(key)) next.set(key, { x, vx: safeVx });
      }
    }
    states = next;
  }
  return states;
}

function xAfterWeave(lane: number, weave: number, phase: number, seconds: number) {
  let x = laneCenter(lane, ROAD.laneWidth, ROAD.laneCount);
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    phase += STEP * 1.7;
    const targetX = laneCenter(lane, ROAD.laneWidth, ROAD.laneCount) + Math.sin(phase) * weave;
    x += (targetX - x) * Math.min(1, STEP * 3.2);
  }
  return x;
}

/** Uses Game.drive's steering equation against real, moving traffic bodies. */
function trafficIsReachable(
  traffic: Traffic[],
  carId: CarId,
  playerSpeed: number,
  model: PlayerModel = stockModel(carId),
) {
  const car = model;
  const playerV = playerSpeed / 3.6;
  const closingTraffic = traffic.filter((item) => item.closing > 0);
  if (!closingTraffic.length) return true;

  const firstContact = Math.min(...closingTraffic.map((item) => item.spawnTime + item.initialRelativeZ / item.closing));
  const shift = Math.max(0, firstContact - SPAWN.lookaheadSeconds);
  // More than two seconds of empty approach provides no extra lane options: the
  // simulation below already explores every steering choice and road boundary.
  const freeSeconds = Math.min(shift, 2);
  const freeKey = `${carId}:${car.steer}:${car.grip}:${car.steerLossScale}:${Math.ceil(freeSeconds / STEP)}`;
  let initialStates = freeStateCache.get(freeKey);
  if (!initialStates) {
    initialStates = freeReachableStates(car.steer, car.grip, 1 - DRIVE.highSpeedSteerLoss * car.steerLossScale, freeSeconds);
    freeStateCache.set(freeKey, initialStates);
  }
  const lastContact = Math.max(
    ...closingTraffic.map((item) => item.spawnTime + item.initialRelativeZ / item.closing + LONG_HALF / item.closing),
  );
  const steps = Math.ceil((lastContact - shift + 0.1) / STEP);
  const authority = 1 - DRIVE.highSpeedSteerLoss * car.steerLossScale;
  let states = initialStates;
  const liveTraffic = traffic.map((item) => ({ ...item, started: item.spawnTime <= shift }));
  for (const item of liveTraffic) {
    if (!item.started) continue;
    const age = shift - item.spawnTime;
    item.relativeZ = item.initialRelativeZ - item.closing * age;
    item.x = xAfterWeave(item.lane, item.weave, item.phase, age);
    item.phase += age * 1.7;
  }

  for (let frame = 0; frame < steps; frame++) {
    const next = new Map<string, State>();
    const frameTime = shift + (frame + 1) * STEP;
    for (const item of liveTraffic) {
      if (!item.started && frameTime < item.spawnTime) continue;
      if (!item.started) {
        item.started = true;
        const age = frameTime - item.spawnTime;
        item.relativeZ = item.initialRelativeZ - item.closing * age;
        item.x = xAfterWeave(item.lane, item.weave, item.phase, age);
        item.phase += age * 1.7;
      } else {
        item.phase += STEP * 1.7;
        const laneX = laneCenter(item.lane, ROAD.laneWidth, ROAD.laneCount);
        const targetX = laneX + Math.sin(item.phase) * item.weave;
        item.x += (targetX - item.x) * Math.min(1, STEP * 3.2);
        item.relativeZ -= item.closing * STEP;
      }
    }

    for (const state of states.values()) {
      for (const input of [-1, 0, 1]) {
        const vx = damp(state.vx, input * car.steer * authority, car.grip, STEP);
        let x = state.x + vx * STEP;
        let safeVx = vx;
        if (x > ROAD.driveLimit) {
          x = ROAD.driveLimit;
          safeVx = Math.min(0, vx);
        } else if (x < -ROAD.driveLimit) {
          x = -ROAD.driveLimit;
          safeVx = Math.max(0, vx);
        }
        const collides = liveTraffic.some((item) => {
          if (!item.started || item.closing <= 0) return false;
          const longHalf = LONG_HALF + (playerV + item.speed / 3.6) * STEP * 0.5;
          return Math.abs(item.relativeZ) < longHalf && Math.abs(x - item.x) < LAT_HALF;
        });
        if (collides) continue;
        const key = stateKey(x, safeVx);
        if (!next.has(key)) next.set(key, { x, vx: safeVx });
      }
    }
    if (!next.size) return false;
    states = next;
  }
  return true;
}

function patternIsReachable(
  pattern: Pattern,
  carId: (typeof CARS)[number]["id"],
  distance: number,
  phaseOffset = 0,
  boosted = false,
  upgraded = false,
) {
  const car = upgraded ? maxUpgradedModel(carId) : stockModel(carId);
  const playerSpeed = car.topSpeed * (boosted ? DRIVE.boostMultiplier : 1);
  const playerV = playerSpeed / 3.6;
  const lookahead = Math.max(SPAWN.minLookahead, playerV * SPAWN.lookaheadSeconds);
  const baseTrafficSpeed = difficultyAt(distance).trafficSpeed;
  const traffic = pattern.cars.map((spec, index) => {
    const speed = Math.max(40, baseTrafficSpeed + spec.speedOffset);
    return {
      lane: spec.lane,
      x: laneCenter(spec.lane, ROAD.laneWidth, ROAD.laneCount),
      relativeZ: lookahead + spec.zOffset,
      initialRelativeZ: lookahead + spec.zOffset,
      speed,
      closing: playerV - speed / 3.6,
      weave: spec.weave ?? 0,
      phase: phaseOffset + index * 0.71,
      spawnTime: 0,
    };
  });
  return trafficIsReachable(traffic, carId, playerSpeed, car);
}

function generateSpawnSequence(carId: (typeof CARS)[number]["id"], startDistance: number, packCount: number) {
  const car = CARS.find((candidate) => candidate.id === carId)!;
  const playerSpeed = car.topSpeed;
  const playerV = playerSpeed / 3.6;
  let playerZ = 0;
  let distance = startDistance;
  // Game.startRun seeds the first live traffic spawn at 1.6 seconds.
  let spawnClock = 1.6;
  let time = 0;
  let packs = 0;
  const names: string[] = [];
  const traffic: Traffic[] = [];

  while (packs < packCount && time < 30) {
    playerZ += playerV * STEP;
    distance += playerV * STEP;
    time += STEP;
    spawnClock -= STEP;
    if (spawnClock > 0 || distance <= SPAWN.introSafeDistance) continue;

    const difficulty = difficultyAt(distance);
    const lookahead = Math.max(SPAWN.minLookahead, playerV * SPAWN.lookaheadSeconds);
    const originZ = playerZ + lookahead;
    const active = traffic
      .filter((item) => item.initialRelativeZ - item.closing * (time - item.spawnTime) > -SPAWN.despawnBehind)
      .map((item) => ({ lane: item.lane, z: playerZ + item.initialRelativeZ - item.closing * (time - item.spawnTime) }));
    const blocked = lanesBlockedNear(active, originZ, 14);
    const pattern = pickFairPattern(distance, () => 0, blocked, active, originZ);
    if (pattern) {
      names.push(pattern.name);
      const cars = materializePattern(pattern, originZ, difficulty.trafficSpeed, difficulty.moverChance, () => 0);
      for (const [index, generated] of cars.entries()) {
        const speed = generated.speed;
        traffic.push({
          lane: generated.lane,
          x: generated.x,
          relativeZ: lookahead + pattern.cars[index].zOffset,
          initialRelativeZ: lookahead + pattern.cars[index].zOffset,
          speed,
          closing: playerV - speed / 3.6,
          weave: generated.weave,
          phase: generated.weavePhase,
          spawnTime: time,
        });
      }
      packs++;
    }
    spawnClock = difficulty.spawnInterval;
  }
  return { traffic, names };
}

describe("time-aware traffic reachability", () => {
  it("keeps every authored pack physically escapable at its unlock distance", () => {
    for (const pattern of PATTERNS) {
      for (const carId of ["surge", "drift"] as const) {
        expect(patternIsReachable(pattern, carId, pattern.minDistance), `${pattern.name} / ${carId}`).toBe(true);
      }
    }
  }, 30000);

  it("keeps boosted late-game packs escapable at several real traffic phases", () => {
    const latePatterns = PATTERNS.filter((pattern) => pattern.minDistance >= 1900);
    for (const pattern of latePatterns) {
      for (const phase of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
        expect(patternIsReachable(pattern, "surge", pattern.minDistance, phase, true), `${pattern.name} / phase ${phase}`).toBe(true);
      }
    }
  }, 30000);

  it("keeps max-upgraded, boosted Surge escapable across early, mid, and late traffic timing", () => {
    const model = maxUpgradedModel("surge");
    expect(model.topSpeed).toBeGreaterThan(stockModel("surge").topSpeed);
    for (const distance of [160, 1400, 5200]) {
      for (const pattern of patternPoolAt(distance)) {
        const phases = pattern.cars.some((item) => item.weave) ? [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2] : [0];
        for (const phase of phases) {
          expect(
            patternIsReachable(pattern, "surge", distance, phase, true, true),
            `${pattern.name} / ${distance}m / phase ${phase}`,
          ).toBe(true);
        }
      }
    }
  }, 30000);

  it("keeps the deterministic opening spawn sequence escapable", () => {
    const car = CARS.find((candidate) => candidate.id === "surge")!;
    const sequence = generateSpawnSequence("surge", 0, 6);
    expect(sequence.names).toHaveLength(6);
    expect(trafficIsReachable(sequence.traffic, "surge", car.topSpeed)).toBe(true);
  }, 30000);

  it("keeps overlapping high-difficulty packs escapable at the minimum spawn interval", () => {
    const car = CARS.find((candidate) => candidate.id === "surge")!;
    const sequence = generateSpawnSequence("surge", 5200, 8);
    expect(sequence.names).toHaveLength(8);
    expect(trafficIsReachable(sequence.traffic, "surge", car.topSpeed)).toBe(true);
  }, 30000);
});
