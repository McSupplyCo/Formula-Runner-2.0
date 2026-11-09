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
  // Keep the legacy cosmetic IDs readable so existing save references remain valid.
  { id: "apex-stock", car: "sixties" as const, name: "Workshop Ivory", cost: 0, color: 0xe7dfc9, secondary: 0x1f2526, accent: 0xc4452d },
  { id: "apex-harbor", car: "sixties" as const, name: "Racing Green", cost: 420, color: 0x174a38, secondary: 0x14221c, accent: 0xd8bf8b },
  { id: "apex-void", car: "sixties" as const, name: "Carbon Black", cost: 780, color: 0x202425, secondary: 0x101314, accent: 0xd5c49b },
  { id: "drift-stock", car: "seventies" as const, name: "Workshop Ivory", cost: 0, color: 0xd8d0b5, secondary: 0x202322, accent: 0xb84c32 },
  { id: "drift-moss", car: "seventies" as const, name: "Paddock Green", cost: 420, color: 0x28543d, secondary: 0x15251d, accent: 0xd0b95f },
  { id: "drift-gold", car: "seventies" as const, name: "Ochre Line", cost: 780, color: 0x8e6425, secondary: 0x242016, accent: 0xe5d2a7 },
  { id: "surge-stock", car: "eighties" as const, name: "Workshop Ivory", cost: 0, color: 0xd9d7ce, secondary: 0x252827, accent: 0x245b85 },
  { id: "surge-wine", car: "eighties" as const, name: "Oxide Red", cost: 420, color: 0x8d302c, secondary: 0x241a1a, accent: 0xd9d7ce },
  { id: "surge-ivory", car: "eighties" as const, name: "Aluminum", cost: 780, color: 0xb5bdc1, secondary: 0x22282c, accent: 0x476c84 },
  { id: "apex-ion", car: "sixties" as const, name: "Blue Test", cost: 960, color: 0x365975, secondary: 0x18252d, accent: 0xd8bf8b },
  { id: "apex-sun", car: "sixties" as const, name: "Saffron", cost: 960, color: 0xc9a64a, secondary: 0x272217, accent: 0x822c2c },
  { id: "drift-ice", car: "seventies" as const, name: "Chalk", cost: 960, color: 0xe1d9c7, secondary: 0x272724, accent: 0x3b6c59 },
  { id: "surge-night", car: "eighties" as const, name: "Midnight", cost: 960, color: 0x26384a, secondary: 0x11191f, accent: 0xe5d8bd },
  { id: "volt-stock", car: "nineties" as const, name: "Workshop Ivory", cost: 0, color: 0xd1d5d4, secondary: 0x232728, accent: 0xb33332 },
  { id: "volt-amp", car: "nineties" as const, name: "Pitlane Red", cost: 420, color: 0xa72c2b, secondary: 0x261a1a, accent: 0xe4dbcc },
  { id: "volt-arc", car: "nineties" as const, name: "Silverstone", cost: 780, color: 0xc2c8c9, secondary: 0x24292b, accent: 0x526f77 },
  { id: "volt-ion", car: "nineties" as const, name: "Indigo", cost: 960, color: 0x384260, secondary: 0x171c2a, accent: 0xc9aa64 },
  { id: "volt-gate", car: "nineties" as const, name: "Deep Teal", cost: 960, color: 0x2f6560, secondary: 0x182a28, accent: 0xd8d0b5 },
  { id: "nyx-stock", car: "modern" as const, name: "Workshop Ivory", cost: 0, color: 0xdce0de, secondary: 0x1e2425, accent: 0x25624e },
  { id: "nyx-veil", car: "modern" as const, name: "Forest", cost: 420, color: 0x28533f, secondary: 0x15231d, accent: 0xc4b58d },
  { id: "nyx-bloom", car: "modern" as const, name: "Pearl", cost: 780, color: 0xdad8cd, secondary: 0x252927, accent: 0x547365 },
  { id: "nyx-void", car: "modern" as const, name: "Graphite", cost: 960, color: 0x171b1c, secondary: 0x101314, accent: 0x91bbb0 },
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
  sixties: 1,
  seventies: 11,
  eighties: 27,
  nineties: 44,
  modern: 88,
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
    livery: stock?.id ?? `${car}-stock`,
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
