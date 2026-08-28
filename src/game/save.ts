import {
  creditPayout,
  emptyCarGarage,
  emptyGarage,
  stockLiveries,
  type CarGarage,
  type PartId,
} from "./garage";
import { CARS, MAX_PART_RANK, SAVE_BACKUP_KEY, SAVE_KEY, SAVE_VERSION, type CarId } from "./tuning";
import { clamp } from "./math";

export type HudSpeedSide = "left" | "right";

export type SaveData = {
  version: number;
  checksum: string;
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
  crashCount: number;
  settledRunIds: string[];
  lastRewardRunId: string;
  hudSpeedSide: HudSpeedSide;
  sfxVolume: number;
  musicVolume: number;
  reducedMotion: boolean;
  haptics: boolean;
};

const SETTLED_CAP = 24;

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  checksum: "",
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
  crashCount: 0,
  settledRunIds: [],
  lastRewardRunId: "",
  hudSpeedSide: "left",
  sfxVolume: 0.8,
  musicVolume: 0.45,
  reducedMotion: false,
  haptics: true,
});

export function fingerprint(save: Omit<SaveData, "checksum"> | SaveData): string {
  const ranks = CARS.map((car) => {
    const row = save.garage[car.id];
    return row ? `${car.id}:${row.engine}.${row.tires}.${row.turbo}.${row.aero}` : car.id;
  }).join("|");
  const paints = CARS.map((car) => {
    const row = save.garage[car.id];
    return row ? `${row.primary}.${row.secondary}.${row.accent}.${row.livery}` : car.id;
  }).join("|");
  const body = `${Math.floor(save.credits)}|${save.ownedCars.join(",")}|${ranks}|${Math.floor(save.bestDistance)}|${save.hudSpeedSide}|${save.lastRewardRunId}|${paints}`;
  let hash = 2166136261;
  for (let i = 0; i < body.length; i++) {
    hash ^= body.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function withChecksum(save: SaveData): SaveData {
  const next = { ...save, version: SAVE_VERSION };
  next.checksum = fingerprint(next);
  return next;
}

export function migrateSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== "object") return withChecksum(base);
  const data = raw as Record<string, unknown>;
  const version = typeof data.version === "number" ? data.version : 1;

  const next: SaveData = {
    ...base,
    version: SAVE_VERSION,
    bestScore: num(data.bestScore, base.bestScore),
    bestDistance: num(data.bestDistance, base.bestDistance),
    bestCombo: num(data.bestCombo, base.bestCombo),
    selectedCar: parseCar(data.selectedCar, base.selectedCar),
    ownedCars: version >= 3 ? parseOwned(data.ownedCars) : ["apex"],
    credits: version >= 3 ? Math.max(0, Math.floor(num(data.credits, 0))) : 0,
    garage: version >= 3 ? parseGarage(data.garage, version) : emptyGarage(),
    ownedLiveries: version >= 3 ? parseLiveries(data.ownedLiveries) : stockLiveries(),
    totalRuns: Math.max(0, Math.floor(num(data.totalRuns, version < 2 ? 0 : base.totalRuns))),
    totalDistance: Math.max(0, num(data.totalDistance, base.totalDistance)),
    crashCount: Math.max(0, Math.floor(num(data.crashCount, 0))),
    settledRunIds: parseIds(data.settledRunIds),
    lastRewardRunId: typeof data.lastRewardRunId === "string" ? data.lastRewardRunId : "",
    hudSpeedSide: data.hudSpeedSide === "right" ? "right" : "left",
    sfxVolume: clamp(num(data.sfxVolume, base.sfxVolume), 0, 1),
    musicVolume: clamp(num(data.musicVolume, base.musicVolume), 0, 1),
    reducedMotion: bool(data.reducedMotion, base.reducedMotion),
    haptics: bool(data.haptics, base.haptics),
    checksum: "",
  };

  if (!next.ownedCars.includes("apex")) next.ownedCars.unshift("apex");
  if (!next.ownedCars.includes(next.selectedCar)) next.selectedCar = "apex";
  for (const id of stockLiveries()) {
    if (!next.ownedLiveries.includes(id)) next.ownedLiveries.push(id);
  }
  return withChecksum(next);
}

export function commitRun(
  save: SaveData,
  run: {
    id?: string;
    score: number;
    distance: number;
    combo: number;
    nearMisses?: number;
    overtakes?: number;
  },
): { save: SaveData; earned: number; duplicate: boolean } {
  const runId = run.id || `legacy-${Math.floor(run.score)}-${Math.floor(run.distance)}`;
  if (save.settledRunIds.includes(runId)) {
    return { save, earned: 0, duplicate: true };
  }
  const earned = creditPayout({
    distance: run.distance,
    nearMisses: run.nearMisses ?? 0,
    overtakes: run.overtakes ?? 0,
    maxCombo: run.combo,
    personalBest: run.score > save.bestScore,
  });
  const settled = [...save.settledRunIds, runId].slice(-SETTLED_CAP);
  return {
    duplicate: false,
    earned,
    save: withChecksum({
      ...save,
      credits: Math.floor(save.credits) + earned,
      bestScore: Math.max(save.bestScore, run.score),
      bestDistance: Math.max(save.bestDistance, run.distance),
      bestCombo: Math.max(save.bestCombo, run.combo),
      totalRuns: save.totalRuns + 1,
      totalDistance: save.totalDistance + Math.max(0, run.distance),
      crashCount: save.crashCount + 1,
      settledRunIds: settled,
    }),
  };
}

export function checksumMatches(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const data = raw as Record<string, unknown>;
  if (typeof data.checksum !== "string" || !data.checksum) return true;
  if (data.version !== SAVE_VERSION) return true;
  return migrateSave(data).checksum === data.checksum;
}

export function loadSave(): SaveData {
  const primary = readSlot(SAVE_KEY);
  const backup = readSlot(SAVE_BACKUP_KEY);
  if (primary && checksumMatches(primary)) return migrateSave(primary);
  if (backup && checksumMatches(backup)) return migrateSave(backup);
  if (primary) return migrateSave(primary);
  if (backup) return migrateSave(backup);
  return defaultSave();
}

function readSlot(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSave(save: SaveData): boolean {
  const payload = JSON.stringify(withChecksum(save));
  try {
    const previous = localStorage.getItem(SAVE_KEY);
    if (previous) localStorage.setItem(SAVE_BACKUP_KEY, previous);
    localStorage.setItem(SAVE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

function parseGarage(value: unknown, version: number): Record<CarId, CarGarage> {
  const next = emptyGarage();
  if (!value || typeof value !== "object") return next;
  const data = value as Record<string, unknown>;
  for (const car of CARS) {
    const row = data[car.id];
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const stock = emptyCarGarage(car.id);
    const hasV4 = typeof item.engine === "number" || typeof item.tires === "number" || typeof item.turbo === "number";
    const hasV3 = typeof item.power === "number" || typeof item.ers === "number" || typeof item.chassis === "number";
    // v3 and v4 both have `aero`. Prefer new keys when present; otherwise version
    // decides whether leftover `aero` is tires (v3) or aero (v4).
    const v4 = hasV4 || (!hasV3 && version >= 4);
    next[car.id] = {
      engine: rank(v4 ? item.engine : item.power),
      tires: rank(v4 ? item.tires : item.aero),
      turbo: rank(v4 ? item.turbo : item.ers),
      aero: rank(v4 ? item.aero : item.chassis),
      livery: typeof item.livery === "string" ? item.livery : stock.livery,
      primary: color(item.primary, stock.primary),
      secondary: color(item.secondary, stock.secondary),
      accent: color(item.accent, stock.accent),
    };
  }
  return next;
}

function rank(value: unknown): number {
  return clamp(Math.floor(num(value, 0)), 0, MAX_PART_RANK);
}

function color(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value >>> 0 : fallback;
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

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string").slice(-SETTLED_CAP);
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

export type { PartId };
