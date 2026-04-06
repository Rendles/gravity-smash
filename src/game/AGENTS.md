# Gameplay Subsystem Instructions

This directory contains the gameplay domain. Most cross-file runtime contracts live here.

## Directory Map
- `config.ts` is the main balance and feature-tuning file for both modes.
- `types.ts` contains shared gameplay, UI, audio, and persistence types.
- `level.ts` derives per-level settings from `GAME_CONFIG`.
- `ui.ts` formats HUD labels, overlay copy, and default UI state.
- `rendering.ts` contains canvas drawing and visual-effect helpers.
- `economy.ts` owns coin rewards and upgrade catalog state.
- `GravitySmashGame.ts` is the main Matter.js controller and the public gameplay API used by `src/App.tsx`.
- `GravitySmashGame/` contains helper modules that are internal to `GravitySmashGame.ts`:
  - `matching.ts`
  - `pieceFactory.ts`
  - `progress.ts`
  - `specials.ts`
  - `turnBased.ts`

## Local Rules
- Treat `GravitySmashGame.ts` and `GravitySmashGame/` as one subsystem. Keep those helpers internal to the controller; do not import them from React/UI files.
- Keep gameplay rules in the controller or its helpers, not in `rendering.ts` or `ui.ts`.
- Keep tuning and progression values in `config.ts` when possible. `level.ts` should derive mode/level settings from config rather than introducing disconnected hardcoded numbers.
- Changes to `types.ts` are contract changes. When editing these types, check all consumers:
  - `GameUiState`
  - `GameControllerOptions`
  - `GameProgressSnapshot`
  - `EconomySnapshot`
  - `LevelSettings`
  - `GamePieceBody`
- `rendering.ts` should stay visual. It can read body/effect state and draw it, but it should not decide spawns, wins, rewards, or persistence.
- `ui.ts` should stay focused on labels, overlay state composition, and presentation text. Do not move engine mutations into it.
- `pieceFactory.ts` is the source of truth for creating pieces. If you add a new piece type, update the full chain:
  - shape/body flags in `types.ts`
  - spawn/balance values in `config.ts` and `level.ts`
  - creation logic in `pieceFactory.ts`
  - matching or special behavior in `GravitySmashGame.ts` and/or its helpers
  - drawing in `rendering.ts`
- The same controller supports both `arcade` and `turn-based`. When changing mode-specific logic, check the other mode explicitly because many helpers are shared.
- Progress emission is part of gameplay behavior. If you change what should persist between sessions, update both the controller side and `src/storage/progressStore.ts`.

## Verification
- After gameplay changes, run `npm run build`
- If you touched build-time or release-specific behavior connected to gameplay, also run `npm run build:release`
