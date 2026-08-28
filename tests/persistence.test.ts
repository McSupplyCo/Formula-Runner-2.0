import { describe, expect, it } from "vitest";
import { emptyCarGarage } from "../src/game/garage";
import { commitRun, defaultSave, fingerprint, migrateSave, checksumMatches, withChecksum } from "../src/game/save";
import { SAVE_VERSION } from "../src/game/tuning";

describe("save v4 migration", () => {
  it("maps v3 part names onto Engine/Tires/Turbo/Aero without wiping credits", () => {
    const next = migrateSave({
      version: 3,
      credits: 640,
      bestDistance: 1800,
      selectedCar: "apex",
      ownedCars: ["apex", "drift"],
      garage: {
        apex: { power: 4, chassis: 3, aero: 2, ers: 1, livery: "apex-stock" },
      },
    });
    expect(next.version).toBe(SAVE_VERSION);
    expect(next.credits).toBe(640);
    expect(next.garage.apex.engine).toBe(4);
    expect(next.garage.apex.aero).toBe(3);
    expect(next.garage.apex.tires).toBe(2);
    expect(next.garage.apex.turbo).toBe(1);
    expect(next.ownedCars).toContain("drift");
  });

  it("keeps v4 ranks when engine/tires keys are already present", () => {
    const next = migrateSave({
      version: 4,
      credits: 200,
      garage: {
        apex: { engine: 5, tires: 4, turbo: 3, aero: 2, livery: "apex-stock", primary: 1, secondary: 2, accent: 3 },
      },
    });
    expect(next.garage.apex.engine).toBe(5);
    expect(next.garage.apex.tires).toBe(4);
    expect(next.garage.apex.turbo).toBe(3);
    expect(next.garage.apex.aero).toBe(2);
    expect(next.garage.apex.primary).toBe(1);
  });

  it("does not treat a v4 aero rank as v3 tires when engine keys are omitted", () => {
    const next = migrateSave({
      version: 4,
      garage: { apex: { aero: 7, livery: "apex-stock" } },
    });
    expect(next.garage.apex.aero).toBe(7);
    expect(next.garage.apex.tires).toBe(0);
    expect(next.garage.apex.engine).toBe(0);
  });

  it("caps migrated ranks at the new max instead of resetting", () => {
    const next = migrateSave({
      version: 3,
      credits: 10,
      garage: { apex: { power: 21, chassis: 18, aero: 9, ers: 21 } },
    });
    expect(next.garage.apex.engine).toBe(12);
    expect(next.garage.apex.aero).toBe(12);
    expect(next.garage.apex.tires).toBe(9);
    expect(next.garage.apex.turbo).toBe(12);
  });

  it("recovers from invalid JSON-like objects", () => {
    const next = migrateSave({ credits: "nope", selectedCar: "ferrari", garage: null });
    expect(next.selectedCar).toBe("apex");
    expect(next.credits).toBe(0);
    expect(next.garage.apex.engine).toBe(0);
  });

  it("writes a stable checksum that covers paint and HUD side", () => {
    const save = withChecksum(defaultSave());
    expect(save.checksum).toBe(fingerprint(save));
    const mutated = { ...save, credits: 50 };
    expect(fingerprint(mutated)).not.toBe(save.checksum);
    expect(checksumMatches(save)).toBe(true);
    expect(checksumMatches({ ...save, credits: 9999 })).toBe(false);
    expect(checksumMatches({ ...save, hudSpeedSide: "right" })).toBe(false);
  });
});

describe("run settlement", () => {
  it("is idempotent for the same run id", () => {
    const first = commitRun(defaultSave(), {
      id: "run-abc",
      score: 400,
      distance: 300,
      combo: 2,
      nearMisses: 1,
      overtakes: 1,
    });
    expect(first.duplicate).toBe(false);
    expect(first.earned).toBeGreaterThan(0);
    const again = commitRun(first.save, {
      id: "run-abc",
      score: 400,
      distance: 300,
      combo: 2,
      nearMisses: 1,
      overtakes: 1,
    });
    expect(again.duplicate).toBe(true);
    expect(again.earned).toBe(0);
    expect(again.save.credits).toBe(first.save.credits);
    expect(again.save.totalRuns).toBe(first.save.totalRuns);
  });

  it("does not apply a paused replay as a second payout", () => {
    const a = commitRun(defaultSave(), { id: "live", score: 100, distance: 120, combo: 1 });
    const b = commitRun(a.save, { id: "live", score: 100, distance: 120, combo: 1 });
    expect(b.save.crashCount).toBe(1);
  });

  it("preserves custom livery colors through migrate", () => {
    const row = { ...emptyCarGarage("apex"), primary: 0x112233, secondary: 0x445566, accent: 0x778899 };
    const next = migrateSave({
      version: 4,
      garage: { apex: row },
      ownedLiveries: ["apex-stock"],
    });
    expect(next.garage.apex.primary).toBe(0x112233);
    expect(next.garage.apex.secondary).toBe(0x445566);
    expect(next.garage.apex.accent).toBe(0x778899);
  });
});
