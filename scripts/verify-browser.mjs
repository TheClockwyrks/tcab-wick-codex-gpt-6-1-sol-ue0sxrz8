/* global console */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const url of ["http://localhost:8000/", "http://localhost:8001/dist/"]) {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    }),
    errors = [],
    bad = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(r.url());
  });
  page.on("request", (r) => {
    if (!r.url().startsWith(url) && !r.url().startsWith("data:"))
      external.push(r.url());
  });
  await page.goto(url);
  await page.waitForTimeout(900);
  await page.mouse.click(300, 470);
  await page.waitForTimeout(100);
  // Browse every tab, including animated enemy pictures and pickup entries.
  for (const x of [480, 750, 1020]) {
    await page.mouse.click(x, 135);
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  await page.keyboard.press("KeyP");
  await page.waitForTimeout(100);
  await page.mouse.click(600, 470);
  await page.waitForTimeout(150);
  await page.setViewportSize({ width: 760, height: 960 });
  await page.waitForTimeout(100);
  assert.deepEqual(errors, []);
  assert.deepEqual(bad, []);
  assert.deepEqual(external, []);
  console.log(
    `Passed: ${url} — assets, menus, play, pause, resume, and portrait fit.`,
  );
  await page.close();
}
const touch = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  hasTouch: true,
});
const touchErrors = [];
touch.on("pageerror", (e) => touchErrors.push(e.message));
await touch.goto("http://localhost:8000/");
await touch.waitForTimeout(900);
await touch.touchscreen.tap(300, 535);
await touch.waitForTimeout(100);
await touch.touchscreen.tap(640, 635);
await touch.waitForTimeout(100);
await touch.touchscreen.tap(300, 405);
await touch.waitForTimeout(200);
assert.deepEqual(touchErrors, []);
console.log("Passed: touch title, guide, back, and play.");
await browser.close();
