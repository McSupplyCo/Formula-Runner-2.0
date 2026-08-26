import { describe, expect, it } from "vitest";
import { aabbOverlap, clamp, laneCenter, sweptOverlap } from "../src/game/math";
import { hits, hitsBarrier } from "../src/game/collision";
import { openLanes, PATTERNS, pickPattern } from "../src/game/patterns";
import {
  commitRun,
  defaultSave,
  migrateSave,
} from "../src/game/save";
import {
  buyCar,
  buyPart,
  creditPayout,
  fittedSpec,
} from "../src/game/garage";
import {
  difficultyAt,
  distanceScore,
  nearMissScore,
  overtakeScore,
  registerNearMiss,
  speedMultiplier,
  tickCombo,
} from "../src/game/scoring";
import { emptyRun } from "../src/game/state";
import { BLOOM, CAMERA, CHASSIS, ROAD } from "../src/game/tuning";

describe("camera feel tuning", () => {
  it("keeps chase camera contract names", () => {
    expect(CAMERA.fovIdle).toBeLessThan(CAMERA.fovFast);
    expect(CAMERA.follow).toBeGreaterThan(CAMERA.lag);
    expect(CAMERA.fovBoostExtra).toBeGreaterThan(0);
    expect(CAMERA.height).toBeGreaterThan(0);
    expect(CAMERA.back).toBeGreaterThan(0);
    expect(BLOOM.threshold).toBeGreaterThan(0.5);
    expect(CHASSIS.rollMax).toBeLessThan(0.5);
  });
});

describe("scoring", () => {
  it("increases score with speed", () => {
    const slow = distanceScore(10, 80, 250);
    const fast = distanceScore(10, 240, 250);
    expect(fast).toBeGreaterThan(slow);
  });

  it("caps speed bonus", () => {
    expect(speedMultiplier(1000, 250)).toBeCloseTo(1 + 1.15 * 1.65, 5);
  });

  it("rewards closer near misses more", () => {
    expect(nearMissScore(2, 0.3)).toBeGreaterThan(nearMissScore(2, 2));
  });

  it("builds and decays combo", () => {
    const hit = registerNearMiss(0);
    expect(hit.combo).toBe(1);
    const held = tickCombo(hit.combo, hit.timer, 0.5);
    expect(held.combo).toBe(1);
    const dropped = tickCombo(hit.combo, hit.timer, 3);
    expect(dropped.combo).toBe(0);
  });

  it("ramps difficulty with distance", () => {
    const easy = difficultyAt(0);
    const hard = difficultyAt(4500);
    expect(hard.spawnInterval).toBeLessThan(easy.spawnInterval);
    expect(hard.trafficSpeed).toBeGreaterThan(easy.trafficSpeed);
  });

  it("scales overtakes with combo", () => {
    expect(overtakeScore(8)).toBeGreaterThan(overtakeScore(1));
  });
});

describe("save migration", () => {
  it("creates defaults from empty data", () => {
    expect(migrateSave(null).version).toBe(3);
    expect(migrateSave({}).selectedCar).toBe("apex");
    expect(migrateSave({}).credits).toBe(0);
    expect(migrateSave({}).ownedCars).toEqual(["apex"]);
  });

  it("keeps a v1 best distance", () => {
    const next = migrateSave({ bestDistance: 1400, version: 1 });
    expect(next.bestDistance).toBe(1400);
    expect(next.version).toBe(3);
    expect(next.ownedCars).toEqual(["apex"]);
  });

  it("does not gift cars on a long run", () => {
    const save = commitRun(defaultSave(), { score: 9000, distance: 2300, combo: 4, nearMisses: 2, overtakes: 1 });
    expect(save.ownedCars).toEqual(["apex"]);
    expect(save.bestDistance).toBe(2300);
    expect(save.credits).toBeGreaterThan(0);
  });

  it("falls back from unknown car ids", () => {
    expect(migrateSave({ selectedCar: "ferrari" }).selectedCar).toBe("apex");
  });
});

describe("garage", () => {
  it("pays more credits for near misses and a personal best", () => {
    const short = creditPayout({ distance: 200, nearMisses: 0, overtakes: 0, personalBest: false });
    const rich = creditPayout({ distance: 200, nearMisses: 3, overtakes: 2, personalBest: true });
    expect(rich).toBeGreaterThan(short);
  });

  it("buys one part rank and refuses if broke", () => {
    const broke = buyPart(defaultSave(), "apex", "power");
    expect(broke.ok).toBe(false);
    const funded = { ...defaultSave(), credits: 200 };
    const bought = buyPart(funded, "apex", "power");
    expect(bought.ok).toBe(true);
    expect(bought.save.garage.apex.power).toBe(1);
    expect(bought.save.credits).toBe(80);
    expect(fittedSpec(bought.save, "apex").accel).toBeGreaterThan(fittedSpec(funded, "apex").accel);
  });

  it("requires distance and credits before selling Drift", () => {
    const early = buyCar(defaultSave(), "drift");
    expect(early.ok).toBe(false);
    const far = buyCar({ ...defaultSave(), bestDistance: 900, credits: 100 }, "drift");
    expect(far.ok).toBe(false);
    const paid = buyCar({ ...defaultSave(), bestDistance: 900, credits: 800 }, "drift");
    expect(paid.ok).toBe(true);
    expect(paid.save.ownedCars).toContain("drift");
    expect(paid.save.credits).toBe(0);
    expect(paid.save.garage.drift.power).toBe(0);
  });
});

describe("collision", () => {
  it("detects overlapping boxes", () => {
    expect(
      aabbOverlap(
        { x: 0, z: 0, halfW: 1, halfL: 2 },
        { x: 1.5, z: 0, halfW: 1, halfL: 2 },
      ),
    ).toBe(true);
  });

  it("uses swept overlap at high speed", () => {
    const a = { x: 0, z: 0, vx: 0, vz: 80, width: 1.6, length: 4 };
    const b = { x: 0, z: 6, vx: 0, vz: 0, width: 1.6, length: 4 };
    expect(hits(a, b, 0.1)).toBe(true);
  });

  it("does not false-positive a clean pass", () => {
    const a = { x: -3, z: 0, vx: 0, vz: 20, width: 1.6, length: 4 };
    const b = { x: 3, z: 8, vx: 0, vz: 10, width: 1.8, length: 4 };
    expect(hits(a, b, 0.016)).toBe(false);
  });

  it("flags barrier contact", () => {
    expect(hitsBarrier(ROAD.driveLimit + 0.5, ROAD.driveLimit, 0.86)).toBe(true);
    expect(hitsBarrier(0, ROAD.driveLimit, 0.86)).toBe(false);
  });
});

describe("traffic patterns", () => {
  it("never fully blocks the road in the first cars of a pattern", () => {
    for (const pattern of PATTERNS) {
      expect(openLanes(pattern).length).toBeGreaterThan(0);
    }
  });

  it("only picks eligible patterns", () => {
    const early = pickPattern(0, () => 0);
    expect(early.minDistance).toBe(0);
  });

  it("places lane centers inside the road", () => {
    const x = laneCenter(0, ROAD.laneWidth, ROAD.laneCount);
    expect(Math.abs(x)).toBeLessThan(ROAD.halfWidth);
  });
});

describe("state", () => {
  it("starts a clean run", () => {
    const run = emptyRun();
    expect(run.score).toBe(0);
    expect(run.combo).toBe(0);
    expect(run.boosting).toBe(false);
  });
});

describe("math", () => {
  it("clamps and sweeps conservatively", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(
      sweptOverlap(
        { x: 0, z: 0, halfW: 1, halfL: 1 },
        4,
        { x: 0, z: 3, halfW: 1, halfL: 1 },
        0,
      ),
    ).toBe(true);
  });
});
