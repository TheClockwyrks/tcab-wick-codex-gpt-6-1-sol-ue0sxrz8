import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState } from "./types";
import type { WickDebugApi } from "./debug-types";
import { initial, copy, stats, xpToNext, windowIndex } from "./model";
import { debug } from "./debug";
import { menus } from "./menus";
import { tick } from "./simulation";
import { render } from "./render";
import { images, imagePaths } from "./assets";
export type * from "./types";
export type * from "./debug-types";
export const BACKGROUND = "#0d1922";
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    await Promise.all([
      ...imagePaths.map(async (path) => {
        images.set(path, await api.assets.loadImage(path));
      }),
      ...Object.values(C.CUES).map((cue) =>
        api.audio.load(cue, C.CUE_PATHS[cue]),
      ),
    ]);
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register(
      "clock",
      (s) => `${s.run.tick} / ${(s.run.tick / C.TICK_HZ).toFixed(2)}s`,
    );
    api.diagnostics.register(
      "level / xp",
      (s) =>
        `${s.run.level} / ${s.run.xp.toFixed(1)} / ${xpToNext(s.run.level)}`,
    );
    api.diagnostics.register(
      "health",
      (s) => `${s.run.player.hp.toFixed(1)} / ${stats(s.run).maxHp}`,
    );
    api.diagnostics.register("kills", (s) => s.run.kills);
    api.diagnostics.register(
      "position",
      (s) =>
        `${s.run.player.x.toFixed(1)}, ${s.run.player.y.toFixed(1)} ${s.run.player.facing}`,
    );
    api.diagnostics.register(
      "enemies / window",
      (s) => `${s.run.enemies.length} / ${windowIndex(s.run)}`,
    );
    api.diagnostics.register(
      "projectiles / zones",
      (s) => `${s.run.projectiles.length} / ${s.run.zones.length}`,
    );
    api.diagnostics.register("gems", (s) => s.run.gems.length);
    api.diagnostics.register("weapons", (s) =>
      s.run.weapons
        .map((w) => `${w.id} ${w.level} (${w.cooldown.toFixed(2)})`)
        .join(", "),
    );
    api.diagnostics.register("passives", (s) =>
      s.run.passives.map((p) => `${p.id} ${p.level}`).join(", "),
    );
    api.diagnostics.register("queued levels", (s) => s.run.pendingLevelUps);
    for (const key of [
      "spawning",
      "events",
      "despawning",
      "enemyMotion",
      "enemyContact",
      "weaponFire",
      "effectMotion",
      "drops",
      "progression",
    ] as const)
      api.diagnostics.register(key, (s) => s[key]);
    return [initial(), debug];
  },
  update(state, api, dt) {
    const s = copy(state);
    s.simTime += dt;
    menus(s, api);
    if (s.screen === "playing") {
      s.accumulator += dt;
      const x = api.input.value("right") - api.input.value("left"),
        y = api.input.value("down") - api.input.value("up"),
        length = Math.hypot(x, y);
      while (
        s.screen === "playing" &&
        s.accumulator >= C.TICK_DT - C.TICK_EPSILON
      ) {
        s.accumulator -= C.TICK_DT;
        if (Math.abs(s.accumulator) < C.TICK_EPSILON) s.accumulator = 0;
        tick(s, api, length ? x / length : 0, length ? y / length : 0);
      }
    }
    if (s.screen !== "playing") s.accumulator = 0;
    const music = ["playing", "levelup", "chest", "paused"].includes(s.screen),
      hum =
        s.screen === "playing" &&
        s.run.weapons.some((w) => w.id === "halo" || w.id === "corona");
    if (music) api.audio.loop(C.CUES.music);
    else api.audio.stop(C.CUES.music);
    if (hum) api.audio.loop(C.CUES.hum);
    else api.audio.stop(C.CUES.hum);
    s.muted = api.audio.muted();
    return s;
  },
  render: (state, api) => render(state, api.ctx),
};
