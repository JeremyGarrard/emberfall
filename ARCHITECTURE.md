# Emberfall architecture

Two engines, stacked. **Phaser 3** (transparent canvas, z-index 1) runs input, HUD,
panels, floaters, minimap, and all game logic. **three.js** (canvas underneath, top
510/640 of the view) renders the world. They meet in exactly two places: `R3D.render(state)`
each frame, and `R3D.project(x,y,z)` → overlay coords for HP bars/floaters.

## Files

| File | Owns |
|---|---|
| `server.js` | Static files, `/api/chat` LLM proxy (auto-detects Ollama/OpenAI-compatible, streams NDJSON `{delta}`), `/api/llm` status, `POST /save/<name>.jpg` debug captures |
| `src/data.js` | All registries: `SCHOOLS`, `HERO_SCHOOLS`, `SPELLS` (with `.fx`), `SCROLL_PRICE`, `ITEM_TYPES` (+auto-generated scrolls), `SHOP_STOCK`, `VILLAGERS`, `QUESTS`, `ENEMY_TYPES`, `GameData` (party/gold/inventory/flags/quests), seeded RNG (`setSeed/grand/gri`), helpers (`heroAtk/heroDef/invAdd/dirName`) |
| `src/fx.js` | `FX` — pooled additive-sprite effects: `bolt/burst/ring/beam`, `FX.update(time)` driven by R3D |
| `src/render3d.js` | `R3D` — scene build (terrain heightfield w/ vertex colors + detail map, water planes, wall boxes per tile, gabled roofs from `BUILDINGS`, sky dome), entity↔sprite sync, camera, `project()`, `syncSize()`. Also declares `ART/WALL_ART/FLOOR_PIX/SKY/WALL_HEIGHT` globals that Boot fills |
| `src/world.js` | `BootScene` (every canvas painter) + `WorldScene` (~everything else: gen, save/load, movement, flight, combat, spells, quests, panels, HUD, minimap) |
| `src/dialogue.js` | `Dialogue` — LLM villager chat overlay (DOM), system prompts built from live game state, quest/shop buttons |

## WorldScene create() order (matters)

save-load → seed → `buildMap()` (tiles + `buildHeights()`) → `buildEntities()` →
gone-filter → restore GameData → R3D.init → input/keys → timers → UI (questText/buffText
BEFORE `buildHUD()` — refreshHUD writes to them) → panels.

## Key systems & invariants

- **Tiles**: floors 0 grass, 1 dirt, 2 cobble, 3 water, 4 wood (walkable = ≤2 or 4;
  water walkable only under Water Walk / sinking grace). Walls ≥5 (see `WALL_HEIGHT`).
  Only tiles ≥5 block sight; terrain also occludes (`lineOfSight` samples the height line).
- **Terrain**: `heights[]` vertex grid from seeded mounds; `terrainH(x,y)` bilinear;
  `slopeAt>0.85` blocks walking. Village is a flattened shelf; road is a carved valley;
  riverbeds dip to −0.9 with the water plane at −0.22. `camZ = ground + eyeZ`.
- **Determinism/saves**: world regrows from `worldSeed`; killed/looted entity `uid`s
  live in the save's `gone` list. Save v1 in `localStorage['emberfall-save']`
  (autosave 10s + event saves). N-twice = new game.
- **Combat**: real-time. `pickTarget()` = screen-cone via `R3D.project` + LOS.
  `partyAttack` = per-hero recovery/range volley. `castSkill` = switch on readied spell id;
  visuals via `spellFX()` reading `SPELLS[id].fx` + `damageEnemy`'s universal impact burst.
- **Buffs**: `scene.buffs.{atk,def,haste,regen,waterwalk}Until` timestamps;
  `buffAtk()/buffDef()/hasteMul()` at damage/recovery sites; readout text top-right.
  Enemy statuses: `slowUntil`, `rootUntil`, `curseUntil`, `burnUntil` (DoT tick in the AI
  loop — which iterates a COPY because kills splice).
- **Flight**: `eyeZ` 0.5→2.1 above terrain; enemies can't melee above 1.05; interactions
  need `grounded`; can't land on water/steep slopes.
- **Sanctuary**: `inVillage(x,y,pad)` — monsters never path inside.

## Design docs (read before the matching epic)

`design/LORE.md` (world/factions/campaign), `design/SPELLS.md` (72-spell compendium),
`design/SPELLCRAFT.md` (invent-spells-by-talking LLM feature), `design/WORLD.md`
(multi-zone + world-map architecture), `design/PROGRESSION.md` (towns/guilds/
training), `design/GRAPHICS.md` (asset pipeline + procedural-polish tracks).

## Real-asset overrides

`assets/manifest.json` is a `[{key,file}]` list; `BootScene.preload` loads them and
`applyAssetOverrides()` swaps the loaded image into `ART[key]` at native res before
texture registration — overriding any painter (portraits, billboards, `face_<id>`,
items). Empty/missing = painter fallback (must always work). Dialogue shows
`face_<villagerId>` ‖ the villager's billboard.

## Extension recipes

- **New spell**: add to `SPELLS` (school/name/cost/desc/icon/fx) + icon painter in Boot +
  register icon key + a `case` in `castSkill`. Scroll item auto-generates. Done.
- **New spell VISUAL**: set `fx: {type: bolt|beam|nova|self, color, r}` — no code.
  Custom flourishes: call `FX.*` inside the spell's `case`.
- **New item**: `ITEM_TYPES` entry + `it_*` icon painter + registration; add to
  `SHOP_STOCK`/loot tables as desired. `clickItem()` handles kinds: weapon/armor/potion/
  valuable/scroll/quest.
- **New monster**: `ENEMY_TYPES` entry + billboard painter + `SPRITE_META` vDiv + spawn
  block in `buildEntities` (APPEND — uid order!). Ranged/caster monsters need a new
  attack branch in the AI loop.
- **New villager**: `VILLAGERS` entry (persona/specialty/greeting/spot layout-relative)
  + portrait-ish billboard painter + optional specialty facts in `dialogue.js buildSystem`.
- **New building**: edit `VILLAGE_LAYOUT` chars + `CHAR_TILE` + `BUILDINGS` roof rect.
- **New quest**: `QUESTS` entry + state machine in `GameData.quests` + offer/complete
  hooks in `dialogue.js openFor` + world triggers (see lostblade for the pattern).
- **New settlement**: add a `{layout, x1, y1}` entry to `SETTLEMENTS` (x2/y2 are
  derived). The stamp, `inVillage` sanctuary, prop spawns, and terrain shelf all loop
  the list. New layout chars → `CHAR_TILE` (+`CHAR_PROP` for prop/decor tiles like the
  camp's `K` campfire and `X` tents). Villagers pin to a settlement via `st:` index +
  layout-relative `spot`; give them a `locale` string to override the Emberfall blurb in
  `dialogue.js buildSystem`. Roofed buildings still come from `BUILDINGS` (village only).
