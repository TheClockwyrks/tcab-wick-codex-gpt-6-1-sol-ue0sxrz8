import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { WickState } from "./types";
import type { WickDebugApi, WickSnapshot } from "./debug-types";
import {
  copy,
  initial,
  stats,
  xpToNext,
  pool,
  windowIndex,
  choose,
  spawnEnemy,
  projectile,
  zone,
  isBase,
  isWeapon,
  unit,
  rollDrop,
  type State,
} from "./model";
import { menuRects, tabRects, screen } from "./menus";
function assert(ok: unknown): asserts ok {
  if (!ok) throw new Error("Wick: invalid debug argument");
}
const finite = (...n: number[]) => n.every(Number.isFinite);
const whole = (n: number, min = 0, max = Infinity) =>
  finite(n) && Number.isInteger(n) && n >= min && n <= max;
const positive = (n: number) => finite(n) && n >= 0;
function pose(s: DeepReadonly<WickState>, f: (s: State) => void) {
  const next = copy(s);
  f(next);
  return next;
}
function clean(s: State) {
  const ids = new Set(s.run.enemies.map((e) => e.id));
  for (const shape of [...s.run.projectiles, ...s.run.zones])
    shape.hits = shape.hits.filter((h) => ids.has(h.enemy));
}
export function snapshot(s: DeepReadonly<WickState>): WickSnapshot {
  const st = stats(s.run);
  const {
    movedTicks: _m,
    moving: _moving,
    pointerArm: _arm,
    wheelRemainder: _wheel,
    puffs: _puffs,
    ...visible
  } = structuredClone(s);
  return {
    ...visible,
    version: C.WICK_DEBUG_VERSION,
    run: {
      ...structuredClone(s.run),
      projectiles: s.run.projectiles.map(
        ({
          born: _born,
          angle: _angle,
          orbit: _orbit,
          pulseTick: _pulse,
          ...p
        }) => structuredClone(p),
      ),
      zones: s.run.zones.map(
        ({
          born: _born,
          angle: _angle,
          orbit: _orbit,
          pulseTick: _pulse,
          ...z
        }) => structuredClone(z),
      ),
      gems: s.run.gems.map(({ born: _born, ...g }) => structuredClone(g)),
      time: s.run.tick / C.TICK_HZ,
      xpToNext: xpToNext(s.run.level),
      maxHp: st.maxHp,
      armor: st.armor,
      moveSpeed: st.moveSpeed,
      pickupRadius: st.pickupRadius,
      spawnWindow: windowIndex(s.run),
      aliveCommons: s.run.enemies.filter(
        (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
      ).length,
      pool: s.screen === "levelup" ? pool(s.run) : [],
    },
  };
}
export const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => ({ ...initial(), muted: s.muted }),
  snapshot,
  reconcile: (s) => copy(s),
  menuRects,
  tabRects,
  setScreen: (s, name) =>
    pose(s, (n) => {
      assert(
        [
          "title",
          "howto",
          "almanac",
          "playing",
          "levelup",
          "chest",
          "paused",
          "fallen",
          "dawn",
        ].includes(name),
      );
      screen(n, name);
    }),
  choose: (s, i) => choose(copy(s), i),
  rollDrop: () => rollDrop(),
  setPlayerPosition: (s, x, y) =>
    pose(s, (n) => {
      assert(finite(x, y));
      Object.assign(n.run.player, { x, y });
    }),
  setFacing: (s, facing) =>
    pose(s, (n) => {
      assert(facing === "left" || facing === "right");
      n.run.player.facing = facing;
    }),
  setHp: (s, hp) =>
    pose(s, (n) => {
      assert(finite(hp));
      n.run.player.hp = hp;
    }),
  setNextPuddleOffset: (s, x, y) =>
    pose(s, (n) => {
      assert(finite(x, y) && Math.hypot(x, y) <= C.OIL_SCATTER);
      n.run.nextPuddleOffset = { x, y };
    }),
  setNextOffers: (s, ids) =>
    pose(s, (n) => {
      assert(
        ids.length >= 1 &&
          ids.length <= C.OFFER_COUNT &&
          new Set(ids).size === ids.length &&
          ids.every((id) => id in C.ICON_PATHS),
      );
      n.run.nextOffers = [...ids];
    }),
  setWeapon: (s, slot, id, level) =>
    pose(s, (n) => {
      const r = n.run;
      assert(
        isWeapon(id) &&
          whole(slot, 0, Math.min(r.weapons.length, C.WEAPON_SLOTS - 1)) &&
          whole(level, 1, isBase(id) ? C.MAX_WEAPON_LEVEL : 1),
      );
      assert(
        !r.weapons.some(
          (w, i) =>
            i !== slot &&
            (w.id === id ||
              C.EVOLUTION_IDS.some(
                (e) =>
                  (e === id && C.EVOLUTIONS[e].from === w.id) ||
                  (e === w.id && C.EVOLUTIONS[e].from === id),
              )),
        ),
      );
      r.weapons[slot] = {
        id,
        level,
        cooldown: r.weapons[slot]?.id === id ? r.weapons[slot].cooldown : 0,
      };
    }),
  setWeaponCooldown: (s, slot, seconds) =>
    pose(s, (n) => {
      assert(whole(slot, 0, n.run.weapons.length - 1) && positive(seconds));
      n.run.weapons[slot].cooldown = seconds;
    }),
  removeWeapon: (s, slot) =>
    pose(s, (n) => {
      assert(whole(slot, 0, n.run.weapons.length - 1));
      n.run.weapons.splice(slot, 1);
    }),
  setPassive: (s, slot, id, level) =>
    pose(s, (n) => {
      assert(
        id in C.PASSIVES &&
          whole(
            slot,
            0,
            Math.min(n.run.passives.length, C.PASSIVE_SLOTS - 1),
          ) &&
          whole(level, 1, C.PASSIVES[id].maxLevel) &&
          !n.run.passives.some((p, i) => i !== slot && p.id === id),
      );
      n.run.passives[slot] = { id, level };
    }),
  removePassive: (s, slot) =>
    pose(s, (n) => {
      assert(whole(slot, 0, n.run.passives.length - 1));
      n.run.passives.splice(slot, 1);
    }),
  spawnEnemy: (s, type, x, y) =>
    pose(s, (n) => {
      assert(type in C.ENEMIES && finite(x, y));
      spawnEnemy(n.run, type, x, y);
    }),
  setEnemyPosition: (s, id, x, y) =>
    pose(s, (n) => {
      const e = n.run.enemies.find((e) => e.id === id);
      assert(e && finite(x, y));
      Object.assign(e, { x, y });
    }),
  setEnemyHeading: (s, id, x, y) =>
    pose(s, (n) => {
      const e = n.run.enemies.find((e) => e.id === id);
      assert(e && finite(x, y) && Math.hypot(x, y) > 0);
      e.heading = unit(x, y);
    }),
  removeEnemy: (s, id) =>
    pose(s, (n) => {
      assert(n.run.enemies.some((e) => e.id === id));
      n.run.enemies = n.run.enemies.filter((e) => e.id !== id);
      clean(n);
    }),
  clearEnemies: (s) =>
    pose(s, (n) => {
      n.run.enemies = [];
      clean(n);
    }),
  spawnProjectile: (s, id, x, y, vx, vy, pierce) =>
    pose(s, (n) => {
      assert(
        ["ember", "pin", "shard", "sconce", "beacon", "hail"].includes(id) &&
          finite(x, y, vx, vy) &&
          whole(pierce, -1) &&
          (id !== "sconce" || Math.hypot(vx, vy) > 0),
      );
      projectile(n.run, id, x, y, vx, vy, pierce);
    }),
  spawnPuddle: (s, id, x, y) =>
    pose(s, (n) => {
      assert(["oil-splash", "blaze"].includes(id) && finite(x, y));
      zone(
        n.run,
        id,
        "puddle",
        x,
        y,
        C.EFFECT_SPRITES[id]
          ? id === "blaze"
            ? C.BLAZE_STATS.duration
            : C.OIL_SPLASH_LEVELS[
                (n.run.weapons.find((w) => w.id === id)?.level ?? 1) - 1
              ].duration
          : 0,
      ).born = n.run.tick + 1;
    }),
  spawnGem: (s, tier, x, y) =>
    pose(s, (n) => {
      assert(C.GEM_TIERS.includes(tier) && finite(x, y));
      n.run.gems.push({
        id: n.run.nextId++,
        tier,
        x,
        y,
        attracted: false,
        born: n.run.tick,
      });
    }),
  setGemAttracted: (s, id, attracted) =>
    pose(s, (n) => {
      const g = n.run.gems.find((g) => g.id === id);
      assert(g && typeof attracted === "boolean");
      g.attracted = attracted;
    }),
  spawnPickup: (s, kind, x, y) =>
    pose(s, (n) => {
      assert(C.PICKUP_KINDS.includes(kind) && finite(x, y));
      n.run.pickups.push({ id: n.run.nextId++, kind, x, y });
    }),
  setSpawning: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.spawning = on;
    }),
  setEvents: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.events = on;
    }),
  setDespawning: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.despawning = on;
    }),
  setEnemyMotion: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.enemyMotion = on;
    }),
  setEnemyContact: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.enemyContact = on;
    }),
  setWeaponFire: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.weaponFire = on;
    }),
  setEffectMotion: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.effectMotion = on;
    }),
  setDrops: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.drops = on;
    }),
  setProgression: (s, on) =>
    pose(s, (n) => {
      assert(typeof on === "boolean");
      n.progression = on;
    }),
  setTick: (s, v) =>
    pose(s, (n) => {
      assert(whole(v, 0, C.DAWN_TIME * C.TICK_HZ - 1));
      n.run.tick = v;
    }),
  setSpawnTimer: (s, v) =>
    pose(s, (n) => {
      assert(positive(v));
      n.run.spawnTimer = v;
    }),
  setLevel: (s, v) =>
    pose(s, (n) => {
      assert(whole(v, 1));
      n.run.level = v;
    }),
  setXp: (s, v) =>
    pose(s, (n) => {
      assert(positive(v));
      n.run.xp = v;
    }),
  setKills: (s, v) =>
    pose(s, (n) => {
      assert(whole(v));
      n.run.kills = v;
    }),
  setPendingLevelUps: (s, v) =>
    pose(s, (n) => {
      assert(whole(v));
      n.run.pendingLevelUps = v;
    }),
  setNextSpawnAngle: (s, v) =>
    pose(s, (n) => {
      assert(finite(v) && v >= 0 && v < 360);
      n.run.nextSpawnAngle = v;
    }),
  setNextSwarmAngle: (s, v) =>
    pose(s, (n) => {
      assert(finite(v) && v >= 0 && v < 360);
      n.run.nextSwarmAngle = v;
    }),
  setNextSpawnType: (s, v) =>
    pose(s, (n) => {
      assert(v in C.ENEMIES);
      n.run.nextSpawnType = v;
    }),
  setNextStrikeTarget: (s, v) =>
    pose(s, (n) => {
      assert(n.run.enemies.some((e) => e.id === v));
      n.run.nextStrikeTarget = v;
    }),
  setNextChestItem: (s, v) =>
    pose(s, (n) => {
      assert(isBase(v) || v in C.PASSIVES);
      n.run.nextChestItem = v;
    }),
  setNextDrop: (s, v) =>
    pose(s, (n) => {
      assert(["bread", "draft", "none"].includes(v));
      n.run.nextDrop = v;
    }),
  setEnemyHp: (s, id, v) =>
    pose(s, (n) => {
      const e = n.run.enemies.find((e) => e.id === id);
      assert(e && finite(v) && v > 0);
      e.hp = v;
    }),
  setEnemyAge: (s, id, v) =>
    pose(s, (n) => {
      const e = n.run.enemies.find((e) => e.id === id);
      assert(e && finite(v) && v >= 0);
      e.age = v;
    }),
  setEnemyContactCooldown: (s, id, v) =>
    pose(s, (n) => {
      const e = n.run.enemies.find((e) => e.id === id);
      assert(e && finite(v) && v >= 0);
      e.contactCooldown = v;
    }),
  clearProjectiles: (s) =>
    pose(s, (n) => {
      n.run.projectiles = [];
    }),
  clearZones: (s) =>
    pose(s, (n) => {
      n.run.zones = [];
    }),
  clearGems: (s) =>
    pose(s, (n) => {
      n.run.gems = [];
    }),
  clearPickups: (s) =>
    pose(s, (n) => {
      n.run.pickups = [];
    }),
};
