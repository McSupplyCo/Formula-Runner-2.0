import { Game } from "./game/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#view");
if (!canvas) throw new Error("Missing canvas");

const ids = [
  "title",
  "hud",
  "pause",
  "results",
  "settings",
  "countdown",
  "touch",
  "play",
  "again",
  "menu",
  "resume",
  "quit",
  "openSettings",
  "closeSettings",
  "cars",
  "statScore",
  "statDistance",
  "statCredits",
  "speed",
  "distance",
  "score",
  "combo",
  "zone",
  "boostFill",
  "gear",
  "toast",
  "resultScore",
  "resultDistance",
  "resultNear",
  "resultPass",
  "resultCombo",
  "resultBest",
  "sfx",
  "music",
  "motion",
  "haptics",
  "brakeBtn",
  "boostBtn",
  "pauseHud",
  "shell",
  "app",
  "stage",
  "viewport",
  "stageLabel",
  "stageMode",
  "navHome",
  "openGarage",
  "openGarageResults",
  "closeGarage",
  "garage",
  "garageCredits",
  "garageCars",
  "garageParts",
  "garageLiveries",
  "garageHint",
  "garageLadder",
  "resultCredits",
] as const;

const ui = Object.fromEntries(
  ids.map((id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return [id, el];
  }),
) as Record<string, HTMLElement>;

const game = new Game(canvas, ui);
Object.assign(window, { game });
