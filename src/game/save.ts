import { emptyGarage, stockLiveries, creditPayout, emptyCarGarage, type CarGarage } from "./garage";
import { CARS, MAX_PART_RANK, SAVE_KEY, SAVE_VERSION, type CarId } from "./tuning";
import { clamp } from "./math";

export type SaveData = {
  version: number;
  bestScore: number;
  bestDistance: number;
  bestCombo: number;
  selectedCar: CarId;
  ownedCars: CarId[];
  credits: number;
  garage: Record<CarId, CarGarage>;
  ownedLiveries: string[];
  totalRuns: number;
  totalDistance: number;
  sfxVolume: number;
  musicVolume: number;
  reducedMotion: boolean;
  haptics: boolean;
};

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  bestScore: 0,
  bestDistance: 0,
  bestCombo: 0,
  selectedCar: "apex",
  ownedCars: ["apex"],
  credits: 0,
  garage: emptyGarage(),
  ownedLiveries: stockLiveries(),
  totalRuns: 0,
  totalDistance: 0,
  sfxVolume: 0.8,
  musicVolume: 0.45,
  reducedMotion: false,
  haptics: true,
});

export function migrateSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;

  if (typeof data.bestDistance === "number") base.bestDistance = data.bestDistance;
  if (typeof data.bestScore === "number") base.bestScore = data.bestScore;

  const version = typeof data.version === "number" ? data.version : 1;
  const next: SaveData = {
    ...base,
    version: SAVE_VERSION,
    bestScore: num(data.bestScore, base.bestScore),
    bestDistance: num(data.bestDistance, base.bestDistance),
    bestCombo: num(data.bestCombo, base.bestCombo),
    selectedCar: parseCar(data.selectedCar, base.selectedCar),
    ownedCars: version >= 3 ? parseOwned(data.ownedCars) : ["apex"],
    credits: version >= 3 ? Math.max(0, num(data.credits, 0)) : 0,
    garage: version >= 3 ? parseGarage(data.garage) : emptyGarage(),
    ownedLiveries: version >= 3 ? parseLiveries(data.ownedLiveries) : stockLiveries(),
    totalRuns: num(data.totalRuns, version < 2 ? 0 : base.totalRuns),
    totalDistance: num(data.totalDistance, base.totalDistance),
    sfxVolume: clamp(num(data.sfxVolume, base.sfxVolume), 0, 1),
    musicVolume: clamp(num(data.musicVolume, base.musicVolume), 0, 1),
    reducedMotion: bool(data.reducedMotion, base.reducedMotion),
    haptics: bool(data.haptics, base.haptics),
  };

  if (!next.ownedCars.includes("apex")) next.ownedCars.unshift("apex");
  if (!next.ownedCars.includes(next.selectedCar)) next.selectedCar = "apex";
  for (const id of stockLiveries()) {
    if (!next.ownedLiveries.includes(id)) next.ownedLiveries.push(id);
  }
  return next;
}

export function commitRun(
  save: SaveData,
  run: {
    score: number;
    distance: number;
    combo: number;
    nearMisses?: number;
    overtakes?: number;
  },
): SaveData {
  const earned = creditPayout({
    distance: run.distance,
    nearMisses: run.nearMisses ?? 0,
    overtakes: run.overtakes ?? 0,
    personalBest: run.score > save.bestScore,
  });
  return {
    ...save,
    credits: save.credits + earned,
    bestScore: Math.max(save.bestScore, run.score),
    bestDistance: Math.max(save.bestDistance, run.distance),
    bestCombo: Math.max(save.bestCombo, run.combo),
    totalRuns: save.totalRuns + 1,
    totalDistance: save.totalDistance + run.distance,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return migrateSave(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, version: SAVE_VERSION }));
  } catch {
    // Ignore quota / private mode.
  }
}

function parseGarage(value: unknown): Record<CarId, CarGarage> {
  const next = emptyGarage();
  if (!value || typeof value !== "object") return next;
  const data = value as Record<string, unknown>;
  for (const car of CARS) {
    const row = data[car.id];
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    next[car.id] = {
      power: rank(item.power),
      chassis: rank(item.chassis),
      aero: rank(item.aero),
      ers: rank(item.ers),
      livery: typeof item.livery === "string" ? item.livery : emptyCarGarage(car.id).livery,
    };
  }
  return next;
}

function rank(value: unknown): number {
  return clamp(Math.floor(num(value, 0)), 0, MAX_PART_RANK);
}

function parseOwned(value: unknown): CarId[] {
  const ids = parseCars(value, ["apex"]);
  return ids.includes("apex") ? ids : ["apex", ...ids];
}

function parseLiveries(value: unknown): string[] {
  if (!Array.isArray(value)) return stockLiveries();
  const ids = value.filter((id): id is string => typeof id === "string");
  return ids.length ? ids : stockLiveries();
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseCar(value: unknown, fallback: CarId): CarId {
  return CARS.some((car) => car.id === value) ? (value as CarId) : fallback;
}

function parseCars(value: unknown, fallback: CarId[]): CarId[] {
  if (!Array.isArray(value)) return fallback;
  const ids = value.filter((id): id is CarId => CARS.some((car) => car.id === id));
  return ids.length ? ids : fallback;
}
