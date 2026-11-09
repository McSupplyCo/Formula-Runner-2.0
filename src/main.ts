import { Game } from "./game/Game";
import { SaveOwnership } from "./game/saveOwnership";

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
  "rpm",
  "raceFill",
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
  "garageSpecs",
  "garagePaint",
  "paintPrimary",
  "paintSecondary",
  "paintAccent",
  "resultCredits",
  "resultDouble",
  "resultAdNote",
  "interstitial",
  "adStatus",
  "adBar",
  "hudSpeed",
  "hudSkin",
  "worlds",
  "garageWorlds",
  "garageTrails",
  "garageRims",
  "garageGlows",
  "carNumber",
  "brandCircuit",
  "adCircuit",
  "gridHint",
] as const;

const ui = Object.fromEntries(
  ids.map((id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return [id, el];
  }),
) as Record<string, HTMLElement>;

const app = document.getElementById("app");
const sessionScreen = document.getElementById("saveSession");
const sessionHeading = document.getElementById("saveSessionHeading");
const sessionMessage = document.getElementById("saveSessionMessage");
const skipLink = document.querySelector<HTMLAnchorElement>(".skip");
if (!app || !sessionScreen || !sessionHeading || !sessionMessage || !skipLink) throw new Error("Missing save session UI");
let activeGame: Game | null = null;
const saveOwnership = new SaveOwnership();

const showSessionState = (state: string) => {
  const isOwner = state === "owner";
  app.inert = !isOwner;
  skipLink.inert = !isOwner;
  app.setAttribute("aria-hidden", String(!isOwner));
  sessionScreen.classList.toggle("hidden", isOwner);
  if (state === "checking") {
    sessionHeading.textContent = "Checking save access";
    sessionMessage.textContent = "Making sure another Formula Runner tab is not using this save.";
  } else if (state === "inactive") {
    sessionHeading.textContent = "Save in use";
    sessionMessage.textContent = "Another tab is using this save. This tab is read-only and will take over automatically when that session closes.";
  } else if (state === "unsupported") {
    sessionHeading.textContent = "Safe saving is unavailable";
    sessionMessage.textContent = "This browser cannot coordinate save access between tabs. Open Formula Runner in a current browser to continue.";
  } else {
    if (!activeGame) {
      activeGame = new Game(canvas, ui);
      if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
        Object.assign(window, { game: activeGame });
      }
    }
  }
};

saveOwnership.subscribe(showSessionState);
void saveOwnership.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    saveOwnership.dispose();
    activeGame?.dispose();
    delete (window as Window & { game?: Game }).game;
  });
}
