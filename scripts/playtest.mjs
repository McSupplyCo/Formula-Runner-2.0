import puppeteer from "puppeteer-core";

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

await page.goto("http://127.0.0.1:5174/?v=3&debug=1", { waitUntil: "networkidle0", timeout: 20000 });
await page.waitForSelector("#play");
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
await new Promise((r) => setTimeout(r, 2500));
await page.keyboard.down("KeyA");
await new Promise((r) => setTimeout(r, 250));
await page.keyboard.up("KeyA");
await new Promise((r) => setTimeout(r, 4000));
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

if (playInfo.mode === "playing") {
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: "docs/screenshots/pause.png" });
}

console.log(JSON.stringify({ errors, titleInfo, playInfo }, null, 2));
await browser.close();
