# Repository Instructions

## Project Summary
Gravity Smash is a single-package browser game built with React 18, TypeScript, Vite, and Matter.js. The app currently has two gameplay modes (`arcade` and `turn-based`) and persists player progress locally in IndexedDB.

## Repository Layout
- `src/main.tsx` mounts the React app and loads the global stylesheet.
- `src/App.tsx` is the React shell: main menu, HUD, overlays, sound toggle, progress load/save, and `GravitySmashGame` lifecycle.
- `src/game/` contains gameplay domain code: balance config, shared types, per-level settings, UI text/state helpers, rendering, economy, and the main game controller.
- `src/game/GravitySmashGame/` contains helper modules used internally by `src/game/GravitySmashGame.ts`.
- `src/audio/GameAudio.ts` implements synthesized audio with the Web Audio API. No external audio files are used today.
- `src/storage/progressStore.ts` handles IndexedDB persistence.
- `src/styles/game.css` is the single global stylesheet for menu, HUD, overlays, ability buttons, and responsive rules.
- `index.html` is the Vite HTML shell.
- `dist/` is generated build output. Do not edit it by hand.
- `node_modules/` contains installed dependencies. Do not edit it.

## Confirmed Tooling And Commands
Use `npm`. `package-lock.json` is present and no other package-manager lockfile was found.

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Main verification: `npm run build`
- Release-mode build: `npm run build:release`
- Preview built app: `npm run preview`

## Build And Config Notes
- The npm scripts point to `vite.config.mjs`; that is the active Vite config.
- `vite.config.ts` also exists with matching content. If build behavior changes, keep both files aligned or remove the duplication intentionally in a dedicated change.
- `tsconfig.json` is strict and uses `noEmit: true`.

## Working Rules
- Preserve the external contract between `src/App.tsx` and `src/game/GravitySmashGame.ts`. `App` currently calls:
  - `startLevel`
  - `restartCurrentLevel`
  - `pauseGame`
  - `useFreezePower`
  - `useFirePower`
  - `useSpectrumPower`
  - `handlePrimaryOverlayAction`
- Preserve the persisted progress contract across `src/game/types.ts`, `src/game/GravitySmashGame.ts`, and `src/storage/progressStore.ts`.
  - `GameProgressSnapshot` and `EconomySnapshot` are shared contracts.
  - IndexedDB naming and keys live in `src/storage/progressStore.ts`; change them only when intentionally migrating saved data.
- Keep user-facing copy consistent with the current Russian UI unless the task explicitly includes copy changes.
- `src/styles/game.css` uses global ids/classes that are matched directly by `src/App.tsx`; rename selectors only when updating both sides together.
- Prefer changing balance, spawn odds, costs, and progression in `src/game/config.ts` and `src/game/level.ts` instead of scattering new constants through controller code.
- Do not hand-edit `dist/` or `node_modules/`.

## Things Not Confirmed In This Repo
The following were not found in the repository at the time of writing:
- README or docs directory
- CI workflow configuration
- Docker / Compose files
- test configuration or test scripts
- eslint / prettier configuration
- `.env` example files
- monorepo / workspace configuration

Do not assume those systems exist unless you add them.

## Verification Expectations
- Minimum verification for code changes: `npm run build`
- If you change build behavior or release-only behavior, also run `npm run build:release`
- If you add new repo-wide commands or setup requirements, update this file because no other project-level operating documentation was found
