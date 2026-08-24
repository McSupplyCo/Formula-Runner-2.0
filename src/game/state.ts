export type GameMode =
  | "title"
  | "countdown"
  | "playing"
  | "paused"
  | "crashed"
  | "results";

export type RunStats = {
  score: number;
  distance: number;
  speed: number;
  combo: number;
  comboTimer: number;
  nearMisses: number;
  overtakes: number;
  boost: number;
  boosting: boolean;
  maxCombo: number;
};

export const emptyRun = (): RunStats => ({
  score: 0,
  distance: 0,
  speed: 0,
  combo: 0,
  comboTimer: 0,
  nearMisses: 0,
  overtakes: 0,
  boost: 0,
  boosting: false,
  maxCombo: 0,
});

const PLAYING: GameMode[] = ["countdown", "playing"];

export function canSteer(mode: GameMode): boolean {
  return mode === "playing";
}

export function isSimulating(mode: GameMode): boolean {
  return mode === "playing";
}

export function canPause(mode: GameMode): boolean {
  return mode === "playing";
}

export function showHud(mode: GameMode): boolean {
  return PLAYING.includes(mode) || mode === "paused";
}
