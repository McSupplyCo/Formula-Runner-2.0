export const BRAND = {
  midnight: 0x0a1628,
  navy: 0x0e1b30,
  cyan: 0x00e5ff,
  magenta: 0xff006e,
  green: 0x39ff14,
  gold: 0xffd600,
  asphalt: 0x121820,
  barrier: 0x1a2330,
} as const;

export const ROAD = {
  laneCount: 4,
  laneWidth: 3.6,
  shoulder: 1.1,
  get width() {
    return this.laneCount * this.laneWidth;
  },
  get halfWidth() {
    return this.width / 2;
  },
  get driveLimit() {
    return this.halfWidth - 0.95;
  },
  segmentLength: 48,
  segmentCount: 18,
} as const;

export const CARS = [
  {
    id: "apex",
    name: "Apex",
    blurb: "Balanced race trim. Learn the night here.",
    unlockBest: 0,
    topSpeed: 248,
    accel: 42,
    brake: 78,
    steer: 22,
    grip: 14,
    color: 0x00e5ff,
    accent: 0xff006e,
  },
  {
    id: "drift",
    name: "Drift",
    blurb: "Snappier steering. Slightly lower top end.",
    unlockBest: 900,
    topSpeed: 228,
    accel: 48,
    brake: 86,
    steer: 30,
    grip: 18,
    color: 0x39ff14,
    accent: 0xffd600,
  },
  {
    id: "surge",
    name: "Surge",
    blurb: "Highest speed. Demands earlier decisions.",
    unlockBest: 2200,
    topSpeed: 286,
    accel: 36,
    brake: 70,
    steer: 17,
    grip: 11,
    color: 0xff006e,
    accent: 0x00e5ff,
  },
] as const;

export type CarId = (typeof CARS)[number]["id"];

export const DRIVE = {
  startSpeed: 72,
  coastDecel: 8,
  highSpeedSteerLoss: 0.22,
  visualYaw: 10,
  hitchMaxDt: 1 / 20,
  boostMultiplier: 1.26,
  boostDrain: 0.42,
  boostMinCharge: 0.18,
  boostNearMissCharge: 0.16,
  playerLength: 4.05,
  playerWidth: 1.72,
  trafficLength: 4.3,
  trafficWidth: 1.85,
  hitboxScale: 0.86,
} as const;

export const SPAWN = {
  minLookahead: 150,
  lookaheadSeconds: 1.9,
  despawnBehind: 28,
  introSafeDistance: 70,
  minGapLanes: 1,
} as const;

export const SCORE = {
  distanceWeight: 1,
  maxSpeedBonus: 1.65,
  nearMissBase: 120,
  overtakeBase: 60,
  comboWindow: 2.6,
  maxCombo: 8,
  closeNearMiss: 2.35,
} as const;

export const CAMERA = {
  height: 2.45,
  back: 8.2,
  lookAhead: 14,
  follow: 9,
  fovIdle: 58,
  fovFast: 72,
  fovBoostExtra: 6,
  shakeMax: 0.045,
} as const;

export const SAVE_VERSION = 2;
export const SAVE_KEY = "formula-runner-2";
