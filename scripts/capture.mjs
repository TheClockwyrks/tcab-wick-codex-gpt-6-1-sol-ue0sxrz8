/* global console, document */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => {
  throw e;
});
await page.route("**/capture.html", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html><body style="margin:0;background:#0d1922"><canvas id="stage" style="width:100vw;height:100vh;display:block"></canvas></body></html>',
  }),
);
await page.goto("http://localhost:5173/capture.html");
await page.evaluate(async () => {
  const { createEngine, ConstantClock } =
    await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
  const { game, BACKGROUND } = await import("/src/game.ts");
  const engine = createEngine({
    canvas: document.querySelector("canvas"),
    width: 1280,
    height: 720,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(1000 / 60),
  });
  await engine.initialize();
  globalThis.captureEngine = engine;
  await engine.advance(1);
});
await page.screenshot({ path: "showcase/title.png" });
await page.mouse.click(300, 470);
await page.evaluate(() => globalThis.captureEngine.advance(1));
await page.screenshot({ path: "showcase/almanac.png" });
await page.evaluate(async () => {
  const e = globalThis.captureEngine,
    d = e.debug;
  e.apply((s) => d.reset(s));
  e.apply((s) => d.setScreen(s, "playing"));
  for (const [i, id] of [
    "pyre",
    "beacon",
    "hail",
    "chandelier",
    "corona",
    "blaze",
  ].entries())
    e.apply((s) => d.setWeapon(s, i, id, 1));
  for (const [i, id] of [
    "wick",
    "oil",
    "glass",
    "brass",
    "mirror",
    "bellows",
  ].entries())
    e.apply((s) => d.setPassive(s, i, id, 2));
  e.apply((s) => d.setTick(s, 18000));
  e.apply((s) => d.setLevel(s, 28));
  e.apply((s) => d.setKills(s, 1327));
  e.apply((s) => d.setEnemyContact(s, false));
  e.apply((s) => d.setProgression(s, false));
  for (let i = 0; i < 125; i++) {
    const a = i * 2.39996,
      dist = 190 + (i % 13) * 34;
    e.apply((s) =>
      d.spawnEnemy(
        s,
        ["hound", "shade", "crow", "spider", "beetle", "wisp", "moth", "bat"][
          i % 8
        ],
        Math.cos(a) * dist,
        Math.sin(a) * dist * 0.7,
      ),
    );
  }
  e.apply((s) => d.spawnEnemy(s, "owl", 410, -130));
  for (let i = 0; i < 35; i++)
    e.apply((s) =>
      d.spawnGem(
        s,
        ["small", "medium", "large"][i % 3],
        Math.cos(i * 2.4) * (80 + i * 6),
        Math.sin(i * 2.4) * (80 + i * 6),
      ),
    );
  e.apply((s) => d.spawnPickup(s, "chest", -190, 140));
  await e.advance(1);
});
await page.screenshot({ path: "showcase/night.png" });

await page.evaluate(() => globalThis.captureEngine.startRecording());
const recording = await page.evaluate(async () => {
  const e = globalThis.captureEngine;
  await e.advance(180);
  return e.stopRecording();
});
await writeFile("showcase/night.json.gz", gzipSync(JSON.stringify(recording)));
await page.evaluate(async () => {
  const e = globalThis.captureEngine;
  e.apply((s) => e.debug.setNextOffers(s, ["spark", "flare", "tinder"]));
  e.apply((s) => e.debug.setPendingLevelUps(s, 1));
  await e.advance(1);
});
await browser.close();
console.log(
  "Captured title, almanac, live night, and three seconds of engine replay.",
);
