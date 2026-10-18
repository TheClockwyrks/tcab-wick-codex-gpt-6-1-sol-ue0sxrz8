# Wick

**Keep the light.** A browser survival game about a lone lamplighter in a moth-choked city. Walk to dodge the creatures while your tools fire themselves. Collect gems, choose upgrades, transform mastered tools through elite chests, and survive ten minutes to dawn.

Wick includes ten base tools, six evolutions, ten trinkets, thirteen enemy types, an illustrated almanac, animated pixel sprites, fourteen sound cues, and an original looping score. Everything runs locally in your browser, with no backend or external requests.

## Play and build

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. To make a production site:

```sh
npm run build
npm run preview
```

Serve `dist/` with any static web server. It also works mounted beneath a sub-path; URLs are relative to the page. `public/assets` links to the committed `assets` directory, so Vite copies the original files into `dist/assets` at their engine-loader paths. Builds do not generate assets or require authoring tools.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk; navigate menus |
| Enter / Space | Choose; continue |
| Escape | Back; pause or resume |
| P | Pause or resume |
| M | Toggle sound |
| Backtick | Engine diagnostic overlay |
| Mouse / touch | Highlight and choose menu items and almanac tabs |
| Wheel | Scroll almanac entries |

Touch devices also receive the engine's directional pad. The first key or pointer interaction unlocks audio. Tools attack automatically; you steer only the lamplighter.

## Development

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests stand up the real Simple 2D engine over an in-process canvas and a counted clock. They cover fixed ticks, input, combat, progression, all tools and evolutions, the director, and endings. Test-only asset adapters stand in for browser decoders; Chromium verification uses the shipped files.

`src/game.ts` binds the engine lifecycle, `model.ts` derives stats and progression, `simulation.ts` implements the ordered tick, `menus.ts` resolves input, `render.ts` draws the stage, and `debug.ts` supplies pure poses and snapshots. State transitions work on private drafts and return new values; rendering never advances the simulation. The engine owns frames, input, audio, asset decoding, fitting, diagnostics, and recording.

## Original assets and showcase

All sprites were authored here with `draw` and `draw-sheet`, and all audio with `sfx-synth` and `music`. The optional one-time authoring scripts in `scripts/produce-art.py` and `scripts/produce-sound.py` document their construction. They need the authoring binaries and Python 3, and are never called by install or build. The PNG, WAV, and MIDI files under `assets/` are the distributable originals.

`showcase/` contains screenshots and a three-second replay captured through the engine's draw-command recorder. `scripts/capture.mjs` reproduces that showcase with a running development server and the project-local Playwright Chromium. Its late-night scene is posed through the same debug API used by the tests; the recorded frames then run the game's live simulation.
