import puppeteer from "puppeteer-core";

const gameUrl = process.env.FORMULA_RUNNER_URL ?? "http://127.0.0.1:5176";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"],
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${gameUrl}/?debug=1`, { waitUntil: "networkidle0", timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.game), { timeout: 8000 });
  await page.click("#play");
  await page.waitForFunction(() => window.game?.mode === "playing", { timeout: 8000 });

  await page.focus("#pauseHud");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.game?.mode === "paused", { timeout: 2000 });
  const dialog = await page.evaluate(() => ({
    role: document.querySelector("#pause")?.getAttribute("role"),
    modal: document.querySelector("#pause")?.getAttribute("aria-modal"),
    labelledBy: document.querySelector("#pause")?.getAttribute("aria-labelledby"),
    heading: document.querySelector(`#${document.querySelector("#pause")?.getAttribute("aria-labelledby")}`)?.textContent,
    focused: document.activeElement?.id,
    shellInert: document.querySelector("#shell")?.inert,
    hudInert: document.querySelector("#hud")?.inert,
  }));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.game?.mode === "playing", { timeout: 2000 });
  const resumedFocus = await page.evaluate(() => ({
    focused: document.activeElement?.id,
    shellInert: document.querySelector("#shell")?.inert,
    hudInert: document.querySelector("#hud")?.inert,
  }));

  await page.click("#pauseHud");
  await page.waitForFunction(() => window.game?.mode === "paused", { timeout: 2000 });
  await page.keyboard.press("Tab");
  const tabForward = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.press("Tab");
  const tabWrapped = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  const tabReverseWrapped = await page.evaluate(() => document.activeElement?.id);
  await page.click("#resume");
  await page.waitForFunction(() => window.game?.mode === "playing", { timeout: 2000 });
  const results = { dialog, resumedFocus, tabForward, tabWrapped, tabReverseWrapped, errors };
  console.log(JSON.stringify(results, null, 2));

  if (
    dialog.role !== "dialog" ||
    dialog.modal !== "true" ||
    dialog.heading !== "Paused" ||
    dialog.focused !== "resume" ||
    !dialog.shellInert ||
    !dialog.hudInert ||
    resumedFocus.focused !== "pauseHud" ||
    resumedFocus.shellInert ||
    resumedFocus.hudInert ||
    tabForward !== "quit" ||
    tabWrapped !== "resume" ||
    tabReverseWrapped !== "quit" ||
    errors.length
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
