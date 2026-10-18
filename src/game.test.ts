import { describe, it, expect, vi, afterEach } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock, type Game } from "@clockwyrks/simple-2d";
import { game, type WickState, type WickDebugApi } from "./game";
import * as C from "./constants";
import { stats, initial, pool } from "./model";
const engines: ReturnType<typeof createEngine<WickState, WickDebugApi>>[] = [];
afterEach(() => {
  engines.forEach((e) => e.destroy());
  engines.length = 0;
  vi.restoreAllMocks();
});
async function setup() {
  const target = new EventTarget(),
    canvas = createCanvas(C.STAGE_W, C.STAGE_H);
  const wrapper: Game<WickState, WickDebugApi> = {
    ...game,
    initialize: (api) =>
      game.initialize({
        ...api,
        assets: {
          ...api.assets,
          loadImage: async () => createCanvas(24, 32) as unknown as ImageBitmap,
        },
        audio: {
          ...api.audio,
          load: async (cue) =>
            api.audio.define(cue, { freq: 440, durationMs: 40 }),
        },
      }),
  };
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => target,
    },
    game: wrapper,
  });
  engines.push(engine);
  await engine.initialize();
  const d = engine.debug;
  const apply = (f: (s: WickState) => WickState) => engine.apply((s) => f(s));
  const key = (code: string, type = "keydown") => {
    const e = new Event(type);
    Object.assign(e, { code, repeat: false });
    target.dispatchEvent(e);
  };
  const play = () => {
    apply((s) => d.setScreen(s, "playing"));
    apply((s) => d.setSpawning(s, false));
    apply((s) => d.setEvents(s, false));
    apply((s) => d.setEnemyMotion(s, false));
  };
  return { engine, d, apply, key, play, target };
}
describe("engine-owned frames and immutable transitions", () => {
  it("initializes the full idle state and diagnoses without changing it", async () => {
    const { engine, d } = await setup();
    expect(d.snapshot(engine.state).run.weapons).toEqual([]);
    expect(engine.state).toEqual(initial());
    expect(engine.diagnostics().length).toBeGreaterThan(15);
  });
  it("consumes exact fixed ticks and carries only a sub-tick remainder", async () => {
    const { engine, play } = await setup();
    play();
    engine.setClock(new ConstantClock(500));
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(30);
    engine.setClock(new ConstantClock(1000 / 120));
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(30);
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(31);
  });
  it("starts on the input frame and normalizes diagonal motion", async () => {
    const { engine, key } = await setup();
    key("Enter");
    await engine.advance(1);
    key("KeyD");
    key("KeyW");
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.tick).toBe(2);
    expect(
      Math.hypot(engine.state.run.player.x, engine.state.run.player.y),
    ).toBeCloseTo(C.MOVE_SPEED * C.TICK_DT);
    expect(engine.state.run.weapons[0].id).toBe("taper");
  });
  it("pauses, discards partial time, and resumes through the engine input", async () => {
    const { engine, key, play } = await setup();
    play();
    await engine.advance(2);
    key("KeyP");
    await engine.advance(10);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.run.tick).toBe(2);
    expect(engine.state.accumulator).toBe(0);
    key("KeyP", "keyup");
    key("KeyP");
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(3);
  });
  it("never edits a value handed to a pose or update", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    const before = structuredClone(engine.state);
    const old = engine.state;
    apply((s) => d.spawnEnemy(s, "moth", 80, 0));
    await engine.advance(2);
    expect(old).toEqual(before);
  });
});
describe("combat and progression", () => {
  for (const id of [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS])
    it(`fires and draws ${id}`, async () => {
      const { engine, d, apply, play } = await setup();
      play();
      apply((s) => d.setEnemyContact(s, false));
      apply((s) => d.setWeapon(s, 0, id, 1));
      apply((s) => d.spawnEnemy(s, "dark", 80, 0));
      apply((s) => d.setNextPuddleOffset(s, 50, 0));
      await engine.advance(1);
      expect(
        engine.state.run.projectiles.length + engine.state.run.zones.length,
      ).toBeGreaterThan(0);
      await engine.advance(11);
      expect(engine.state.run.enemies[0].hp).toBeLessThan(
        C.ENEMIES.dark.hp + (id === "flare" ? 1 : 0),
      );
    });
  it("counts contact independently, applies armor and the exact re-hit interval", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setPassive(s, 0, "brass", 2));
    apply((s) => d.spawnEnemy(s, "moth", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(97);
    await engine.advance(29);
    expect(engine.state.run.player.hp).toBe(97);
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(94);
  });
  it("spends pierce in enemy-id order, kills once, and makes real drops", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setEnemyContact(s, false));
    apply((s) => d.setNextDrop(s, "bread"));
    for (let i = 0; i < 3; i++) apply((s) => d.spawnEnemy(s, "moth", 80, 0));
    apply((s) => d.spawnProjectile(s, "pin", 80, 0, 0, 0, 1));
    await engine.advance(1);
    expect(engine.state.run.kills).toBe(2);
    expect(engine.state.run.enemies).toHaveLength(1);
    expect(engine.state.run.gems).toHaveLength(2);
    expect(engine.state.run.pickups.some((p) => p.kind === "bread")).toBe(true);
  });
  it("collects gems, queues overflow levels, freezes and accepts forced offers", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setNextOffers(s, ["ember", "wick", "oil"]));
    for (let i = 0; i < 2; i++) apply((s) => d.spawnGem(s, "large", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("levelup");
    expect(engine.state.run.level).toBe(3);
    expect(engine.state.run.pendingLevelUps).toBe(2);
    expect(engine.state.run.offers).toEqual(["ember", "wick", "oil"]);
    const tick = engine.state.run.tick;
    await engine.advance(20);
    expect(engine.state.run.tick).toBe(tick);
    apply((s) => d.choose(s, 0));
    expect(engine.state.run.weapons[0].id).toBe("ember");
    expect(engine.state.run.pendingLevelUps).toBe(1);
  });
  for (const evo of C.EVOLUTION_IDS)
    it(`evolves ${evo} through chest collection`, async () => {
      const { engine, d, apply, play } = await setup();
      play();
      apply((s) => d.setWeapon(s, 0, C.EVOLUTIONS[evo].from, 8));
      apply((s) => d.setPassive(s, 0, C.EVOLUTIONS[evo].passive, 1));
      apply((s) => d.spawnPickup(s, "chest", 0, 0));
      await engine.advance(1);
      expect(engine.state.screen).toBe("chest");
      expect(engine.state.run.chestResult).toEqual({
        kind: "evolve",
        weapon: evo,
      });
      expect(engine.state.run.weapons[0]).toEqual({
        id: evo,
        level: 1,
        cooldown: 0,
      });
    });
  it("heals from bread and attracts distant gems with a draft", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setHp(s, 40));
    apply((s) => d.spawnGem(s, "small", 400, 0));
    apply((s) => d.spawnPickup(s, "bread", 0, 0));
    apply((s) => d.spawnPickup(s, "draft", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(70);
    expect(engine.state.run.gems[0].attracted).toBe(true);
    expect(engine.state.run.gems[0].x).toBe(390);
  });
  it("holds switches separately and keeps experience unspent while progression is off", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setProgression(s, false));
    apply((s) => d.setDrops(s, false));
    apply((s) => d.spawnGem(s, "large", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.level).toBe(1);
    expect(engine.state.run.xp).toBe(10);
    expect(engine.state.screen).toBe("playing");
  });
  it("recomputes permanent shape stats without advancing on reconcile", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setWeapon(s, 0, "halo", 1));
    apply((s) => d.setWeaponFire(s, false));
    await engine.advance(1);
    expect(engine.state.run.zones[0].radius).toBe(80);
    apply((s) => d.setPassive(s, 0, "glass", 2));
    const before = engine.state;
    apply((s) => d.reconcile(s));
    expect(engine.state).toEqual(before);
    await engine.advance(1);
    expect(engine.state.run.zones[0].radius).toBe(96);
    expect(engine.state.run.weapons[0].cooldown).toBe(0);
  });
  it("gives dawn precedence over death and opens no overlay on that tick", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setTick(s, C.DAWN_TIME * C.TICK_HZ - 1));
    apply((s) => d.setHp(s, 0));
    apply((s) => d.setPendingLevelUps(s, 1));
    await engine.advance(1);
    expect(engine.state.screen).toBe("dawn");
    expect(engine.state.accumulator).toBe(0);
  });
  it("ends fallen on zero health and never advances further", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setHp(s, 0));
    await engine.advance(30);
    expect(engine.state.screen).toBe("fallen");
    expect(engine.state.run.tick).toBe(1);
  });
});
describe("director, menus and debug contract", () => {
  for (const event of C.EVENTS)
    it(`fires the ${event.time}s event exactly once`, async () => {
      const { engine, d, apply, play } = await setup();
      play();
      apply((s) => d.setEvents(s, true));
      apply((s) => d.setTick(s, event.time * C.TICK_HZ - 1));
      await engine.advance(2);
      expect(engine.state.run.firedEvents).toEqual([event.time]);
      expect(
        engine.state.run.enemies.filter((e) => e.type === event.type),
      ).toHaveLength(event.kind === "swarm" ? C.SWARM_SIZE : 1);
    });
  it("obeys a forced ring spawn and health scaling", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setSpawning(s, true));
    apply((s) => d.setTick(s, 120 * C.TICK_HZ));
    apply((s) => d.setNextSpawnAngle(s, 90));
    apply((s) => d.setNextSpawnType(s, "beetle"));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].x).toBeCloseTo(0);
    expect(engine.state.run.enemies[0].y).toBe(C.SPAWN_DISTANCE);
    expect(engine.state.run.enemies[0].maxHp).toBe(C.ENEMIES.beetle.hp * 1.3);
  });
  it("rejects invalid poses instead of normalizing them", async () => {
    const { engine, d } = await setup();
    expect(() => d.setTick(engine.state, 1.2)).toThrow();
    expect(() => d.setNextSpawnAngle(engine.state, 360)).toThrow();
    expect(() => d.setNextOffers(engine.state, ["ember", "ember"])).toThrow();
    expect(() => d.setEnemyHp(engine.state, 99, 5)).toThrow();
    expect(() => d.setWeapon(engine.state, 2, "taper", 1)).toThrow();
    expect(() => d.setNextPuddleOffset(engine.state, 401, 0)).toThrow();
  });
  it("navigates the almanac on input edges and animates without a run clock", async () => {
    const { engine, key, apply, d } = await setup();
    apply((s) => d.setScreen(s, "almanac"));
    key("ArrowRight");
    await engine.advance(1);
    expect(engine.state.almanacTab).toBe(1);
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(1);
    expect(engine.state.run.tick).toBe(0);
    expect(engine.state.simTime).toBeGreaterThan(0);
    key("Escape");
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("offers only legal candidates and derives every passive", () => {
    const s = initial();
    s.run.weapons = [{ id: "pyre", level: 1, cooldown: 0 }];
    s.run.passives = C.PASSIVE_IDS.slice(0, 6).map((id) => ({ id, level: 1 }));
    expect(pool(s.run)).not.toContain("taper");
    expect(pool(s.run)).not.toContain("pyre");
    expect(stats(s.run).damageMul).toBeCloseTo(1.1);
    expect(stats(s.run).areaMul).toBeCloseTo(1.1);
  });
});

describe("pointer gestures, cues, and boundary cases", () => {
  it("takes a mouse menu choice only when release returns to the pressed item", async () => {
    const { engine, target } = await setup();
    const pointer = (type: string, x: number, y: number, buttons: number) => {
      const e = new Event(type);
      Object.assign(e, {
        clientX: x,
        clientY: y,
        pointerId: 1,
        isPrimary: true,
        pointerType: "mouse",
        button: 0,
        buttons,
      });
      target.dispatchEvent(e);
    };
    pointer("pointerdown", 300, 470, 1);
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(1);
    pointer("pointerup", 600, 470, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    pointer("pointerdown", 300, 470, 1);
    pointer("pointerup", 300, 470, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("almanac");
    pointer("pointerdown", 920, 135, 1);
    pointer("pointerup", 920, 135, 0);
    await engine.advance(1);
    expect(engine.state.almanacTab).toBe(3);
  });
  it("takes touch menus and does not turn an unrelated release into a confirmation", async () => {
    const { engine, target } = await setup();
    for (const type of ["pointerdown", "pointerup"]) {
      const e = new Event(type);
      Object.assign(e, {
        clientX: 300,
        clientY: 535,
        pointerId: 2,
        isPrimary: true,
        pointerType: "touch",
        button: 0,
        buttons: type === "pointerdown" ? 1 : 0,
      });
      target.dispatchEvent(e);
    }
    await engine.advance(1);
    expect(engine.state.screen).toBe("howto");
  });
  it("reconciles looping audio and toggles the engine mute bus", async () => {
    const { engine, d, apply, play, key } = await setup();
    const loops: string[] = [],
      stops: string[] = [];
    engine.events.on("cue:looped", (e) => loops.push(e.cue));
    engine.events.on("cue:stopped", (e) => stops.push(e.cue));
    play();
    apply((s) => d.setWeapon(s, 0, "halo", 1));
    await engine.advance(1);
    expect(loops).toEqual([C.CUES.music, C.CUES.hum]);
    key("KeyM");
    await engine.advance(1);
    expect(engine.state.muted).toBe(true);
    key("KeyP");
    await engine.advance(1);
    expect(stops).toContain(C.CUES.hum);
    expect(stops).not.toContain(C.CUES.music);
    apply((s) => d.reset(s));
    await engine.advance(1);
    expect(stops).toContain(C.CUES.music);
  });
  it("heals Corona only on its own lethal hit", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setEnemyContact(s, false));
    apply((s) => d.setHp(s, 50));
    apply((s) => d.setWeapon(s, 0, "corona", 1));
    apply((s) => d.spawnEnemy(s, "moth", 50, 0));
    apply((s) => d.spawnEnemy(s, "dark", 55, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(51);
    expect(engine.state.run.kills).toBe(1);
  });
  it("holds a full-cap timer due and spawns as soon as room opens", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setSpawning(s, true));
    for (let i = 0; i < C.SPAWN_WINDOWS[0].cap; i++)
      apply((s) => d.spawnEnemy(s, "moth", 400, 0));
    await engine.advance(1);
    expect(engine.state.run.spawnTimer).toBe(0);
    apply((s) => d.removeEnemy(s, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(C.SPAWN_WINDOWS[0].cap);
    expect(engine.state.run.spawnTimer).toBe(1);
  });
  it("resets the spawn timer on a window boundary", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setSpawning(s, true));
    apply((s) => d.setTick(s, 30 * C.TICK_HZ - 1));
    apply((s) => d.setSpawnTimer(s, 4));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(1);
    expect(engine.state.run.spawnTimer).toBe(C.SPAWN_WINDOWS[1].interval);
  });
  it("reports only the declared snapshot fields", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setWeapon(s, 0, "halo", 1));
    await engine.advance(1);
    const snap = d.snapshot(engine.state);
    expect(snap).not.toHaveProperty("puffs");
    expect(snap.run.zones[0]).not.toHaveProperty("born");
    expect(snap.run.zones[0]).not.toHaveProperty("width");
  });
  it("bounces a Shard inside the current view, and reverses a Sconce", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.spawnProjectile(s, "shard", 630, 0, 500, 0, -1));
    apply((s) => d.spawnProjectile(s, "sconce", 0, 0, 600, 0, -1));
    await engine.advance(62);
    expect(engine.state.run.projectiles[0].vx).toBe(-500);
    expect(engine.state.run.projectiles[0].x).toBeLessThan(632);
    expect(engine.state.run.projectiles[1].vx).toBeLessThan(0);
  });
  it("uses chest levels and heals when no held item can grow", async () => {
    const { engine, d, apply, play } = await setup();
    play();
    apply((s) => d.setWeapon(s, 0, "taper", 1));
    apply((s) => d.setNextChestItem(s, "taper"));
    apply((s) => d.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.chestResult).toEqual({
      kind: "level",
      item: "taper",
      level: 2,
    });
    apply((s) => d.setScreen(s, "playing"));
    apply((s) => d.removeWeapon(s, 0));
    apply((s) => d.setHp(s, 25));
    apply((s) => d.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.chestResult).toEqual({ kind: "heal" });
    expect(engine.state.run.player.hp).toBe(55);
  });
  it("consumes the full ten-minute fixed clock through dawn", async () => {
    const { engine, play } = await setup();
    play();
    engine.setClock(new ConstantClock(C.DAWN_TIME * 1000));
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(C.DAWN_TIME * C.TICK_HZ);
    expect(engine.state.screen).toBe("dawn");
  });
});
