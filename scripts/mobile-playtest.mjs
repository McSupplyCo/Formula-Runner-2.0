import puppeteer from "puppeteer-core";

const gameUrl = process.env.FORMULA_RUNNER_URL ?? "http://127.0.0.1:5174";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${gameUrl}/?debug=1`, { waitUntil: "networkidle0", timeout: 20000 });
await page.waitForSelector("#play");
await page.waitForFunction(() => Boolean(window.game), { timeout: 8000 });
await page.screenshot({ path: "docs/screenshots/mobile-title.png" });

const title = await page.evaluate(() => ({
  coarsePointer: matchMedia("(pointer: coarse)").matches,
  touchHelp: getComputedStyle(document.querySelector(".controls"), "::after").content,
  worldCards: document.querySelectorAll("#worlds .world").length,
  worldPane: (() => {
    const pane = document.querySelector("#gridPaneCircuit");
    return {
      clientHeight: pane.clientHeight,
      scrollHeight: pane.scrollHeight,
      overflowY: getComputedStyle(pane).overflowY,
      canScroll: pane.scrollHeight > pane.clientHeight && getComputedStyle(pane).overflowY !== "hidden",
    };
  })(),
  viewportWidth: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  documentHeight: document.documentElement.scrollHeight,
}));

await page.click("#play");
await page.waitForFunction(() => window.game?.mode === "playing", { timeout: 8000 });
const race = await page.evaluate(() => ({
  mode: window.game?.mode,
  touchControlsVisible: getComputedStyle(document.querySelector("#touch")).display !== "none",
  touchButtons: [...document.querySelectorAll("#touch button")].map((button) => {
    const rect = button.getBoundingClientRect();
    return { label: button.textContent, x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  }),
  viewportWidth: innerWidth,
  documentWidth: document.documentElement.scrollWidth,
  pointerInput: (() => {
    const brake = document.querySelector("#brakeBtn");
    brake.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 9, pointerType: "touch" }));
    const brakeDown = window.game.input.brake;
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 10, pointerType: "touch" }));
    const brakeAfterOtherPointer = window.game.input.consume().brake;
    window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 9, pointerType: "touch" }));
    const brakeAfterCancel = window.game.input.consume().brake;
    brake.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 11, pointerType: "touch" }));
    window.dispatchEvent(new Event("blur"));
    const brakeAfterBlur = window.game.input.consume().brake;
    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "KeyD" }));
    const steerBeforeBlur = window.game.input.consume().steer;
    window.dispatchEvent(new Event("blur"));
    const steerAfterBlur = window.game.input.consume().steer;
    const canvas = document.querySelector("#view");
    canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 10, pointerType: "touch", clientX: 100 }));
    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 10, pointerType: "touch", clientX: 300 }));
    const steer = window.game.input.consume().steer;
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 10, pointerType: "touch", clientX: 300 }));
    return { brakeDown, brakeAfterOtherPointer, brakeAfterCancel, brakeAfterBlur, steerBeforeBlur, steerAfterBlur, steer };
  })(),
}));
await page.screenshot({ path: "docs/screenshots/mobile-playing.png" });

console.log(JSON.stringify({ errors, title, race }, null, 2));
await browser.close();

if (errors.length || !title.coarsePointer || !title.touchHelp.includes("Drag to steer") || title.documentWidth > title.viewportWidth || (title.worldCards > 4 && !title.worldPane.canScroll) || race.documentWidth > race.viewportWidth || !race.touchControlsVisible || race.pointerInput.brakeDown !== 1 || race.pointerInput.brakeAfterOtherPointer !== 1 || race.pointerInput.brakeAfterCancel !== 0 || race.pointerInput.brakeAfterBlur !== 0 || race.pointerInput.steerBeforeBlur !== -1 || race.pointerInput.steerAfterBlur !== 0 || race.pointerInput.steer !== -1) {
  process.exitCode = 1;
}
