import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type {
  WickState,
  RunState,
  WeaponId,
  OfferId,
  EnemyState,
  ProjectileState,
  ZoneState,
} from "./types";
export type Draft<T> = T extends readonly (infer U)[]
  ? Draft<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Draft<T[K]> }
    : T;
export type State = Draft<WickState>;
export type Run = Draft<RunState>;
/** A transition edits its own private value; the engine's previous value stays untouched. */
export function copy(s: DeepReadonly<WickState>): State {
  return structuredClone(s) as State;
}
export function initial(): State {
  return {
    screen: "title",
    menuIndex: 0,
    almanacTab: 0,
    almanacScroll: 0,
    accumulator: 0,
    simTime: 0,
    muted: false,
    spawning: true,
    events: true,
    despawning: true,
    enemyMotion: true,
    enemyContact: true,
    weaponFire: true,
    effectMotion: true,
    drops: true,
    progression: true,
    movedTicks: 0,
    moving: false,
    pointerArm: null,
    wheelRemainder: 0,
    puffs: [],
    run: {
      tick: 0,
      level: 1,
      xp: 0,
      kills: 0,
      player: { x: 0, y: 0, facing: "right", hp: C.BASE_MAX_HP },
      hurtFlash: 0,
      weapons: [],
      passives: [],
      enemies: [],
      projectiles: [],
      zones: [],
      gems: [],
      pickups: [],
      offers: [],
      nextOffers: null,
      pendingLevelUps: 0,
      chestResult: null,
      spawnTimer: 0,
      firedEvents: [],
      nextId: 0,
      nextSpawnAngle: null,
      nextSwarmAngle: null,
      nextSpawnType: null,
      nextPuddleOffset: null,
      nextStrikeTarget: null,
      nextChestItem: null,
      nextDrop: null,
    },
  };
}
export function stats(r: DeepReadonly<RunState>) {
  const lv = (id: C.PassiveId) =>
    r.passives.find((p) => p.id === id)?.level ?? 0;
  return {
    damageMul: 1 + C.WICK_DAMAGE_PER_LEVEL * lv("wick"),
    cooldownMul: 1 - C.OIL_COOLDOWN_PER_LEVEL * lv("oil"),
    areaMul: 1 + C.GLASS_AREA_PER_LEVEL * lv("glass"),
    armor: C.BRASS_ARMOR_PER_LEVEL * lv("brass"),
    amountBonus: C.MIRROR_AMOUNT_PER_LEVEL * lv("mirror"),
    moveSpeed: C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * lv("bellows")),
    maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * lv("tallow"),
    recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * lv("tinder"),
    xpMul: 1 + C.SOOT_XP_PER_LEVEL * lv("soot"),
    pickupRadius: C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * lv("lure")),
  };
}
export const xpToNext = (level: number) => C.XP_BASE + C.XP_STEP * (level - 1);
export const windowIndex = (r: DeepReadonly<RunState>) =>
  Math.min(
    C.SPAWN_WINDOWS.length - 1,
    Math.floor(r.tick / C.TICK_HZ / C.SPAWN_WINDOW),
  );
export function countdown(t: number): number {
  const v = t - C.TICK_DT;
  return v < C.TICK_DT / 2 ? 0 : v;
}
export function unit(x: number, y: number, facing = 1) {
  const d = Math.hypot(x, y);
  return d ? { x: x / d, y: y / d } : { x: facing, y: 0 };
}
export const distance = (
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export const isBase = (id: string): id is C.BaseWeaponId =>
  (C.BASE_WEAPON_IDS as readonly string[]).includes(id);
export const isWeapon = (id: string): id is WeaponId => id in C.WEAPON_NAMES;
export const isPassive = (id: string): id is C.PassiveId => id in C.PASSIVES;
export type Row = {
  damage: number;
  cooldown?: number;
  amount?: number;
  radius?: number;
  width?: number;
  height?: number;
  speed?: number;
  duration?: number;
  pierce?: number;
  orbit?: number;
  area?: number;
};
export function row(id: WeaponId, level = 1): Row {
  if (isBase(id)) return C.WEAPON_LEVELS[id][level - 1];
  return {
    pyre: C.PYRE_STATS,
    beacon: C.BEACON_STATS,
    hail: C.HAIL_STATS,
    chandelier: C.CHANDELIER_STATS,
    corona: C.CORONA_STATS,
    blaze: C.BLAZE_STATS,
  }[id];
}
export function heldRow(r: DeepReadonly<RunState>, id: WeaponId) {
  return row(id, r.weapons.find((w) => w.id === id)?.level ?? 1);
}
export function pool(r: DeepReadonly<RunState>): OfferId[] {
  const weapons = C.BASE_WEAPON_IDS.filter((id) => {
    const held = r.weapons.find((w) => w.id === id);
    if (held) return held.level < C.MAX_WEAPON_LEVEL;
    return (
      r.weapons.length < C.WEAPON_SLOTS &&
      !C.EVOLUTION_IDS.some(
        (e) => C.EVOLUTIONS[e].from === id && r.weapons.some((w) => w.id === e),
      )
    );
  });
  const passives = C.PASSIVE_IDS.filter((id) => {
    const held = r.passives.find((p) => p.id === id);
    return held
      ? held.level < C.PASSIVES[id].maxLevel
      : r.passives.length < C.PASSIVE_SLOTS;
  });
  return [...weapons, ...passives];
}
export function shuffle<T>(a: readonly T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function openLevel(s: State) {
  const r = s.run,
    p = pool(r);
  const forced = r.nextOffers;
  r.offers =
    forced && forced.every((id) => p.includes(id))
      ? forced
      : p.length
        ? shuffle(p).slice(0, C.OFFER_COUNT)
        : [C.LAMP_OIL_ID];
  if (!p.length && forced?.length === 1 && forced[0] === C.LAMP_OIL_ID)
    r.offers = forced;
  r.nextOffers = null;
  s.screen = "levelup";
  s.menuIndex = 0;
  s.accumulator = 0;
}
export function heal(r: Run, amount: number) {
  r.player.hp = Math.min(stats(r).maxHp, r.player.hp + amount);
}
export function gainItem(r: Run, id: OfferId) {
  if (id === C.LAMP_OIL_ID) {
    heal(r, C.LAMP_OIL_HEAL);
    return;
  }
  if (isWeapon(id)) {
    const slot = r.weapons.find((w) => w.id === id);
    if (slot) slot.level++;
    else r.weapons.push({ id, level: 1, cooldown: 0 });
  } else {
    const slot = r.passives.find((p) => p.id === id);
    if (slot) slot.level++;
    else r.passives.push({ id, level: 1 });
    if (id === "tallow") heal(r, C.TALLOW_HP_PER_LEVEL);
  }
}
export function choose(s: State, index: number) {
  const id = s.run.offers[index];
  if (!id || !Number.isInteger(index)) throw new Error("Invalid offer index");
  gainItem(s.run, id);
  s.run.pendingLevelUps = Math.max(0, s.run.pendingLevelUps - 1);
  s.run.offers = [];
  s.menuIndex = 0;
  if (s.run.pendingLevelUps) openLevel(s);
  else s.screen = "playing";
  return s;
}
export function chest(r: Run) {
  for (const slot of r.weapons) {
    const evo = C.EVOLUTION_IDS.find(
      (e) =>
        C.EVOLUTIONS[e].from === slot.id &&
        slot.level === C.MAX_WEAPON_LEVEL &&
        r.passives.some((p) => p.id === C.EVOLUTIONS[e].passive),
    );
    if (evo) {
      slot.id = evo;
      slot.level = 1;
      slot.cooldown = 0;
      r.chestResult = { kind: "evolve", weapon: evo };
      r.nextChestItem = null;
      return;
    }
  }
  const candidates = [
    ...r.weapons.filter((w) => isBase(w.id) && w.level < C.MAX_WEAPON_LEVEL),
    ...r.passives.filter((p) => p.level < C.PASSIVES[p.id].maxLevel),
  ];
  const item =
    candidates.find((p) => p.id === r.nextChestItem) ??
    candidates[Math.floor(Math.random() * candidates.length)];
  r.nextChestItem = null;
  if (item) {
    gainItem(r, item.id);
    r.chestResult = { kind: "level", item: item.id, level: item.level };
  } else {
    heal(r, C.CHEST_HEAL);
    r.chestResult = { kind: "heal" };
  }
}
export function spawnEnemy(
  r: Run,
  type: C.EnemyId,
  x: number,
  y: number,
): Draft<EnemyState> {
  const data = C.ENEMIES[type],
    hp =
      data.hp *
      (data.rank === "common"
        ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
        : 1);
  const e = {
    id: r.nextId++,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    heading: unit(
      r.player.x - x,
      r.player.y - y,
      r.player.facing === "right" ? 1 : -1,
    ),
    age: 0,
    contactCooldown: 0,
  };
  r.enemies.push(e);
  return e;
}
export function projectile(
  r: Run,
  weapon: WeaponId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce: number,
): Draft<ProjectileState> {
  const a = heldRow(r, weapon),
    st = stats(r),
    u = unit(vx, vy);
  const p = {
    id: r.nextId++,
    weapon,
    x,
    y,
    vx,
    vy,
    ax: weapon === "sconce" ? -C.SCONCE_DECEL * u.x : 0,
    ay: weapon === "sconce" ? -C.SCONCE_DECEL * u.y : 0,
    radius: (a.radius ?? 0) * st.areaMul,
    damage: a.damage * st.damageMul,
    ttl: a.duration ?? 0,
    pierce,
    hits: [],
    born: r.tick,
  };
  r.projectiles.push(p);
  return p;
}
export function zone(
  r: Run,
  weapon: WeaponId,
  kind: ZoneState["kind"],
  x: number,
  y: number,
  ttl: number | null,
): Draft<ZoneState> {
  const a = heldRow(r, weapon),
    st = stats(r);
  const z = {
    id: r.nextId++,
    weapon,
    kind,
    x,
    y,
    radius: (a.radius ?? a.area ?? 0) * st.areaMul,
    ...(kind === "slash"
      ? {
          width: (a.width ?? 0) * st.areaMul,
          height: (a.height ?? 0) * st.areaMul,
        }
      : {}),
    damage: a.damage * st.damageMul,
    ttl,
    hits: [],
    born: r.tick,
    pulseTick: r.tick,
  };
  r.zones.push(z);
  return z;
}
export function rollDrop() {
  return Math.random() < C.BREAD_CHANCE
    ? "bread"
    : Math.random() < C.DRAFT_CHANCE
      ? "draft"
      : "none";
}
