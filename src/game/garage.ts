import { WORLDS, type WorldId } from "./circuits";
import { CARS, CREDIT, DRIVE, MAX_PART_RANK, UPGRADE, type CarId } from "./tuning";
import { clamp } from "./math";

export type { WorldId };

export type PartId = "engine" | "tires" | "turbo" | "aero";

export type CarGarage = {
  engine: number;
  tires: number;
  turbo: number;
  aero: number;
  livery: string;
  primary: number;
  secondary: number;
  accent: number;
  /** Boost trail hex. */
  trail: number;
  /** Wheel rim hex. */
  rim: number;
  /** Racing number, 0-99. */
  number: number;
  /** Underglow hex. */
  glow: number;
};

export type GarageState = {
  credits: number;
  ownedCars: CarId[];
  ownedLiveries: string[];
  selectedCar: CarId;
  bestDistance: number;
  garage: Record<CarId, CarGarage>;
  ownedWorlds?: string[];
  selectedWorld?: string;
};

export type WorldState = {
  credits: number;
  bestDistance: number;
  ownedWorlds: string[];
  selectedWorld: string;
};

export type BuyResult<T = GarageState> = { save: T; ok: boolean; hint: string };

export type FittedSpec = {
  id: CarId;
  topSpeed: number;
  accel: number;
  brake: number;
  steer: number;
  grip: number;
  boostDrain: number;
  boostMinCharge: number;
  boostNearMissCharge: number;
  steerLossScale: number;
  color: number;
  secondary: number;
  accent: number;
  trail: number;
  rim: number;
  number: number;
  glow: number;
};

export type PartInfo = {
  id: PartId;
  name: string;
  blurb: string;
  impact: string;
};

export const PARTS: PartInfo[] = [
  { id: "engine", name: "Engine", blurb: "Gets you back to traffic faster.", impact: "Acceleration" },
  { id: "tires", name: "Tires", blurb: "Sharper lane changes when it counts.", impact: "Steering and grip" },
  { id: "turbo", name: "Turbo", blurb: "Boost fills faster and lasts longer.", impact: "Boost charge and duration" },
  { id: "aero", name: "Aero", blurb: "More top end, less wash-out at speed.", impact: "Top speed and high-speed hold" },
];

export const LIVERIES = [
  { id: "apex-stock", car: "apex" as const, name: "Factory", cost: 0, color: 0x00e5ff, secondary: 0x0a1628, accent: 0xff006e },
  { id: "apex-harbor", car: "apex" as const, name: "Harbor", cost: 420, color: 0x1a6a7a, secondary: 0x0e2430, accent: 0xc4a035 },
  { id: "apex-void", car: "apex" as const, name: "Void", cost: 780, color: 0x12161c, secondary: 0x1c222c, accent: 0x00e5ff },
  { id: "drift-stock", car: "drift" as const, name: "Factory", cost: 0, color: 0x39ff14, secondary: 0x102018, accent: 0xffd600 },
  { id: "drift-moss", car: "drift" as const, name: "Moss", cost: 420, color: 0x1f4a28, secondary: 0x121810, accent: 0xd8c48a },
  { id: "drift-gold", car: "drift" as const, name: "Gold stripe", cost: 780, color: 0x2a8a48, secondary: 0x102418, accent: 0xffd600 },
  { id: "surge-stock", car: "surge" as const, name: "Factory", cost: 0, color: 0xff006e, secondary: 0x1a0810, accent: 0x00e5ff },
  { id: "surge-wine", car: "surge" as const, name: "Wine", cost: 420, color: 0x6a1028, secondary: 0x180810, accent: 0xe8dcc8 },
  { id: "surge-ivory", car: "surge" as const, name: "Ivory", cost: 780, color: 0xd8dde4, secondary: 0x2a3038, accent: 0xff006e },
  { id: "apex-ion", car: "apex" as const, name: "Ion", cost: 960, color: 0x6a4cff, secondary: 0x0c1020, accent: 0x00e5ff },
  { id: "apex-sun", car: "apex" as const, name: "Sun", cost: 960, color: 0xc4a035, secondary: 0x1a1408, accent: 0xff006e },
  { id: "drift-ice", car: "drift" as const, name: "Ice", cost: 960, color: 0xc8f0ff, secondary: 0x102028, accent: 0x39ff14 },
  { id: "surge-night", car: "surge" as const, name: "Night", cost: 960, color: 0x1a0828, secondary: 0x080410, accent: 0xff006e },
  { id: "volt-stock", car: "volt" as const, name: "Factory", cost: 0, color: 0xffd600, secondary: 0x1c1804, accent: 0x00e5ff },
  { id: "volt-amp", car: "volt" as const, name: "Amp", cost: 420, color: 0x2a2410, secondary: 0x101008, accent: 0x00e5ff },
  { id: "volt-arc", car: "volt" as const, name: "Arc", cost: 780, color: 0xf4e8c0, secondary: 0x242018, accent: 0xff006e },
  { id: "volt-ion", car: "volt" as const, name: "Ion", cost: 960, color: 0x1a1028, secondary: 0x0c0814, accent: 0xff2bd6 },
  { id: "volt-gate", car: "volt" as const, name: "Gate", cost: 960, color: 0x0c2820, secondary: 0x061410, accent: 0x3dffc8 },
  { id: "nyx-stock", car: "nyx" as const, name: "Factory", cost: 0, color: 0x7a5cff, secondary: 0x12081c, accent: 0xff2bd6 },
  { id: "nyx-veil", car: "nyx" as const, name: "Veil", cost: 420, color: 0x1a1028, secondary: 0x0a0614, accent: 0x7a5cff },
  { id: "nyx-bloom", car: "nyx" as const, name: "Bloom", cost: 780, color: 0xe8d8ff, secondary: 0x241830, accent: 0xff2bd6 },
  { id: "nyx-void", car: "nyx" as const, name: "Void", cost: 960, color: 0x08060c, secondary: 0x101018, accent: 0xb8e8ff },
] as const;

export type LiveryId = (typeof LIVERIES)[number]["id"];

export const TRAILS = [
  { id: "heat", name: "Heat", color: 0xffe0b8, cost: 0 },
  { id: "cyan", name: "Cyan", color: 0x00e5ff, cost: 220 },
  { id: "volt", name: "Volt", color: 0xffd600, cost: 220 },
  { id: "magenta", name: "Magenta", color: 0xff006e, cost: 220 },
  { id: "ghost", name: "Ghost", color: 0xd8e6f0, cost: 360 },
  { id: "lime", name: "Lime", color: 0x39ff14, cost: 220 },
  { id: "ember", name: "Ember", color: 0xff7a1a, cost: 280 },
  { id: "ice", name: "Ice", color: 0xb8e8ff, cost: 280 },
  { id: "violet", name: "Violet", color: 0x7a5cff, cost: 280 },
] as const;

export const RIMS = [
  { id: "silver", name: "Silver", color: 0xb8c0c8, cost: 0 },
  { id: "gold", name: "Gold", color: 0xd4b45a, cost: 280 },
  { id: "black", name: "Black", color: 0x1a1c20, cost: 180 },
  { id: "cyan", name: "Cyan", color: 0x7ad4e2, cost: 280 },
  { id: "magenta", name: "Magenta", color: 0xff4aa2, cost: 280 },
  { id: "mint", name: "Mint", color: 0x3dffc8, cost: 280 },
  { id: "ice", name: "Ice", color: 0xc8e4f4, cost: 280 },
  { id: "violet", name: "Violet", color: 0x8a70e0, cost: 280 },
] as const;

export const GLOWS = [
  { id: "off", name: "Dim", color: 0x1a222c },
  { id: "cyan", name: "Cyan", color: 0x00e5ff },
  { id: "magenta", name: "Magenta", color: 0xff006e },
  { id: "volt", name: "Volt", color: 0xffd600 },
  { id: "ice", name: "Ice", color: 0xb8e8ff },
  { id: "kiln", name: "Kiln", color: 0xff5a2a },
  { id: "violet", name: "Violet", color: 0x7a5cff },
] as const;

export type TrailId = (typeof TRAILS)[number]["id"];
export type RimId = (typeof RIMS)[number]["id"];
export type GlowId = (typeof GLOWS)[number]["id"];

export const DEFAULT_TRAIL = 0xffe0b8;
export const DEFAULT_RIM = 0xb8c0c8;
export const DEFAULT_GLOW = 0x00e5ff;

export const WORLD_UNLOCK = WORLDS.map((world) => ({
  id: world.id,
  name: world.name,
  unlockBest: world.unlockBest,
  unlockCost: world.unlockCost,
}));

export const HOME_WORLD: WorldId = "harbor";

const CAR_NUMBERS: Record<string, number> = {
  apex: 1,
  drift: 11,
  surge: 27,
  volt: 44,
  nyx: 88,
};

export function defaultCarNumber(car: CarId): number {
  return CAR_NUMBERS[car] ?? 1;
}

export type CreditRun = {
  distance: number;
  nearMisses: number;
  overtakes: number;
  maxCombo?: number;
  personalBest: boolean;
};

export function emptyCarGarage(car: CarId): CarGarage {
  const stock = LIVERIES.find((item) => item.car === car && item.cost === 0);
  return {
    engine: 0,
    tires: 0,
    turbo: 0,
    aero: 0,
    livery: `${car}-stock`,
    primary: stock?.color ?? 0x00e5ff,
    secondary: stock?.secondary ?? 0x0a1628,
    accent: stock?.accent ?? 0xff006e,
    trail: DEFAULT_TRAIL,
    rim: DEFAULT_RIM,
    number: defaultCarNumber(car),
    glow: DEFAULT_GLOW,
  };
}

export function emptyGarage(): Record<CarId, CarGarage> {
  return Object.fromEntries(CARS.map((car) => [car.id, emptyCarGarage(car.id)])) as Record<CarId, CarGarage>;
}

export function stockLiveries(): string[] {
  return LIVERIES.filter((item) => item.cost === 0).map((item) => item.id);
}

export function creditPayout(run: CreditRun): number {
  const distance = clamp(Number.isFinite(run.distance) ? run.distance : 0, 0, 20_000);
  const near = clamp(Math.floor(run.nearMisses || 0), 0, 80);
  const pass = clamp(Math.floor(run.overtakes || 0), 0, 80);
  const combo = clamp(Math.floor(run.maxCombo || 0), 0, 8);
  const raw =
    CREDIT.base +
    distance * CREDIT.perMeter +
    near * CREDIT.nearMiss +
    pass * CREDIT.overtake +
    combo * CREDIT.combo +
    (run.personalBest ? CREDIT.personalBest : 0);
  return clamp(Math.round(raw), 0, CREDIT.maxPayout);
}

export function carPartCap(): number {
  return PARTS.length * MAX_PART_RANK;
}

export function upgradePool(): number {
  return CARS.length * carPartCap();
}

export function rankCost(nextRank: number): number {
  if (nextRank < 1 || nextRank > MAX_PART_RANK) return Number.POSITIVE_INFINITY;
  return Math.round(UPGRADE.rankBase * UPGRADE.rankGrowth ** (nextRank - 1));
}

export function treeCost(ranks = MAX_PART_RANK): number {
  let total = 0;
  for (let rank = 1; rank <= ranks; rank++) total += rankCost(rank);
  return total;
}

export function ownsCar(save: GarageState, id: CarId): boolean {
  return save.ownedCars.includes(id);
}

export function carAvailable(save: GarageState, id: CarId): boolean {
  const def = CARS.find((car) => car.id === id);
  return Boolean(def && save.bestDistance >= def.unlockBest);
}

export function partTotal(row: CarGarage): number {
  return row.engine + row.tires + row.turbo + row.aero;
}

export function partRequirement(row: CarGarage, part: PartId, nextRank: number): string | null {
  if (nextRank < 1 || nextRank > MAX_PART_RANK) return "That part is maxed.";
  if (nextRank <= 3) return null;
  const others = PARTS.filter((item) => item.id !== part).map((item) => row[item.id]);
  if (nextRank <= 6) {
    if (others.every((rank) => rank < 2)) return "Raise another part to rank 2 first.";
    return null;
  }
  if (nextRank <= 9) {
    if (others.filter((rank) => rank >= 3).length < 2) return "Need two other parts at rank 3.";
    return null;
  }
  if (others.some((rank) => rank < 5)) return "Need every other part at rank 5.";
  return null;
}

function scaled(cap: number, rank: number): number {
  return (cap * clamp(Math.floor(rank), 0, MAX_PART_RANK)) / MAX_PART_RANK;
}

export function fittedSpec(save: GarageState, id: CarId): FittedSpec {
  const def = CARS.find((car) => car.id === id) ?? CARS[0];
  const row = save.garage[def.id] ?? emptyCarGarage(def.id);
  const preset = LIVERIES.find((item) => item.id === row.livery);
  return {
    id: def.id,
    topSpeed: def.topSpeed + scaled(UPGRADE.aeroTopSpeed, row.aero),
    accel: def.accel + scaled(UPGRADE.engineAccel, row.engine),
    brake: def.brake,
    steer: def.steer + scaled(UPGRADE.tiresSteer, row.tires),
    grip: def.grip + scaled(UPGRADE.tiresGrip, row.tires),
    boostDrain: Math.max(0.28, DRIVE.boostDrain - scaled(UPGRADE.turboDrain, row.turbo)),
    boostMinCharge: DRIVE.boostMinCharge,
    boostNearMissCharge: DRIVE.boostNearMissCharge + scaled(UPGRADE.turboCharge, row.turbo),
    steerLossScale: 1 - scaled(UPGRADE.aeroSteerHold, row.aero),
    color: Number.isFinite(row.primary) ? row.primary : preset?.color || def.color,
    secondary: Number.isFinite(row.secondary) ? row.secondary : preset?.secondary || 0x0a1628,
    accent: Number.isFinite(row.accent) ? row.accent : preset?.accent || def.accent,
    trail: Number.isFinite(row.trail) ? row.trail : DEFAULT_TRAIL,
    rim: Number.isFinite(row.rim) ? row.rim : DEFAULT_RIM,
    number: clamp(Math.floor(Number.isFinite(row.number) ? row.number : defaultCarNumber(def.id)), 0, 99),
    glow: Number.isFinite(row.glow) ? row.glow : DEFAULT_GLOW,
  };
}

export function partDelta(part: PartId, fromRank: number, toRank: number): string {
  const a = fromRank;
  const b = toRank;
  if (part === "engine") return `Accel ${scaled(UPGRADE.engineAccel, a).toFixed(1)} → ${scaled(UPGRADE.engineAccel, b).toFixed(1)}`;
  if (part === "tires") {
    return `Steer +${scaled(UPGRADE.tiresSteer, b).toFixed(1)} · Grip +${scaled(UPGRADE.tiresGrip, b).toFixed(1)}`;
  }
  if (part === "turbo") {
    return `Charge +${scaled(UPGRADE.turboCharge, b).toFixed(2)} · Drain −${scaled(UPGRADE.turboDrain, b).toFixed(2)}`;
  }
  return `Top speed +${scaled(UPGRADE.aeroTopSpeed, b).toFixed(0)} kph · Hold +${Math.round(scaled(UPGRADE.aeroSteerHold, b) * 100)}%`;
}

export function buyPart<T extends GarageState>(save: T, carId: CarId, part: PartId): BuyResult<T> {
  if (!ownsCar(save, carId)) return { save, ok: false, hint: "Buy the car first." };
  if (!PARTS.some((item) => item.id === part)) return { save, ok: false, hint: "Unknown part." };
  const row = { ...(save.garage[carId] ?? emptyCarGarage(carId)) };
  const next = row[part] + 1;
  if (next > MAX_PART_RANK) return { save, ok: false, hint: "That part is maxed." };
  const locked = partRequirement(row, part, next);
  if (locked) return { save, ok: false, hint: locked };
  const cost = rankCost(next);
  const credits = Math.floor(save.credits);
  if (credits < cost) return { save, ok: false, hint: `Need ${formatCredits(cost)}.` };
  row[part] = next;
  const name = PARTS.find((item) => item.id === part)?.name ?? part;
  return {
    save: {
      ...save,
      credits: credits - cost,
      garage: { ...save.garage, [carId]: row },
    },
    ok: true,
    hint: `${name} fitted · ${partDelta(part, next - 1, next)}`,
  };
}

export function buyCar<T extends GarageState>(save: T, carId: CarId): BuyResult<T> {
  const def = CARS.find((car) => car.id === carId);
  if (!def) return { save, ok: false, hint: "Unknown car." };
  if (ownsCar(save, carId)) return { save, ok: false, hint: "Already on the grid." };
  if (save.bestDistance < def.unlockBest) {
    return { save, ok: false, hint: `Unlock at ${def.unlockBest.toLocaleString("en-US")} m.` };
  }
  const credits = Math.floor(save.credits);
  if (credits < def.unlockCost) return { save, ok: false, hint: `Need ${formatCredits(def.unlockCost)}.` };
  return {
    save: {
      ...save,
      credits: credits - def.unlockCost,
      ownedCars: [...save.ownedCars, carId],
      selectedCar: carId,
    },
    ok: true,
    hint: `${def.name} is yours. Stock trim — spec it.`,
  };
}

export function buyLivery<T extends GarageState>(save: T, liveryId: string): BuyResult<T> {
  const livery = LIVERIES.find((item) => item.id === liveryId);
  if (!livery) return { save, ok: false, hint: "Unknown livery." };
  if (!ownsCar(save, livery.car)) return { save, ok: false, hint: "Buy the car first." };
  if (save.ownedLiveries.includes(livery.id)) {
    return { save: paintCar(save, livery.car, livery.color, livery.secondary, livery.accent, livery.id), ok: true, hint: `${livery.name} equipped.` };
  }
  const credits = Math.floor(save.credits);
  if (credits < livery.cost) return { save, ok: false, hint: `Need ${formatCredits(livery.cost)}.` };
  const next = paintCar(save, livery.car, livery.color, livery.secondary, livery.accent, livery.id);
  return {
    save: {
      ...next,
      credits: credits - livery.cost,
      ownedLiveries: [...next.ownedLiveries, livery.id],
    },
    ok: true,
    hint: `${livery.name} equipped.`,
  };
}

export function paintCar<T extends GarageState>(
  save: T,
  carId: CarId,
  primary: number,
  secondary: number,
  accent: number,
  liveryId?: string,
): T {
  if (!ownsCar(save, carId)) return save;
  const row = { ...(save.garage[carId] ?? emptyCarGarage(carId)) };
  row.primary = primary >>> 0;
  row.secondary = secondary >>> 0;
  row.accent = accent >>> 0;
  row.livery = liveryId ?? `${carId}-custom`;
  return { ...save, garage: { ...save.garage, [carId]: row } };
}

/** Trails, rims, and numbers are free presentation — the money sink is parts and liveries. */
export function paintTrail<T extends GarageState>(save: T, carId: CarId, color: number): T {
  return withRow(save, carId, (row) => {
    row.trail = color >>> 0;
  });
}

export function paintRim<T extends GarageState>(save: T, carId: CarId, color: number): T {
  return withRow(save, carId, (row) => {
    row.rim = color >>> 0;
  });
}

export function paintGlow<T extends GarageState>(save: T, carId: CarId, color: number): T {
  return withRow(save, carId, (row) => {
    row.glow = color >>> 0;
  });
}

export function setCarNumber<T extends GarageState>(save: T, carId: CarId, n: number): T {
  return withRow(save, carId, (row) => {
    row.number = clamp(Math.floor(Number.isFinite(n) ? n : row.number), 0, 99);
  });
}

function withRow<T extends GarageState>(save: T, carId: CarId, apply: (row: CarGarage) => void): T {
  if (!ownsCar(save, carId)) return save;
  const row = { ...(save.garage[carId] ?? emptyCarGarage(carId)) };
  apply(row);
  return { ...save, garage: { ...save.garage, [carId]: row } };
}

export function worldDef(id: string) {
  return WORLD_UNLOCK.find((world) => world.id === id) ?? null;
}

export function worldAvailable(save: { bestDistance: number }, id: WorldId): boolean {
  const def = worldDef(id);
  return Boolean(def && save.bestDistance >= def.unlockBest);
}

export function ownsWorld(save: { ownedWorlds: string[] }, id: WorldId): boolean {
  return id === HOME_WORLD || save.ownedWorlds.includes(id);
}

export function buyWorld<T extends WorldState>(save: T, id: WorldId): BuyResult<T> {
  const def = worldDef(id);
  if (!def) return { save, ok: false, hint: "Unknown circuit." };
  if (ownsWorld(save, id)) {
    if (save.selectedWorld === id) return { save, ok: true, hint: `${def.name} selected.` };
    return { save: { ...save, selectedWorld: id }, ok: true, hint: `${def.name} selected.` };
  }
  if (save.bestDistance < def.unlockBest) {
    return { save, ok: false, hint: `Unlock at ${def.unlockBest.toLocaleString("en-US")} m.` };
  }
  const credits = Math.floor(save.credits);
  if (credits < def.unlockCost) return { save, ok: false, hint: `Need ${formatCredits(def.unlockCost)}.` };
  return {
    save: {
      ...save,
      credits: credits - def.unlockCost,
      ownedWorlds: [...save.ownedWorlds, id],
      selectedWorld: id,
    },
    ok: true,
    hint: `${def.name} unlocked.`,
  };
}

export function equipLivery<T extends GarageState>(save: T, liveryId: string): T {
  const livery = LIVERIES.find((item) => item.id === liveryId);
  if (!livery || !save.ownedLiveries.includes(livery.id)) return save;
  return paintCar(save, livery.car, livery.color, livery.secondary, livery.accent, livery.id);
}

export function formatCredits(value: number): string {
  return `${Math.floor(Math.max(0, value)).toLocaleString("en-US")} CR`;
}
