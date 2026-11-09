import puppeteer from "puppeteer-core";

const gameUrl = process.env.FORMULA_RUNNER_URL ?? "http://127.0.0.1:5174";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1440,900"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(`${gameUrl}/?v=3&debug=1`, { waitUntil: "networkidle0", timeout: 20000 });
await page.waitForSelector("#play");
await page.waitForFunction(() => Boolean(window.game), { timeout: 8000 });
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: "docs/screenshots/title-live.png" });

const titleInfo = await page.evaluate(() => {
  const canvas = document.querySelector("#view");
  const cars = document.getElementById("cars");
  return {
    carHtml: cars?.innerHTML.length ?? 0,
    canvasW: canvas?.width ?? 0,
    hasGame: Boolean(window.game),
  };
});

await page.click("#play");
await new Promise((r) => setTimeout(r, 3400));
await page.screenshot({ path: "docs/screenshots/countdown.png" });

await page.keyboard.down("KeyD");
await new Promise((r) => setTimeout(r, 250));
await page.keyboard.up("KeyD");
await new Promise((r) => setTimeout(r, 400));
await page.keyboard.down("KeyA");
await new Promise((r) => setTimeout(r, 250));
await page.keyboard.up("KeyA");
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: "docs/screenshots/playing.png" });

const playInfo = await page.evaluate(() => {
  const g = window.game;
  if (!g) return { missing: true };
  return {
    mode: g.mode,
    speed: g.run?.speed,
    distance: g.run?.distance,
    score: g.run?.score,
    combo: g.run?.combo,
    nearMisses: g.run?.nearMisses,
    overtakes: g.run?.overtakes,
    fps: g.fps,
    traffic: g.traffic?.length,
  };
});

let lifecycle = null;
if (playInfo.mode === "playing") {
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: "docs/screenshots/pause.png" });
  const pauseMode = await page.evaluate(() => window.game?.mode);
  await page.click("#resume");
  await page.waitForFunction(() => window.game?.mode === "playing", { timeout: 5000 });

  // Keep the crash-state transition deterministic after the live driving segment above.
  await page.evaluate(() => window.game?.crash());
  await page.waitForFunction(() => window.game?.mode === "results", { timeout: 5000 });
  await page.screenshot({ path: "docs/screenshots/results.png" });
  const results = await page.evaluate(() => ({
    mode: window.game?.mode,
    totalRuns: window.game?.save.totalRuns,
    bestDistance: window.game?.save.bestDistance,
    credits: window.game?.save.credits,
  }));

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("#play");
  await page.waitForFunction(() => Boolean(window.game), { timeout: 8000 });
  const persisted = await page.evaluate(() => ({
    totalRuns: window.game?.save.totalRuns,
    bestDistance: window.game?.save.bestDistance,
    credits: window.game?.save.credits,
  }));
  await page.click("#openGarage");
  await page.click("#pitTabParts");
  const beforeUpgrade = await page.evaluate(() => ({
    credits: window.game?.save.credits,
    engine: window.game?.save.garage.apex.engine,
    enabled: !document.querySelector('button[data-part="engine"]')?.disabled,
  }));
  await page.click('button[data-part="engine"]');
  const upgraded = await page.evaluate(() => ({
    credits: window.game?.save.credits,
    engine: window.game?.save.garage.apex.engine,
  }));
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("#play");
  await page.waitForFunction(() => Boolean(window.game), { timeout: 8000 });
  const upgradePersisted = await page.evaluate(() => ({
    credits: window.game?.save.credits,
    engine: window.game?.save.garage.apex.engine,
  }));

  await page.click("#play");
  await page.waitForFunction(() => window.game?.mode === "playing", { timeout: 8000 });
  const restarted = await page.evaluate(() => ({
    mode: window.game?.mode,
    distance: window.game?.run.distance,
    score: window.game?.run.score,
    nearMisses: window.game?.run.nearMisses,
    credits: window.game?.save.credits,
  }));
  lifecycle = { pauseMode, results, persisted, beforeUpgrade, upgraded, upgradePersisted, restarted };
}

console.log(JSON.stringify({ errors, titleInfo, playInfo, lifecycle }, null, 2));
await browser.close();

if (
  errors.length ||
  !lifecycle ||
  lifecycle &&
    (lifecycle.pauseMode !== "paused" ||
      lifecycle.results.mode !== "results" ||
      lifecycle.persisted.totalRuns !== lifecycle.results.totalRuns ||
      lifecycle.persisted.credits !== lifecycle.results.credits ||
      lifecycle.beforeUpgrade.credits <= 70 ||
      !lifecycle.beforeUpgrade.enabled ||
      lifecycle.upgraded.engine !== lifecycle.beforeUpgrade.engine + 1 ||
      lifecycle.upgraded.credits !== lifecycle.beforeUpgrade.credits - 70 ||
      lifecycle.upgradePersisted.engine !== lifecycle.upgraded.engine ||
      lifecycle.upgradePersisted.credits !== lifecycle.upgraded.credits ||
      lifecycle.restarted.mode !== "playing" ||
      lifecycle.restarted.distance > 5 ||
      lifecycle.restarted.score > 5)
) {
  process.exitCode = 1;
}
