import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { WickState, WeaponId, OfferId } from "./types";
import { images } from "./assets";
import { stats, row, heldRow, xpToNext, isWeapon, isPassive } from "./model";
import { entries, menuRects, tabRects } from "./menus";
const P = {
  ink: "#0d1922",
  panel: "#13232d",
  edge: "#3d4c4e",
  gold: "#d4ab6a",
  cream: "#f1e3bf",
  muted: "#8b9f9f",
  teal: "#8cd5be",
};
type Context = CanvasRenderingContext2D;
function text(
  c: Context,
  t: string,
  x: number,
  y: number,
  size = 16,
  color = P.cream,
  align: CanvasTextAlign = "left",
  serif = false,
) {
  c.fillStyle = color;
  c.font = `${serif ? "" : "500 "}${size}px ${serif ? "Georgia, serif" : "monospace"}`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillText(t, x, y);
}
function spaced(
  c: Context,
  t: string,
  x: number,
  y: number,
  size: number,
  gap: number,
  color = P.gold,
) {
  c.font = `${size}px Georgia, serif`;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillStyle = color;
  for (const letter of t) {
    c.fillText(letter, x, y);
    x += c.measureText(letter).width + gap;
  }
}
function box(
  c: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = P.panel,
  stroke = P.edge,
) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  c.strokeStyle = stroke;
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function line(c: Context, x: number, y: number, w: number, color = P.edge) {
  c.fillStyle = color;
  c.fillRect(x, y, w, 1);
}
function image(
  c: Context,
  path: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  flip = false,
) {
  const a = images.get(path);
  if (!a) return;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (flip) c.scale(-1, 1);
  c.drawImage(
    a,
    -(w ?? a.width) / 2,
    -(h ?? a.height) / 2,
    w ?? a.width,
    h ?? a.height,
  );
  c.restore();
}
export function name(id: string): string {
  if (isWeapon(id)) return C.WEAPON_NAMES[id];
  if (isPassive(id)) return C.PASSIVES[id].name;
  if (id in C.ENEMIES) return C.ENEMIES[id as C.EnemyId].name;
  if (id in C.GEM_NAMES) return C.GEM_NAMES[id as C.GemTier];
  if (id in C.PICKUP_NAMES) return C.PICKUP_NAMES[id as C.PickupKind];
  return C.LAMP_OIL_NAME;
}
function description(id: string): string {
  return (
    (C.WEAPON_DESCRIPTIONS as Readonly<Record<string, string>>)[id] ??
    (C.PASSIVE_DESCRIPTIONS as Readonly<Record<string, string>>)[id] ??
    (C.ENEMY_DESCRIPTIONS as Readonly<Record<string, string>>)[id] ??
    (C.GEM_DESCRIPTIONS as Readonly<Record<string, string>>)[id] ??
    (C.PICKUP_DESCRIPTIONS as Readonly<Record<string, string>>)[id] ??
    C.LAMP_OIL_DESCRIPTION
  );
}
const clock = (tick: number) =>
  `${Math.floor(tick / C.TICK_HZ / 60).toString()}:${Math.floor(
    (tick / C.TICK_HZ) % 60,
  )
    .toString()
    .padStart(2, "0")}`;
function effect(
  c: Context,
  id: WeaponId,
  x: number,
  y: number,
  w: number,
  h: number,
  age: number,
) {
  const a = C.EFFECT_SPRITES[id];
  let frame = 0;
  if (a.frames > 1)
    frame =
      id === "sconce"
        ? Math.floor(age / C.WALK_FRAME_TIME) % a.frames
        : Math.min(
            a.frames - 1,
            Math.floor(
              age / (id === "spark" ? C.SPARK_FLASH / 4 : C.FLARE_FLASH / 6),
            ),
          );
  image(c, a.frames === 1 ? a.path : `${a.path}/${frame}.png`, x, y, w, h);
}
function world(c: Context, s: DeepReadonly<WickState>) {
  const r = s.run,
    ox = C.STAGE_CX - r.player.x,
    oy = C.STAGE_CY - r.player.y;
  const tile = images.get(C.GROUND_TILE_PATH);
  if (tile)
    for (
      let y =
        Math.floor((r.player.y - C.STAGE_CY) / C.GROUND_TILE_SIZE) *
        C.GROUND_TILE_SIZE;
      y < r.player.y + C.STAGE_CY;
      y += C.GROUND_TILE_SIZE
    )
      for (
        let x =
          Math.floor((r.player.x - C.STAGE_CX) / C.GROUND_TILE_SIZE) *
          C.GROUND_TILE_SIZE;
        x < r.player.x + C.STAGE_CX;
        x += C.GROUND_TILE_SIZE
      )
        c.drawImage(
          tile,
          Math.round(x + ox),
          Math.round(y + oy),
          C.GROUND_TILE_SIZE,
          C.GROUND_TILE_SIZE,
        );
  const glow = c.createRadialGradient(
    C.STAGE_CX,
    C.STAGE_CY,
    20,
    C.STAGE_CX,
    C.STAGE_CY,
    380,
  );
  glow.addColorStop(0, "#dca85816");
  glow.addColorStop(0.45, "#dca85808");
  glow.addColorStop(1, "#00000000");
  c.fillStyle = glow;
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  for (const g of r.gems) image(c, C.GEM_PATHS[g.tier], g.x + ox, g.y + oy);
  for (const p of r.pickups)
    image(c, C.PICKUP_PATHS[p.kind], p.x + ox, p.y + oy);
  for (const z of r.zones) {
    const age = (r.tick - z.born) * C.TICK_DT;
    if (z.kind === "aura" || z.kind === "puddle") {
      c.globalAlpha = z.pulseTick === r.tick ? 1 : 0.55;
    }
    effect(
      c,
      z.weapon,
      z.x + ox,
      z.y + oy,
      z.kind === "slash" ? (z.width ?? 0) : z.radius * 2,
      z.kind === "slash" ? (z.height ?? 0) : z.radius * 2,
      age,
    );
    c.globalAlpha = 1;
  }
  for (const e of [...r.enemies].sort((a, b) => a.y - b.y)) {
    const n = C.ENEMIES[e.type].radius * 2;
    image(
      c,
      `${C.ENEMY_SHEET_DIR}/${e.type}/${Math.floor(e.age / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
      e.x + ox,
      e.y + oy,
      n,
      n,
      e.heading.x < 0,
    );
    if (C.ENEMIES[e.type].rank !== "common") {
      box(c, e.x + ox - n / 2, e.y + oy - n / 2 - 8, n, 4, "#101a24", P.edge);
      c.fillStyle = P.gold;
      c.fillRect(
        e.x + ox - n / 2,
        e.y + oy - n / 2 - 8,
        n * Math.max(0, e.hp / e.maxHp),
        3,
      );
    }
  }
  for (const p of r.projectiles)
    effect(
      c,
      p.weapon,
      p.x + ox,
      p.y + oy,
      p.radius * 2,
      p.radius * 2,
      (r.tick - p.born) * C.TICK_DT,
    );
  for (const p of s.puffs)
    image(
      c,
      `${C.PUFF_SHEET.dir}/${Math.min(3, Math.floor(((r.tick - p.born) * C.TICK_DT) / (C.PUFF_TIME / 4)))}.png`,
      p.x + ox,
      p.y + oy,
    );
  if (r.hurtFlash > 0) {
    c.fillStyle = `rgba(160,45,36,${(0.13 * r.hurtFlash) / C.HURT_FLASH})`;
    c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  }
  if (r.hurtFlash > 0) c.globalAlpha = Math.floor(r.tick / 3) % 2 ? 0.35 : 1;
  image(
    c,
    s.moving
      ? `${C.LAMPLIGHTER_WALK_SHEET.dir}/${Math.floor((s.movedTicks * C.TICK_DT) / C.WALK_FRAME_TIME) % C.LAMPLIGHTER_WALK_SHEET.frames}.png`
      : C.LAMPLIGHTER_IDLE_PATH,
    C.STAGE_CX,
    C.STAGE_CY,
    24,
    32,
    r.player.facing === "left",
  );
  c.globalAlpha = 1;
  const vignette = c.createRadialGradient(
    C.STAGE_CX,
    C.STAGE_CY,
    130,
    C.STAGE_CX,
    C.STAGE_CY,
    760,
  );
  vignette.addColorStop(0, "#08131b00");
  vignette.addColorStop(1, "#08131baa");
  c.fillStyle = vignette;
  c.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
}
function hud(c: Context, s: DeepReadonly<WickState>) {
  const r = s.run,
    st = stats(r);
  box(c, 24, 22, 300, 70, "#0e1b25ed");
  text(c, "THE LAMPLIGHTER", 40, 40, 11, P.muted);
  text(
    c,
    `${Math.max(0, Math.ceil(r.player.hp))} / ${st.maxHp}`,
    305,
    40,
    12,
    P.cream,
    "right",
  );
  box(c, 40, 58, 268, 15, P.ink, P.edge);
  c.fillStyle = "#bb775d";
  c.fillRect(
    42,
    60,
    264 * Math.max(0, Math.min(1, r.player.hp / st.maxHp)),
    11,
  );
  box(c, 552, 20, 176, 68, "#0e1b25ed");
  text(c, clock(r.tick), 640, 47, 30, P.cream, "center");
  text(c, "UNTIL DAWN  10:00", 640, 74, 10, P.muted, "center");
  text(
    c,
    `${r.kills.toString().padStart(4, "0")}  SLAIN`,
    1238,
    43,
    15,
    P.gold,
    "right",
  );
  text(c, "P  PAUSE   ·   M  SOUND", 1238, 68, 10, P.muted, "right");
  box(c, 24, 105, 300, 19, P.ink, P.edge);
  c.fillStyle = "#68aa9c";
  c.fillRect(26, 107, 296 * Math.min(1, r.xp / xpToNext(r.level)), 15);
  text(
    c,
    `${C.LEVEL_LABEL} ${r.level}   ·   ${Math.floor(r.xp)} / ${xpToNext(r.level)} XP`,
    174,
    114,
    10,
    P.cream,
    "center",
  );
  for (let rowIndex = 0; rowIndex < 2; rowIndex++) {
    const slots = rowIndex ? r.passives : r.weapons;
    const x0 = rowIndex ? 922 : 24;
    const y = 644;
    text(c, rowIndex ? "TRINKETS" : "TOOLS", x0, 630, 10, P.muted);
    for (let i = 0; i < 6; i++) {
      const x = x0 + i * 54;
      box(c, x, y, 46, 48, "#0c1923e8");
      const item = slots[i];
      if (!item) {
        continue;
      }
      image(c, C.ICON_PATHS[item.id], x + 23, y + 20);
      if ("cooldown" in item) {
        const total =
          Math.max(
            C.MIN_COOLDOWN,
            (heldRow(r, item.id).cooldown ?? 1) * st.cooldownMul,
          ) + (item.id === "lantern" ? (heldRow(r, item.id).duration ?? 0) : 0);
        c.fillStyle = "#d4ab6a";
        c.fillRect(
          x + 3,
          y + 33,
          40 * (1 - Math.min(1, (item.cooldown as number) / total)),
          2,
        );
      }
      for (let k = 0; k < item.level; k++) {
        c.fillStyle = P.gold;
        c.fillRect(x + 4 + k * 5, y + 40, 3, 3);
      }
    }
  }
  text(c, "W I C K", 640, 676, 16, P.gold, "center");
}
function header(c: Context, kicker: string, title: string) {
  spaced(c, kicker, 100, 52, 12, 3, P.muted);
  text(c, title, 100, 87, 32, P.cream, "left", true);
  line(c, 100, 105, 1080);
}
function button(
  c: Context,
  r: { x: number; y: number; width: number; height: number },
  label: string,
  selected: boolean,
  index?: number,
) {
  box(
    c,
    r.x,
    r.y,
    r.width,
    r.height,
    selected ? "#283935" : "#101f29",
    selected ? P.gold : P.edge,
  );
  if (selected) {
    c.fillStyle = P.gold;
    c.fillRect(r.x, r.y, 3, r.height);
  }
  text(
    c,
    label,
    r.x + 25,
    r.y + r.height / 2,
    15,
    selected ? P.cream : P.muted,
  );
  if (index !== undefined)
    text(
      c,
      `${index + 1}`,
      r.x + r.width - 22,
      r.y + r.height / 2,
      11,
      selected ? P.gold : P.edge,
      "right",
    );
}
function title(c: Context, s: DeepReadonly<WickState>) {
  c.fillStyle = P.ink;
  c.fillRect(0, 0, 1280, 720);
  image(c, "sprites/cover.png", 920, 360, 600, 650);
  line(c, 100, 87, 440);
  text(c, "A SURVIVAL TALE IN TEN MINUTES", 144, 116, 11, P.muted);
  spaced(c, C.TITLE_TEXT, 135, 239, 118, 12, P.cream);
  spaced(c, C.TAGLINE_TEXT, 147, 321, 16, 5);
  const rects = menuRects(s);
  C.TITLE_ITEMS.forEach((t, i) => button(c, rects[i], t, s.menuIndex === i, i));
  line(c, 144, 604, 340);
  text(
    c,
    "Walk softly. Let the lamp do the rest.",
    144,
    634,
    15,
    P.muted,
    "left",
    true,
  );
  text(c, "WASD / ARROWS  ·  ENTER TO CHOOSE", 144, 677, 10, P.muted);
  text(c, "01  /  THE MOTH-CHOKED CITY", 1200, 677, 10, P.muted, "right");
}
function almanac(c: Context, s: DeepReadonly<WickState>) {
  header(c, "FIELD NOTES / THE NIGHT", C.ALMANAC_TEXT);
  tabRects(s).forEach((r, i) =>
    button(c, r, C.ALMANAC_TABS[i], s.almanacTab === i),
  );
  const all = entries(s.almanacTab),
    id = all[s.menuIndex] ?? all[0];
  menuRects(s).forEach((r, i) =>
    button(
      c,
      r,
      name(all[s.almanacScroll + i]),
      s.menuIndex === s.almanacScroll + i,
    ),
  );
  box(c, 480, 190, 700, 410, "#142630");
  text(
    c,
    `${String(s.menuIndex + 1).padStart(2, "0")} / ${String(all.length).padStart(2, "0")}`,
    1145,
    220,
    12,
    P.muted,
    "right",
  );
  text(c, name(id), 520, 246, 36, P.cream, "left", true);
  const lines: string[] = [];
  if (s.almanacTab === 0) {
    const wid = id as WeaponId,
      a = row(wid);
    image(c, C.ICON_PATHS[wid], 556, 343, 72, 72);
    const ef = C.EFFECT_SPRITES[wid];
    effect(
      c,
      wid,
      840,
      367,
      Math.min(ef.width * 1.5, 230),
      Math.min(ef.height * 1.5, 180),
      s.simTime %
        (wid === "spark"
          ? C.SPARK_FLASH
          : wid === "flare"
            ? C.FLARE_FLASH
            : 10),
    );
    lines.push(`DAMAGE  ${a.damage}`);
    if (a.cooldown) lines.push(`COOLDOWN  ${a.cooldown}s`);
    const evo = C.EVOLUTION_IDS.find(
      (e) => e === wid || C.EVOLUTIONS[e].from === wid,
    );
    if (evo)
      lines.push(
        `${name(C.EVOLUTIONS[evo].from)} VIII + ${name(C.EVOLUTIONS[evo].passive)} → ${name(evo)}`,
      );
  } else if (s.almanacTab === 1) {
    const pid = id as C.PassiveId;
    image(c, C.ICON_PATHS[pid], 832, 363, 120, 120);
    lines.push(`MAX LEVEL  ${C.PASSIVES[pid].maxLevel}`);
  } else if (s.almanacTab === 2) {
    const eid = id as C.EnemyId,
      a = C.ENEMIES[eid];
    image(
      c,
      `${C.ENEMY_SHEET_DIR}/${eid}/${Math.floor(s.simTime / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
      832,
      365,
      a.radius * 5,
      a.radius * 5,
    );
    lines.push(`HEALTH  ${a.hp}    SPEED  ${a.speed}    DAMAGE  ${a.damage}`);
  } else if (id in C.GEM_PATHS) {
    const tier = id as C.GemTier;
    image(c, C.GEM_PATHS[tier], 832, 360, 64, 64);
    lines.push(`EXPERIENCE  ${C.GEM_VALUES[tier]}`);
  } else {
    image(c, C.PICKUP_PATHS[id as C.PickupKind], 832, 360, 96, 96);
    if (id === "bread") lines.push(`HEALS  ${C.BREAD_HEAL}`);
  }
  lines.forEach((t, i) =>
    text(c, t, 520, 480 + i * 28, 13, i === 2 ? P.gold : P.teal),
  );
  line(c, 100, 630, 1080);
  text(c, description(id), 100, 659, 13, P.cream);
  text(
    c,
    "↑ ↓ BROWSE   ← → TABS   SCROLL TO EXPLORE    ESC BACK",
    100,
    697,
    11,
    P.muted,
  );
  text(c, "‹ BACK", 1140, 697, 13, P.gold, "right");
}
function howto(c: Context, s: DeepReadonly<WickState>) {
  header(c, "A GUIDE FOR THE LAST LAMPLIGHTER", "KEEP THE LIGHT");
  const rows = [
    [
      "01",
      "ONLY WALK",
      "Your tools fire themselves, each on its own rhythm. Keep moving.",
    ],
    [
      "02",
      "MIND THE DARK",
      "Everything is drawn to your light. Anything that touches you hurts.",
    ],
    [
      "03",
      "GATHER WHAT FALLS",
      "Collect gems to grow. Each level offers a choice of one from three.",
    ],
    [
      "04",
      "BUILD YOUR LAMP",
      "Carry six tools and six trinkets. Choose what works together.",
    ],
    [
      "05",
      "OPEN THE CHESTS",
      "The big ones leave chests. A top-level tool and its trinket transform.",
    ],
    [
      "06",
      "REACH THE DAWN",
      "Survive to 10:00. Browse the almanac to learn everything in the night.",
    ],
  ];
  rows.forEach(([num, title, body], i) => {
    const y = 157 + i * 65;
    text(c, num, 110, y, 14, P.gold);
    text(c, title, 162, y, 14, P.cream);
    text(c, body, 162, y + 24, 14, P.muted);
  });
  text(
    c,
    "WASD / ARROWS  Move     ENTER / SPACE  Choose     ESC / P  Pause     M  Mute",
    640,
    563,
    13,
    P.teal,
    "center",
  );
  text(
    c,
    "Every menu answers mouse and touch. Escape takes you back.",
    640,
    589,
    12,
    P.muted,
    "center",
  );
  button(c, menuRects(s)[0], "BACK TO THE CITY", true);
}
function overlay(c: Context, s: DeepReadonly<WickState>) {
  c.fillStyle = "#07111bdc";
  c.fillRect(0, 0, 1280, 720);
  const r = s.run;
  if (s.screen === "levelup") {
    box(c, 320, 139, 640, 455, "#10212b", P.gold);
    text(
      c,
      `LEVEL ${r.level}  /  CHOOSE YOUR KINDLING`,
      640,
      180,
      11,
      P.gold,
      "center",
    );
    text(c, C.LEVEL_UP_TEXT, 640, 218, 27, P.cream, "center", true);
    menuRects(s).forEach((rect, i) => {
      const id = r.offers[i];
      button(c, rect, "", i === s.menuIndex);
      image(c, C.ICON_PATHS[id], rect.x + 36, rect.y + 35, 36, 36);
      text(c, name(id), rect.x + 70, rect.y + 26, 20);
      const held = [...r.weapons, ...r.passives].find((p) => p.id === id);
      text(
        c,
        held ? `${C.LEVEL_LABEL} ${held.level + 1}` : C.OFFER_NEW_TEXT,
        rect.x + 70,
        rect.y + 50,
        11,
        P.gold,
      );
    });
    text(
      c,
      description(r.offers[s.menuIndex] ?? C.LAMP_OIL_ID),
      640,
      556,
      12,
      P.muted,
      "center",
    );
    return;
  }
  if (s.screen === "chest") {
    text(c, C.CHEST_TEXT, 640, 200, 42, P.cream, "center", true);
    const result = r.chestResult;
    const id =
      result?.kind === "evolve"
        ? result.weapon
        : result?.kind === "level"
          ? result.item
          : null;
    if (id) image(c, C.ICON_PATHS[id as OfferId], 640, 337, 96, 96);
    else image(c, C.PICKUP_PATHS.bread, 640, 337, 96, 96);
    text(
      c,
      id ? name(id) : "30 HEALTH RESTORED",
      640,
      430,
      30,
      P.gold,
      "center",
      true,
    );
    text(
      c,
      result?.kind === "evolve"
        ? "TRANSFORMED"
        : result?.kind === "level"
          ? `${C.LEVEL_LABEL} ${result.level}`
          : "THE LAMP ENDURES",
      640,
      478,
      13,
      P.muted,
      "center",
    );
    button(c, menuRects(s)[0], "CONTINUE", true);
    return;
  }
  const isPause = s.screen === "paused";
  text(
    c,
    isPause ? C.PAUSED_TEXT : s.screen === "dawn" ? C.DAWN_TEXT : C.FALLEN_TEXT,
    640,
    235,
    54,
    P.cream,
    "center",
    true,
  );
  text(
    c,
    isPause
      ? "THE NIGHT CAN WAIT."
      : s.screen === "dawn"
        ? "YOU CARRIED THE LIGHT THROUGH."
        : "EVEN A SMALL LIGHT LEAVES A TRACE.",
    640,
    303,
    13,
    P.gold,
    "center",
  );
  if (!isPause)
    text(
      c,
      `${clock(r.tick)} SURVIVED   ·   LEVEL ${r.level}   ·   ${r.kills} SLAIN`,
      640,
      363,
      15,
      P.muted,
      "center",
    );
  (isPause ? C.PAUSE_ITEMS : C.END_ITEMS).forEach((t, i) =>
    button(c, menuRects(s)[i], t, s.menuIndex === i),
  );
}
export function render(s: DeepReadonly<WickState>, c: Context) {
  c.imageSmoothingEnabled = false;
  if (s.screen === "title") {
    title(c, s);
    return;
  }
  if (s.screen === "almanac" || s.screen === "howto") {
    c.fillStyle = P.ink;
    c.fillRect(0, 0, 1280, 720);
    if (s.screen === "almanac") almanac(c, s);
    else howto(c, s);
    return;
  }
  world(c, s);
  hud(c, s);
  if (s.screen !== "playing") overlay(c, s);
}
