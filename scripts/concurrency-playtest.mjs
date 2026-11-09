import puppeteer from "puppeteer-core";

const gameUrl = process.env.FORMULA_RUNNER_URL ?? "http://127.0.0.1:5176";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"],
});

try {
  const owner = await browser.newPage();
  const errors = [];
  owner.on("pageerror", (error) => errors.push(String(error)));
  await owner.goto(`${gameUrl}/?debug=1`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await owner.waitForFunction(() => Boolean(window.game), { timeout: 8000 });
  const firstTab = await owner.evaluate(() => ({
    hasGame: Boolean(window.game),
    appInert: document.querySelector("#app")?.inert,
    skipLinkInert: document.querySelector(".skip")?.inert,
    sessionScreenHidden: document.querySelector("#saveSession")?.classList.contains("hidden"),
    playVisible: Boolean(document.querySelector("#play")?.getClientRects().length),
  }));

  const secondary = await browser.newPage();
  secondary.on("pageerror", (error) => errors.push(String(error)));
  await secondary.goto(`${gameUrl}/?debug=1`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await secondary.waitForSelector("#saveSession:not(.hidden)", { timeout: 8000 });
  const secondTab = await secondary.evaluate(() => ({
    hasGame: Boolean(window.game),
    appInert: document.querySelector("#app")?.inert,
    skipLinkInert: document.querySelector(".skip")?.inert,
    message: document.querySelector("#saveSessionMessage")?.textContent,
  }));
  await secondary.evaluate(() => document.querySelector("#play")?.click());
  const afterBlockedClick = await secondary.evaluate(() => ({
    hasGame: Boolean(window.game),
    appInert: document.querySelector("#app")?.inert,
    skipLinkInert: document.querySelector(".skip")?.inert,
  }));

  await owner.bringToFront();
  await owner.evaluate(() => document.querySelector("#play")?.click());
  await owner.waitForFunction(() => window.game?.mode === "playing", { timeout: 8000 });
  await owner.evaluate(() => window.game?.crash());
  await owner.waitForFunction(() => window.game?.mode === "results", { timeout: 5000 });
  const committedSave = await owner.evaluate(() => ({
    credits: window.game?.save.credits,
    totalRuns: window.game?.save.totalRuns,
    stored: JSON.parse(localStorage.getItem("formula-runner-2") ?? "null"),
  }));
  await owner.close();

  await secondary.waitForFunction(() => !document.querySelector("#app")?.inert, { timeout: 8000 });
  const recoveredTab = await secondary.evaluate(() => ({
    hasGame: Boolean(window.game),
    sessionScreenHidden: document.querySelector("#saveSession")?.classList.contains("hidden"),
    credits: window.game?.save.credits,
    totalRuns: window.game?.save.totalRuns,
  }));
  await secondary.reload({ waitUntil: "domcontentloaded" });
  await secondary.waitForFunction(() => Boolean(window.game), { timeout: 8000 });
  const reloadedOwner = await secondary.evaluate(() => ({
    credits: window.game?.save.credits,
    totalRuns: window.game?.save.totalRuns,
    appInert: document.querySelector("#app")?.inert,
  }));
  const result = {
    firstTab,
    secondTab,
    afterBlockedClick,
    committedSave: { credits: committedSave.credits, totalRuns: committedSave.totalRuns },
    recoveredTab,
    reloadedOwner,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));

  if (
    errors.length ||
    !firstTab.hasGame ||
    firstTab.appInert ||
    firstTab.skipLinkInert ||
    firstTab.sessionScreenHidden !== true ||
    secondTab.hasGame ||
    secondTab.appInert !== true ||
    secondTab.skipLinkInert !== true ||
    !secondTab.message?.includes("read-only") ||
    afterBlockedClick.hasGame ||
    afterBlockedClick.appInert !== true ||
    afterBlockedClick.skipLinkInert !== true ||
    committedSave.totalRuns !== 1 ||
    !recoveredTab.hasGame ||
    recoveredTab.sessionScreenHidden !== true ||
    recoveredTab.credits !== committedSave.credits ||
    recoveredTab.totalRuns !== committedSave.totalRuns ||
    reloadedOwner.appInert ||
    reloadedOwner.credits !== committedSave.credits ||
    reloadedOwner.totalRuns !== committedSave.totalRuns
  ) {
    process.exitCode = 1;
  }
  await secondary.close();
} finally {
  await browser.close();
}
