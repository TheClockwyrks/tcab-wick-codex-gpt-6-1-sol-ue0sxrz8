import * as C from "./constants";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { WeaponId, EnemyState, ZoneState, ProjectileState } from "./types";
import {
  type State,
  type Run,
  type Draft,
  stats,
  countdown,
  distance,
  unit,
  heldRow,
  zone,
  projectile,
  spawnEnemy,
  rollDrop,
  windowIndex,
  heal,
  chest,
  openLevel,
  xpToNext,
  shuffle,
} from "./model";
const radians = (degrees: number) => (degrees * Math.PI) / 180;
function orbitSet(r: Run, id: WeaponId, angle = 0) {
  const a = heldRow(r, id),
    st = stats(r),
    n = (a.amount ?? 1) + st.amountBonus;
  for (let i = 0; i < n; i++) {
    const z = zone(
      r,
      id,
      "lantern",
      r.player.x,
      r.player.y,
      id === "chandelier" ? null : (a.duration ?? 0),
    );
    z.angle = angle + (i * 360) / n;
    z.orbit = (a.orbit ?? 0) * st.areaMul;
    z.x += Math.cos(radians(z.angle)) * z.orbit;
    z.y += Math.sin(radians(z.angle)) * z.orbit;
  }
}
function fire(r: Run, id: WeaponId) {
  const a = heldRow(r, id),
    st = stats(r),
    p = r.player,
    n = (a.amount ?? 1) + st.amountBonus,
    face = p.facing === "right" ? 1 : -1;
  const nearest = [...r.enemies].sort(
    (a, b) => distance(a, p) - distance(b, p) || a.id - b.id,
  );
  if (["taper", "pyre"].includes(id)) {
    for (let i = 0; i < Math.min(C.TAPER_MAX_AMOUNT, n); i++) {
      const width = (a.width ?? 0) * st.areaMul;
      zone(
        r,
        id,
        "slash",
        p.x + (width / 2) * face * (i ? -1 : 1),
        p.y,
        C.SLASH_FLASH,
      );
    }
    return;
  }
  if (["halo", "corona"].includes(id)) {
    for (const z of r.zones.filter((z) => z.weapon === id && z.kind === "aura"))
      z.pulseTick = r.tick;
    return;
  }
  if (id === "lantern") {
    orbitSet(r, id);
    return;
  }
  if (["oil-splash", "blaze"].includes(id)) {
    for (let i = 0; i < n; i++) {
      const forced = i === 0 ? r.nextPuddleOffset : null;
      const angle = Math.random() * Math.PI * 2,
        d = C.OIL_SCATTER * Math.sqrt(Math.random());
      zone(
        r,
        id,
        "puddle",
        p.x + (forced?.x ?? Math.cos(angle) * d),
        p.y + (forced?.y ?? Math.sin(angle) * d),
        a.duration ?? 0,
      );
    }
    r.nextPuddleOffset = null;
    return;
  }
  if (id === "spark") {
    const eligible = shuffle(
      nearest.filter((e) => distance(e, p) <= C.SPARK_RANGE),
    );
    const idx = eligible.findIndex((e) => e.id === r.nextStrikeTarget);
    if (idx >= 0) eligible.unshift(...eligible.splice(idx, 1));
    r.nextStrikeTarget = null;
    for (const e of eligible.slice(0, n))
      zone(r, id, "strike", e.x, e.y, C.SPARK_FLASH);
    return;
  }
  if (id === "flare") {
    zone(r, id, "burst", p.x, p.y, C.FLARE_FLASH);
    return;
  }
  if (id === "chandelier") return;
  const targets = ["ember", "beacon"].includes(id)
    ? nearest.slice(0, n)
    : nearest.slice(0, 1);
  if (!targets.length && ["ember", "beacon", "sconce"].includes(id)) return;
  for (
    let i = 0;
    i < (["ember", "beacon"].includes(id) ? targets.length : n);
    i++
  ) {
    const target = targets[i] ?? targets[0],
      u = target
        ? unit(target.x - p.x, target.y - p.y, face)
        : { x: face, y: 0 };
    let angle = Math.atan2(u.y, u.x);
    if (["shard", "sconce"].includes(id))
      angle += radians(
        (i - (n - 1) / 2) * (id === "shard" ? C.SHARD_SPREAD : C.SCONCE_SPREAD),
      );
    if (["pin", "hail"].includes(id)) angle = face === 1 ? 0 : Math.PI;
    projectile(
      r,
      id,
      p.x,
      p.y +
        (["pin", "hail"].includes(id) ? (i - (n - 1) / 2) * C.PIN_SPREAD : 0),
      Math.cos(angle) * (a.speed ?? 0),
      Math.sin(angle) * (a.speed ?? 0),
      a.pierce ?? C.INFINITE_PIERCE,
    );
  }
}
function placement(r: Run) {
  const st = stats(r);
  r.zones = r.zones.filter(
    (z) =>
      !(z.kind === "aura" || z.kind === "lantern") ||
      r.weapons.some((w) => w.id === z.weapon),
  );
  for (const w of r.weapons) {
    const a = heldRow(r, w.id);
    if (
      ["halo", "corona"].includes(w.id) &&
      !r.zones.some((z) => z.weapon === w.id && z.kind === "aura")
    )
      zone(r, w.id, "aura", r.player.x, r.player.y, null).pulseTick = -1;
    if (w.id === "chandelier") {
      const set = r.zones.filter((z) => z.weapon === "chandelier");
      if (set.length !== (a.amount ?? 1) + st.amountBonus) {
        const angle = set[0]?.angle ?? 0;
        r.zones = r.zones.filter(
          (z) => z.weapon !== "chandelier" && z.weapon !== "lantern",
        );
        orbitSet(r, w.id, angle);
      }
      w.cooldown = 0;
    }
  }
  for (const z of r.zones) {
    if (z.kind === "aura" || z.weapon === "chandelier") {
      const a = heldRow(r, z.weapon);
      z.radius = (a.radius ?? 0) * st.areaMul;
      z.damage = a.damage * st.damageMul;
      if (z.weapon === "chandelier") z.orbit = (a.orbit ?? 0) * st.areaMul;
    }
    if (z.kind === "aura") {
      z.x = r.player.x;
      z.y = r.player.y;
    }
    if (z.kind === "lantern") {
      z.x = r.player.x + Math.cos(radians(z.angle ?? 0)) * (z.orbit ?? 0);
      z.y = r.player.y + Math.sin(radians(z.angle ?? 0)) * (z.orbit ?? 0);
    }
  }
}
function moveEnemy(e: Draft<EnemyState>, r: Run) {
  const data = C.ENEMIES[e.type],
    oldAge = e.age - C.TICK_DT;
  let ax = e.x,
    ay = e.y;
  if (data.behavior === "weave") {
    const off =
      C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * oldAge) / C.WISP_PERIOD);
    ax += e.heading.y * off;
    ay -= e.heading.x * off;
  }
  if (data.behavior === "weave" && ax === r.player.x && ay === r.player.y)
    return;
  if (data.behavior !== "drift")
    e.heading = unit(
      r.player.x - ax,
      r.player.y - ay,
      r.player.facing === "right" ? 1 : -1,
    );
  e.x = ax + e.heading.x * data.speed * C.TICK_DT;
  e.y = ay + e.heading.y * data.speed * C.TICK_DT;
  if (data.behavior === "weave") {
    const off =
      C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD);
    e.x -= e.heading.y * off;
    e.y += e.heading.x * off;
  }
}
function overlap(
  z: Draft<ZoneState> | Draft<ProjectileState>,
  e: Draft<EnemyState>,
) {
  const er = C.ENEMIES[e.type].radius;
  if ("kind" in z && z.kind === "slash")
    return (
      Math.hypot(
        Math.max(0, Math.abs(e.x - z.x) - (z.width ?? 0) / 2),
        Math.max(0, Math.abs(e.y - z.y) - (z.height ?? 0) / 2),
      ) < er
    );
  if ("kind" in z && ["strike", "burst"].includes(z.kind))
    return distance(z, e) <= z.radius;
  return distance(z, e) < z.radius + er;
}
function onRing(r: Run, type: C.EnemyId) {
  const angle = r.nextSpawnAngle ?? Math.random() * 360;
  r.nextSpawnAngle = null;
  spawnEnemy(
    r,
    type,
    r.player.x + Math.cos(radians(angle)) * C.SPAWN_DISTANCE,
    r.player.y + Math.sin(radians(angle)) * C.SPAWN_DISTANCE,
  );
}
function director(s: State) {
  const r = s.run;
  if (s.despawning)
    r.enemies = r.enemies.filter(
      (e) =>
        C.ENEMIES[e.type].rank !== "common" ||
        distance(e, r.player) <= C.DESPAWN_DISTANCE,
    );
  if (s.events)
    for (const event of C.EVENTS)
      if (
        r.tick === Math.round(event.time * C.TICK_HZ) &&
        !r.firedEvents.includes(event.time)
      ) {
        r.firedEvents.push(event.time);
        if (event.kind === "spawn") onRing(r, event.type);
        else {
          const a = r.nextSwarmAngle ?? Math.random() * 360;
          r.nextSwarmAngle = null;
          const dx = Math.cos(radians(a)),
            dy = Math.sin(radians(a));
          for (let i = 0; i < C.SWARM_SIZE; i++) {
            const off = (i / (C.SWARM_SIZE - 1) - 0.5) * C.SWARM_LINE;
            const e = spawnEnemy(
              r,
              "gnat",
              r.player.x + dx * C.SPAWN_DISTANCE - dy * off,
              r.player.y + dy * C.SPAWN_DISTANCE + dx * off,
            );
            e.heading = { x: -dx, y: -dy };
          }
        }
      }
  if (s.spawning) {
    if (windowIndex(r) !== windowIndex({ ...r, tick: r.tick - 1 }))
      r.spawnTimer = 0;
    r.spawnTimer = countdown(r.spawnTimer);
    if (!r.spawnTimer) {
      const win = C.SPAWN_WINDOWS[windowIndex(r)];
      if (
        r.enemies.filter(
          (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
        ).length < win.cap
      ) {
        const forced = r.nextSpawnType;
        r.nextSpawnType = null;
        onRing(
          r,
          forced && win.types.includes(forced)
            ? forced
            : win.types[Math.floor(Math.random() * win.types.length)],
        );
        r.spawnTimer = win.interval;
      }
    }
  }
  const ids = new Set(r.enemies.map((e) => e.id));
  for (const z of [...r.projectiles, ...r.zones])
    z.hits = z.hits.filter((h) => ids.has(h.enemy));
}
/** The twelve ordered phases of one deterministic 60 Hz tick. */
export function tick(s: State, api: UpdateApi, dx: number, dy: number) {
  const r = s.run,
    cues = new Set<string>(),
    st = stats(r);
  r.tick++;
  s.moving = dx !== 0 || dy !== 0;
  if (s.moving) s.movedTicks++;
  r.player.x += dx * st.moveSpeed * C.TICK_DT;
  r.player.y += dy * st.moveSpeed * C.TICK_DT;
  if (dx) r.player.facing = dx < 0 ? "left" : "right";
  heal(r, st.recovery * C.TICK_DT);
  for (const e of r.enemies) {
    e.age += C.TICK_DT;
    if (s.enemyMotion) moveEnemy(e, r);
  }
  placement(r);
  if (s.weaponFire)
    for (const w of r.weapons) {
      if (w.id === "chandelier") continue;
      w.cooldown = countdown(w.cooldown);
      if (w.cooldown === 0) {
        fire(r, w.id);
        const a = heldRow(r, w.id);
        w.cooldown =
          Math.max(C.MIN_COOLDOWN, (a.cooldown ?? 0) * st.cooldownMul) +
          (w.id === "lantern" ? (a.duration ?? 0) : 0);
      }
    }
  // Placement after firing centers the newly created shapes as well.
  placement(r);
  for (const p of r.projectiles) {
    if (p.born !== r.tick) {
      p.ttl = countdown(p.ttl);
      if (s.effectMotion) {
        p.x += p.vx * C.TICK_DT;
        p.y += p.vy * C.TICK_DT;
        p.vx += p.ax * C.TICK_DT;
        p.vy += p.ay * C.TICK_DT;
        if (p.weapon === "shard") {
          for (const axis of ["x", "y"] as const) {
            const extent = axis === "x" ? C.STAGE_CX : C.STAGE_CY;
            const lo = r.player[axis] - extent + p.radius,
              hi = r.player[axis] + extent - p.radius;
            const v = axis === "x" ? "vx" : "vy";
            if (p[axis] < lo) {
              p[axis] = lo;
              p[v] = Math.abs(p[v]);
            }
            if (p[axis] > hi) {
              p[axis] = hi;
              p[v] = -Math.abs(p[v]);
            }
          }
        }
      }
    }
    p.hits = p.hits
      .map((h) => ({ ...h, cooldown: countdown(h.cooldown) }))
      .filter((h) => h.cooldown > 0);
  }
  r.projectiles = r.projectiles.filter((p) => p.ttl > 0);
  for (const z of r.zones) {
    if (z.born !== r.tick) {
      if (z.ttl !== null) z.ttl = countdown(z.ttl);
      if (s.effectMotion && z.kind === "lantern") {
        z.angle = (z.angle ?? 0) + C.LANTERN_ANGULAR_SPEED * C.TICK_DT;
        z.x = r.player.x + Math.cos(radians(z.angle)) * (z.orbit ?? 0);
        z.y = r.player.y + Math.sin(radians(z.angle)) * (z.orbit ?? 0);
      }
    }
    z.hits = z.hits
      .map((h) => ({ ...h, cooldown: countdown(h.cooldown) }))
      .filter((h) => h.cooldown > 0);
  }
  r.zones = r.zones.filter((z) => z.ttl === null || z.ttl > 0);
  const enemies = [...r.enemies].sort((a, b) => a.id - b.id);
  const spent = new Set<number>();
  for (const shape of [
    ...r.projectiles.sort((a, b) => a.id - b.id),
    ...r.zones.sort((a, b) => a.id - b.id),
  ]) {
    const z = "kind" in shape ? shape : null;
    if (z) {
      if (["slash", "strike", "burst"].includes(z.kind) && z.born !== r.tick)
        continue;
      if (z.kind === "aura" && z.pulseTick !== r.tick) continue;
      if (z.kind === "puddle") {
        const period = Math.round(
          (z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE) * C.TICK_HZ,
        );
        if ((r.tick - z.born) % period !== 0) continue;
        z.pulseTick = r.tick;
      }
    }
    for (const e of enemies) {
      if (
        shape.hits.some((h) => h.enemy === e.id) ||
        !overlap(shape, e) ||
        (z?.kind === "burst" && C.FLARE_IMMUNE.includes(e.type))
      )
        continue;
      const beforeHp = e.hp;
      e.hp -= shape.damage;
      cues.add(C.CUES.hit);
      if (shape.weapon === "pyre") heal(r, C.PYRE_HEAL);
      if (shape.weapon === "corona" && beforeHp > 0 && e.hp <= 0)
        heal(r, C.CORONA_HEAL);
      let rehit = 0;
      if (z?.kind === "lantern") rehit = C.LANTERN_REHIT;
      if (!z) {
        const p = shape as Draft<ProjectileState>;
        rehit =
          p.pierce === C.INFINITE_PIERCE
            ? p.weapon === "sconce"
              ? C.SCONCE_REHIT
              : C.SHARD_REHIT
            : p.ttl;
        if (p.pierce !== C.INFINITE_PIERCE) {
          if (p.pierce === 0) {
            spent.add(p.id);
            break;
          }
          p.pierce--;
        }
      }
      if (rehit) shape.hits.push({ enemy: e.id, cooldown: rehit });
    }
  }
  r.projectiles = r.projectiles.filter((p) => !spent.has(p.id));
  for (const e of r.enemies.filter((e) => e.hp <= 0)) {
    r.kills++;
    cues.add(C.CUES.kill);
    s.puffs.push({ x: e.x, y: e.y, born: r.tick });
    if (s.drops) {
      const drop = C.ENEMIES[e.type].drop;
      if (drop === "chest")
        r.pickups.push({ id: r.nextId++, kind: "chest", x: e.x, y: e.y });
      else if (drop) {
        r.gems.push({
          id: r.nextId++,
          tier: drop,
          x: e.x,
          y: e.y,
          attracted: false,
          born: r.tick,
        });
        const kind = r.nextDrop ?? rollDrop();
        r.nextDrop = null;
        if (kind !== "none")
          r.pickups.push({ id: r.nextId++, kind, x: e.x, y: e.y });
      }
    }
  }
  r.enemies = r.enemies.filter((e) => e.hp > 0);
  r.hurtFlash = countdown(r.hurtFlash);
  for (const e of r.enemies) {
    e.contactCooldown = countdown(e.contactCooldown);
    if (
      s.enemyContact &&
      e.contactCooldown === 0 &&
      distance(e, r.player) < C.ENEMIES[e.type].radius + C.PLAYER_RADIUS
    ) {
      r.player.hp -= Math.max(
        C.MIN_DAMAGE_TAKEN,
        C.ENEMIES[e.type].damage - st.armor,
      );
      e.contactCooldown = C.CONTACT_COOLDOWN;
      r.hurtFlash = C.HURT_FLASH;
      cues.add(C.CUES.hurt);
    }
  }
  let gotChest = false;
  const collected = new Set<number>();
  for (const p of [...r.pickups].sort((a, b) => a.id - b.id)) {
    if (distance(p, r.player) >= C.PICKUP_ITEM_RADIUS + C.PLAYER_RADIUS)
      continue;
    if (p.kind === "chest") {
      if (gotChest) continue;
      gotChest = true;
      chest(r);
      if (r.chestResult?.kind === "evolve") cues.add(C.CUES.evolve);
    } else {
      cues.add(C.CUES.pickup);
      if (p.kind === "bread") heal(r, C.BREAD_HEAL);
      else r.gems.forEach((g) => (g.attracted = true));
    }
    collected.add(p.id);
  }
  r.pickups = r.pickups.filter((p) => !collected.has(p.id));
  r.gems = r.gems.filter((g) => {
    if (distance(g, r.player) <= st.pickupRadius) g.attracted = true;
    if (g.attracted && g.born !== r.tick) {
      const d = distance(g, r.player),
        step = Math.min(d, C.GEM_SPEED * C.TICK_DT),
        u = unit(r.player.x - g.x, r.player.y - g.y);
      g.x += u.x * step;
      g.y += u.y * step;
    }
    if (distance(g, r.player) > C.COLLECT_RADIUS) return true;
    r.xp += C.GEM_VALUES[g.tier] * st.xpMul;
    cues.add(C.CUES.gem);
    if (s.progression)
      while (r.xp >= xpToNext(r.level)) {
        r.xp -= xpToNext(r.level);
        r.level++;
        r.pendingLevelUps++;
      }
    return false;
  });
  director(s);
  s.puffs = s.puffs.filter((p) => (r.tick - p.born) * C.TICK_DT < C.PUFF_TIME);
  if (r.tick >= C.DAWN_TIME * C.TICK_HZ) {
    s.screen = "dawn";
    s.menuIndex = 0;
    cues.add(C.CUES.dawn);
  } else if (r.player.hp <= 0) {
    s.screen = "fallen";
    s.menuIndex = 0;
    cues.add(C.CUES.fallen);
  } else if (gotChest) {
    s.screen = "chest";
    s.menuIndex = 0;
    cues.add(C.CUES.chest);
  } else if (r.pendingLevelUps > 0) {
    openLevel(s);
    cues.add(C.CUES.levelUp);
  }
  if (s.screen !== "playing") s.accumulator = 0;
  for (const cue of cues) api.audio.play(cue);
}
