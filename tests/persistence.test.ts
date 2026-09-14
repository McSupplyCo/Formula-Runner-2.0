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

  it("keeps paid v3 livery paint when custom color fields are missing", () => {
    const next = migrateSave({
      version: 3,
      garage: { apex: { power: 1, chassis: 0, aero: 0, ers: 0, livery: "apex-harbor" } },
    });
    expect(next.garage.apex.livery).toBe("apex-harbor");
    expect(next.garage.apex.primary).toBe(0x1a6a7a);
    expect(next.garage.apex.secondary).toBe(0x0e2430);
    expect(next.garage.apex.accent).toBe(0xc4a035);
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

describe("cosmetics and world unlocks migrate additively", () => {
  it("fills trail, rim, and number defaults for a save written before they existed", () => {
    const next = migrateSave({
      version: 4,
      garage: {
        apex: { engine: 2, tires: 1, turbo: 0, aero: 0, livery: "apex-stock", primary: 1, secondary: 2, accent: 3 },
        drift: { engine: 0, tires: 0, turbo: 0, aero: 0, livery: "drift-stock" },
      },
    });
    expect(next.garage.apex.trail).toBe(0xffe0b8);
    expect(next.garage.apex.rim).toBe(0xb8c0c8);
    expect(next.garage.apex.number).toBe(1);
    expect(next.garage.apex.glow).toBe(0x00e5ff);
    expect(next.garage.drift.number).toBe(11);
    expect(next.garage.surge.number).toBe(27);
    expect(next.garage.apex.engine).toBe(2);
  });

  it("keeps stored cosmetics and clamps a tampered number", () => {
    const next = migrateSave({
      version: 4,
      garage: { apex: { engine: 0, livery: "apex-stock", trail: 0xff006e, rim: 0x1a1c20, number: 4000 } },
    });
    expect(next.garage.apex.trail).toBe(0xff006e);
    expect(next.garage.apex.rim).toBe(0x1a1c20);
    expect(next.garage.apex.number).toBe(99);
  });

  it("adds a stock Volt garage row to an older save", () => {
    const next = migrateSave({ version: 4, credits: 300, garage: { apex: { engine: 1 } } });
    expect(next.garage.volt).toBeDefined();
    expect(next.garage.volt.engine).toBe(0);
    expect(next.garage.volt.livery).toBe("volt-stock");
    expect(next.garage.volt.primary).toBe(0xffd600);
    expect(next.garage.volt.number).toBe(44);
    expect(next.ownedCars).not.toContain("volt");
    expect(next.ownedLiveries).toContain("volt-stock");
  });

  it("adds a stock Nyx garage row to an older save", () => {
    const next = migrateSave({ version: 4, credits: 300, garage: { apex: { engine: 1 } } });
    expect(next.garage.nyx).toBeDefined();
    expect(next.garage.nyx.engine).toBe(0);
    expect(next.garage.nyx.livery).toBe("nyx-stock");
    expect(next.garage.nyx.primary).toBe(0x7a5cff);
    expect(next.garage.nyx.number).toBe(88);
    expect(next.garage.nyx.glow).toBe(0x00e5ff);
    expect(next.ownedCars).not.toContain("nyx");
    expect(next.ownedLiveries).toContain("nyx-stock");
  });

  it("defaults the world fields and always keeps harbor owned", () => {
    const fresh = migrateSave({});
    expect(fresh.selectedWorld).toBe("harbor");
    expect(fresh.ownedWorlds).toEqual(["harbor"]);
    expect(fresh.hudSkin).toBe("classic");
    expect(migrateSave({ ownedWorlds: ["canyon"] }).ownedWorlds).toContain("harbor");
    expect(migrateSave({ ownedWorlds: "nope" }).ownedWorlds).toEqual(["harbor"]);
  });

  it("rejects unknown world and HUD skin values instead of trusting them", () => {
    const next = migrateSave({ selectedWorld: "moon", ownedWorlds: ["harbor", "moon"], hudSkin: "neon" });
    expect(next.selectedWorld).toBe("harbor");
    expect(next.ownedWorlds).toEqual(["harbor"]);
    expect(next.hudSkin).toBe("classic");
  });

  it("keeps a legitimately owned world selected", () => {
    const next = migrateSave({ selectedWorld: "ridge", ownedWorlds: ["harbor", "ridge"], hudSkin: "broadcast" });
    expect(next.selectedWorld).toBe("ridge");
    expect(next.ownedWorlds).toEqual(["harbor", "ridge"]);
    expect(next.hudSkin).toBe("broadcast");
  });

  it("keeps voltage and timing HUD skins and falls back from unknown", () => {
    expect(migrateSave({ hudSkin: "voltage" }).hudSkin).toBe("voltage");
    expect(migrateSave({ hudSkin: "timing" }).hudSkin).toBe("timing");
    expect(migrateSave({ hudSkin: "neon" }).hudSkin).toBe("classic");
  });

  it("does not checksum cosmetics, world, or HUD skin", () => {
    const save = withChecksum(defaultSave());
    expect(checksumMatches({ ...save, hudSkin: "ghost" })).toBe(true);
    expect(checksumMatches({ ...save, selectedWorld: "ember", ownedWorlds: ["harbor", "ember"] })).toBe(true);
    expect(
      checksumMatches({
        ...save,
        garage: { ...save.garage, apex: { ...save.garage.apex, trail: 0x123456, rim: 0x654321, number: 7, glow: 0xff2bd6 } },
      }),
    ).toBe(true);
    expect(
      checksumMatches({
        ...save,
        garage: { ...save.garage, apex: { ...save.garage.apex, glow: 0xff5a2a } },
      }),
    ).toBe(true);
  });
});
