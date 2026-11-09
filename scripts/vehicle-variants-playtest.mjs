import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1280,800"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:5174/?debug=1", { waitUntil: "networkidle0", timeout: 20000 });
await page.waitForSelector("#play");

const variants = await page.evaluate(async () => {
  const ids = ["apex", "drift", "surge", "volt", "nyx"];
  const game = window.game;
  game.save.ownedCars = ids;
  const result = [];
  for (const id of ids) {
    game.save.selectedCar = id;
    game.renderTitle();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    result.push({ id, style: game.playerMesh.userData.carStyle, meshes: game.playerMesh.children.length });
  }
  return result;
});

for (const { id } of variants) {
  await page.evaluate((carId) => {
    window.game.save.selectedCar = carId;
    window.game.renderTitle();
  }, id);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await page.screenshot({ path: `docs/screenshots/car-${id}.png` });
}

console.log(JSON.stringify({ variants }, null, 2));
await browser.close();

if (new Set(variants.map((entry) => entry.meshes)).size < 4 || variants.some((entry) => entry.id !== entry.style)) {
  process.exitCode = 1;
}
