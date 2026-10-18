import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { WickState, Screen } from "./types";
import type { WickRect } from "./debug-types";
import { type State, initial, choose } from "./model";
import type { UpdateApi } from "@clockwyrks/simple-2d";
export const entries = (tab: number): readonly string[] =>
  [
    [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS],
    C.PASSIVE_IDS,
    C.ENEMY_IDS,
    [...C.GEM_TIERS, ...C.PICKUP_KINDS],
  ][tab];
export function menuRects(s: DeepReadonly<WickState>): WickRect[] {
  if (s.screen === "playing") return [];
  if (s.screen === "almanac")
    return entries(s.almanacTab)
      .slice(s.almanacScroll, s.almanacScroll + C.ALMANAC_ROWS)
      .map((_, i) => ({ x: 100, y: 190 + i * 42, width: 340, height: 38 }));
  if (s.screen === "howto" || s.screen === "chest")
    return [{ x: 470, y: 610, width: 340, height: 48 }];
  if (s.screen === "levelup")
    return s.run.offers.map((_, i) => ({
      x: 370,
      y: 260 + i * 86,
      width: 540,
      height: 70,
    }));
  const count = s.screen === "title" ? C.TITLE_ITEMS.length : 2;
  return Array.from({ length: count }, (_, i) => ({
    x: s.screen === "title" ? 144 : 470,
    y: (s.screen === "title" ? 380 : 445) + i * 65,
    width: 340,
    height: 52,
  }));
}
export function tabRects(s: DeepReadonly<WickState>): WickRect[] {
  return s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 100 + i * 270,
        y: 117,
        width: 250,
        height: 45,
      }))
    : [];
}
export function screen(s: State, name: Screen) {
  s.screen = name;
  s.menuIndex = 0;
  s.almanacTab = 0;
  s.almanacScroll = 0;
  s.pointerArm = null;
  if (name !== "playing") s.accumulator = 0;
}
export function start(s: State) {
  const muted = s.muted,
    time = s.simTime;
  s.run = initial().run;
  s.movedTicks = 0;
  s.moving = false;
  s.puffs = [];
  s.accumulator = 0;
  s.muted = muted;
  s.simTime = time;
  s.run.weapons = [{ id: "taper", level: 1, cooldown: 0 }];
  screen(s, "playing");
}
function title(s: State, index = 0) {
  const muted = s.muted,
    time = s.simTime;
  s.run = initial().run;
  s.puffs = [];
  s.movedTicks = 0;
  s.moving = false;
  screen(s, "title");
  s.muted = muted;
  s.simTime = time;
  s.menuIndex = index;
}
function confirm(s: State, api: UpdateApi) {
  const before = s.screen;
  if (before === "levelup") {
    choose(s, s.menuIndex);
    api.audio.play(C.CUES.choose);
    if (s.screen === "levelup") api.audio.play(C.CUES.levelUp);
    return;
  }
  if (before === "chest") {
    s.run.chestResult = null;
    screen(s, "playing");
    return;
  }
  if (before === "howto") {
    title(s, 2);
    return;
  }
  if (before === "almanac") return;
  if (before === "title") {
    api.audio.play(C.CUES.menuConfirm);
    if (s.menuIndex === 0) start(s);
    else screen(s, s.menuIndex === 1 ? "almanac" : "howto");
    return;
  }
  if (before === "paused") {
    api.audio.play(C.CUES.menuConfirm);
    if (s.menuIndex === 0) screen(s, "playing");
    else title(s);
    return;
  }
  if (before === "fallen" || before === "dawn") {
    api.audio.play(C.CUES.menuConfirm);
    if (s.menuIndex === 0) start(s);
    else title(s);
  }
}
const inside = (p: { x: number; y: number }, r: WickRect) =>
  p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
function scroll(s: State) {
  const count = entries(s.almanacTab).length;
  s.almanacScroll = Math.max(
    0,
    Math.min(
      Math.max(0, count - C.ALMANAC_ROWS),
      Math.max(
        Math.min(s.almanacScroll, s.menuIndex),
        s.menuIndex - C.ALMANAC_ROWS + 1,
      ),
    ),
  );
}
export function menus(s: State, api: UpdateApi) {
  const input = api.input,
    old = s.menuIndex,
    oldTab = s.almanacTab;
  if (input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
  const back = input.pressed("back"),
    pause = input.pressed("pause");
  if (s.screen === "playing") {
    if (back || pause) screen(s, "paused");
    return;
  }
  if (s.screen === "paused" && (back || pause)) {
    screen(s, "playing");
    return;
  }
  if (back) {
    if (s.screen === "howto") title(s, 2);
    else if (s.screen === "almanac") title(s, 1);
    else if (s.screen === "fallen" || s.screen === "dawn") title(s);
    return;
  }
  if (s.screen === "almanac") {
    const d = Number(input.pressed("right")) - Number(input.pressed("left"));
    if (d) {
      s.almanacTab =
        (s.almanacTab + d + C.ALMANAC_TABS.length) % C.ALMANAC_TABS.length;
      s.menuIndex = 0;
      s.almanacScroll = 0;
    }
    const steps = Math.trunc(input.wheel().y / C.WHEEL_ROW);
    if (steps)
      s.almanacScroll = Math.max(
        0,
        Math.min(
          Math.max(0, entries(s.almanacTab).length - C.ALMANAC_ROWS),
          s.almanacScroll + steps,
        ),
      );
  }
  const count =
    s.screen === "almanac" ? entries(s.almanacTab).length : menuRects(s).length;
  if (!["howto", "chest"].includes(s.screen) && count) {
    const d = Number(input.pressed("down")) - Number(input.pressed("up"));
    s.menuIndex = (s.menuIndex + d + count) % count;
  }
  if (s.screen === "almanac" && s.menuIndex !== old) scroll(s);
  if (input.pressed("confirm") && !["almanac", "howto"].includes(s.screen)) {
    if (s.menuIndex !== old || s.almanacTab !== oldTab)
      api.audio.play(C.CUES.menuMove);
    confirm(s, api);
    return;
  }
  // Samples retain press origin across frames and across multiple simultaneous contacts.
  let activate = false;
  for (const p of input.pointerSamples()) {
    if (!p.primary || (p.button && p.button !== "primary")) continue;
    const tabs = tabRects(s),
      rows = menuRects(s);
    const ti = tabs.findIndex((r) => inside(p, r)),
      ri = rows.findIndex((r) => inside(p, r));
    const target = ti >= 0 ? -ti - 2 : ri;
    if (
      p.type === "move" &&
      p.device !== "touch" &&
      !p.buttons.includes("primary") &&
      ri >= 0 &&
      !["howto", "chest"].includes(s.screen)
    )
      s.menuIndex = ri + (s.screen === "almanac" ? s.almanacScroll : 0);
    if (p.type === "down") {
      s.pointerArm = { id: p.id, screen: s.screen, target };
      if (ri >= 0 && !["howto", "chest"].includes(s.screen))
        s.menuIndex = ri + (s.screen === "almanac" ? s.almanacScroll : 0);
    }
    if (p.type === "up") {
      const arm: State["pointerArm"] = s.pointerArm;
      s.pointerArm = null;
      if (
        arm?.id === p.id &&
        arm.screen === s.screen &&
        arm.target === target
      ) {
        if (ti >= 0 && ti !== s.almanacTab) {
          s.almanacTab = ti;
          s.menuIndex = 0;
          s.almanacScroll = 0;
        } else if (ri >= 0) {
          if (s.screen !== "almanac") {
            s.menuIndex = ri;
            activate = true;
            break;
          }
        }
      }
    }
  }
  if (s.menuIndex !== old || s.almanacTab !== oldTab)
    api.audio.play(C.CUES.menuMove);
  if (activate) confirm(s, api);
}
