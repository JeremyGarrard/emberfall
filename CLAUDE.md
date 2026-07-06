# Emberfall — agent conventions

MM7-style party RPG. Phaser 3 = UI/input/game logic (transparent canvas on top);
three.js = 3D world underneath. Plain JS globals, **no build step, no npm install,
no asset files** — every texture is painted in code at boot.

Read `ARCHITECTURE.md` before touching code. Pick tasks from `BACKLOG.md`.

## Run & verify

- `node server.js` → http://localhost:8123 (respects `PORT` env; `.claude/launch.json` has `autoPort`).
- Headless verification (the preview page reports `document.hidden=true`, so Phaser's loop sleeps):
  - Pump frames: `window.__step = f => { let t = game.loop.now||performance.now(); for(let i=0;i<f;i++){ t+=16.6; game.loop.step(t); } }`
  - Load `/?canvas` to force Phaser's Canvas renderer for captures.
  - Screenshot: composite `R3D.canvas` (3D, top 510px) + `game.canvas` (UI) onto a temp canvas,
    `toDataURL` → `POST /save/<name>.jpg` (server writes to `captures/`, which is gitignored).
- Drive gameplay from eval: `game.scene.getScene('World')` exposes everything
  (`castSkill`, `openInventory`, `partyAttack`, teleport via `px/py`...).

## Hard rules

- **No external assets or CDNs.** New art = canvas painters in `BootScene.create()`.
- **World gen must stay deterministic**: generation code uses `gri()`/`grand()` (seeded),
  never `Math.random()`. Combat/loot randomness uses `Math.random()`/`ri()` freely.
- Entity `uid`s come from seeded creation order — never reorder `buildEntities` spawn
  blocks or saved `gone` lists corrupt. Append new spawns at the end. **If your change
  adds/removes ANY spawn before the end of the order, bump the save version in
  `saveGame()` and add a migration branch in `create()`'s loader (see the v1→v2
  migration for the pattern: keep party/gold/quests, reset seed + gone).**
- Extend through registries (`SPELLS`, `ITEM_TYPES`, `VILLAGERS`, `SHOP_STOCK`,
  layouts), not by new special cases, wherever possible.
- Overlay panels (inventory/spellbook/shop) must guard combat input (`invOpen` etc.)
  and their `refresh*()` must early-return when closed (orphaned-UI bug otherwise).
- Test before claiming done. Commit per milestone with a descriptive message; never push
  unless the user asks.

## Voice

In-game text is medieval-fantasy flavored, short, and playful ("Odo tuts: not enough
gold."). Keep it.
