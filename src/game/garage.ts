import { CARS, CREDIT, DRIVE, MAX_PART_RANK, type CarId } from "./tuning";

export type PartId = "power" | "chassis" | "aero" | "ers";

export type CarGarage = {
  power: number;
  chassis: number;
  aero: number;
  ers: number;
  livery: string;
};

export type GarageState = {
  credits: number;
  ownedCars: CarId[];
  ownedLiveries: string[];
  selectedCar: CarId;
  bestDistance: number;
  garage: Record<CarId, CarGarage>;
};

export type BuyResult<T extends GarageState = GarageState> = { save: T; ok: boolean; hint: string };

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
  color: number;
  accent: number;
};

export const PARTS: Array<{ id: PartId; name: string; blurb: string }> = [
  { id: "power", name: "Power unit", blurb: "Gets you back to traffic faster." },
  { id: "chassis", name: "Chassis", blurb: "A little more top end on the straight." },
  { id: "aero", name: "Aero", blurb: "Sharper steering and grip." },
  { id: "ers", name: "ERS", blurb: "Boost fills faster and lasts longer." },
];

export const LIVERIES = [
  { id: "apex-stock", car: "apex" as const, name: "Factory", cost: 0, color: 0x00e5ff, accent: 0xff006e },
  { id: "apex-harbor", car: "apex" as const, name: "Harbor", cost: 350, color: 0x1a6a7a, accent: 0xc4a035 },
  { id: "apex-void", car: "apex" as const, name: "Void", cost: 600, color: 0x12161c, accent: 0x00e5ff },
  { id: "drift-stock", car: "drift" as const, name: "Factory", cost: 0, color: 0x39ff14, accent: 0xffd600 },
  { id: "drift-moss", car: "drift" as const, name: "Moss", cost: 350, color: 0x1f4a28, accent: 0xd8c48a },
  { id: "drift-gold", car: "drift" as const, name: "Gold stripe", cost: 600, color: 0x2a8a48, accent: 0xffd600 },
  { id: "surge-stock", car: "surge" as const, name: "Factory", cost: 0, color: 0xff006e, accent: 0x00e5ff },
  { id: "surge-wine", car: "surge" as const, name: "Wine", cost: 350, color: 0x6a1028, accent: 0xe8dcc8 },
  { id: "surge-ivory", car: "surge" as const, name: "Ivory", cost: 600, color: 0xd8dde4, accent: 0xff006e },
] as const;

export type LiveryId = (typeof LIVERIES)[number]["id"];

const POWER_CAP = 18;
const CHASSIS_CAP = 24;
const STEER_CAP = 6.8;
const GRIP_CAP = 4.6;
const ERS_CHARGE_CAP = 0.09;
const ERS_DRAIN_CAP = 0.08;

export function emptyCarGarage(car: CarId): CarGarage {
  return { power: 0, chassis: 0, aero: 0, ers: 0, livery: `${car}-stock` };
}

export function emptyGarage(): Record<CarId, CarGarage> {
  return {
    apex: emptyCarGarage("apex"),
    drift: emptyCarGarage("drift"),
    surge: emptyCarGarage("surge"),
  };
}

export function stockLiveries(): string[] {
  return LIVERIES.filter((item) => item.cost === 0).map((item) => item.id);
}

export function creditPayout(run: {
  distance: number;
  nearMisses: number;
  overtakes: number;
  personalBest: boolean;
}): number {
  const raw =
    CREDIT.base +
    Math.max(0, run.distance) * CREDIT.perMeter +
    Math.max(0, run.nearMisses) * CREDIT.nearMiss +
    Math.max(0, run.overtakes) * CREDIT.overtake +
    (run.personalBest ? CREDIT.personalBest : 0);
  return Math.max(0, Math.round(raw));
}

export function carPartCap(): number {
  return PARTS.length * MAX_PART_RANK;
}

export function upgradePool(): number {
  return CARS.length * carPartCap();
}

export function rankCost(nextRank: number): number {
  if (nextRank < 1 || nextRank > MAX_PART_RANK) return Infinity;
  return Math.round(20 + nextRank * 6 + nextRank * nextRank * 0.5);
}

export function ownsCar(save: GarageState, id: CarId): boolean {
  return save.ownedCars.includes(id);
}

export function carAvailable(save: GarageState, id: CarId): boolean {
  const def = CARS.find((car) => car.id === id);
  return Boolean(def && save.bestDistance >= def.unlockBest);
}

export function partTotal(row: CarGarage): number {
  return row.power + row.chassis + row.aero + row.ers;
}

function scaled(cap: number, rank: number): number {
  return (cap * Math.max(0, Math.min(MAX_PART_RANK, rank))) / MAX_PART_RANK;
}

export function fittedSpec(save: GarageState, id: CarId): FittedSpec {
  const def = CARS.find((car) => car.id === id) ?? CARS[0];
  const row = save.garage[def.id] ?? emptyCarGarage(def.id);
  const livery =
    LIVERIES.find((item) => item.id === row.livery) ??
    LIVERIES.find((item) => item.car === def.id && item.cost === 0);
  return {
    id: def.id,
    topSpeed: def.topSpeed + scaled(CHASSIS_CAP, row.chassis),
    accel: def.accel + scaled(POWER_CAP, row.power),
    brake: def.brake,
    steer: def.steer + scaled(STEER_CAP, row.aero),
    grip: def.grip + scaled(GRIP_CAP, row.aero),
    boostDrain: Math.max(0.28, DRIVE.boostDrain - scaled(ERS_DRAIN_CAP, row.ers)),
    boostMinCharge: DRIVE.boostMinCharge,
    boostNearMissCharge: DRIVE.boostNearMissCharge + scaled(ERS_CHARGE_CAP, row.ers),
    color: livery?.color ?? def.color,
    accent: livery?.accent ?? def.accent,
  };
}

export function buyPart<T extends GarageState>(save: T, carId: CarId, part: PartId): BuyResult<T> {
  if (!ownsCar(save, carId)) return { save, ok: false, hint: "Buy the car first." };
  const row = { ...(save.garage[carId] ?? emptyCarGarage(carId)) };
  const next = row[part] + 1;
  if (next > MAX_PART_RANK) return { save, ok: false, hint: "That part is maxed." };
  const cost = rankCost(next);
  if (save.credits < cost) return { save, ok: false, hint: `Need ${cost} cr.` };
  row[part] = next;
  return {
    save: {
      ...save,
      credits: save.credits - cost,
      garage: { ...save.garage, [carId]: row },
    },
    ok: true,
    hint: `${PARTS.find((item) => item.id === part)?.name} · Rank ${next} / ${MAX_PART_RANK}`,
  };
}

export function buyCar<T extends GarageState>(save: T, carId: CarId): BuyResult<T> {
  const def = CARS.find((car) => car.id === carId);
  if (!def) return { save, ok: false, hint: "Unknown car." };
  if (ownsCar(save, carId)) return { save, ok: false, hint: "Already in the garage." };
  if (save.bestDistance < def.unlockBest) {
    return { save, ok: false, hint: `Unlock at ${def.unlockBest.toLocaleString("en-US")} m.` };
  }
  if (save.credits < def.unlockCost) return { save, ok: false, hint: `Need ${def.unlockCost} cr.` };
  return {
    save: {
      ...save,
      credits: save.credits - def.unlockCost,
      ownedCars: [...save.ownedCars, carId],
      selectedCar: carId,
    },
    ok: true,
    hint: `${def.name} is yours. Stock trim — upgrade it.`,
  };
}

export function buyLivery<T extends GarageState>(save: T, liveryId: string): BuyResult<T> {
  const livery = LIVERIES.find((item) => item.id === liveryId);
  if (!livery) return { save, ok: false, hint: "Unknown livery." };
  if (!ownsCar(save, livery.car)) return { save, ok: false, hint: "Buy the car first." };
  if (save.ownedLiveries.includes(livery.id)) {
    return { save: equipLivery(save, livery.id), ok: true, hint: `${livery.name} equipped.` };
  }
  if (save.credits < livery.cost) return { save, ok: false, hint: `Need ${livery.cost} cr.` };
  const garage = {
    ...save.garage,
    [livery.car]: { ...(save.garage[livery.car] ?? emptyCarGarage(livery.car)), livery: livery.id },
  };
  return {
    save: {
      ...save,
      credits: save.credits - livery.cost,
      ownedLiveries: [...save.ownedLiveries, livery.id],
      garage,
    },
    ok: true,
    hint: `${livery.name} equipped.`,
  };
}

export function equipLivery<T extends GarageState>(save: T, liveryId: string): T {
  const livery = LIVERIES.find((item) => item.id === liveryId);
  if (!livery || !save.ownedLiveries.includes(livery.id)) return save;
  return {
    ...save,
    garage: {
      ...save.garage,
      [livery.car]: { ...(save.garage[livery.car] ?? emptyCarGarage(livery.car)), livery: livery.id },
    },
  };
}

export function formatCredits(value: number): string {
  return `${Math.floor(value).toLocaleString("en-US")} cr`;
}
