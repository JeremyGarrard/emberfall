# Emberfall — party RPG prototype

A tiny Might & Magic-flavored party RPG. **Phaser 3** (MIT) runs the game and every UI
element; **three.js** (MIT) renders the world in real 3D underneath it: a true terrain
heightfield with **rolling hills you walk up and down**, carved riverbeds, a mountain rim,
buildings with gabled roofs, billboard trees and monsters, haze fog, and a day sky.
Movement is slope-aware (too steep = no path), sight lines respect hills, and the Fly
spell lifts the party into genuine 3D flight. Zero build step, zero asset files — every
texture is generated in code at boot.

## Run it

Double-click **`start-game.bat`** — it starts the server and opens the game in your browser.

Or by hand:

```
node server.js
```

then open http://localhost:8123 (or use the Claude preview panel — config name `rpg`).
Stop the server with Ctrl+C. Only one copy can hold a port at a time (the server
respects a `PORT` env var if you need a different one).

The view renders at 960x510 internally and scales to fit the window. On a slower
machine, add `?res=720` or `?res=480` to the URL for more frame rate. Press F for
fullscreen. Mouse-look tilts up/down as well (click the view to grab the mouse).

The renderer takes its cues from the GrayFace MM7 patch: 64px detail textures,
long draw distance with soft haze, vertical look via horizon shear, and an
uncapped smooth frame loop.

## What's in the prototype

- **First-person view** — raycast-rendered forest walls, mountain border, deep-water walls,
  distance fog, and ground-aligned billboard sprites for monsters, chests, and the fountain.
- **Party of four** — Roderick (Knight), Wren (Archer), Serena (Cleric), Malwick (Sorcerer),
  each with HP/MP, attack/defense, XP, levels, and one class skill.
- **Emberfall village** — a hand-authored, palisaded village (Harmondale-inspired layout,
  original art): timbered town hall, stone smithy, the Silver Stoat tavern, plank trading
  post, well, lampposts, and the healing fountain on the green. One gate faces east toward
  the wilds. The village is defined as an ASCII map in `world.js` (`VILLAGE_LAYOUT`) and
  stamped onto the world — edit the text to remodel the town. Monsters cannot enter the
  palisade; they spawn and hunt only in the wilderness beyond.
- **Wilderness** — the rest of the 50x38 map stays procedural: forests, lakes, treasure
  chests, and 18 monsters. Difficulty scales with distance: slimes → goblins → dire wolves.
- **Real-time combat, MM6/7 style** — no separate battle screen. Monsters aggro on sight
  (7 tiles + line-of-sight), chase at type-specific speeds, body-block you, and claw a
  random hero on a cooldown (red vignette + screen shake). The monster in your sights is
  auto-targeted (name + HP under the compass, HP bar over its sprite). **SPACE or click**
  fires a party volley — every hero off cooldown and in range attacks (the Knight needs
  melee reach; the Archer shoots far). **1–4** cast hero skills: Cleave hits everything
  in reach, Double Shot, Heal picks the most wounded, Fireball splashes. Kills pay XP and
  gold instantly; party wipe = wake at camp with half your gold. The camp glade is a
  sanctuary monsters cannot enter.
- **Minimap + compass** — MM7-style corner map (M toggles it) with monster/chest/fountain dots.
- **Real building facades** — oak doors that swing open as you approach (and shut behind you),
  glass windows, a forge-glow window on the smithy, hanging shop signs (mug, anvil, coins),
  heraldic banners on the town hall, a smoking chimney, wooden interior floors, and furniture
  (anvil, barrels, crates). Wall textures alternate variants by tile parity so long walls
  don't repeat.
- **LLM-voiced villagers** — five villagers live in (and around) their buildings: Elder Maren
  in the town hall, Bram in the smithy, Hilda behind the tavern bar, Odo in the trading post,
  Tilly by the well. Walk up and press **T** to talk: dialogue is generated live by your
  local LLM, streamed token-by-token. Each villager has a persona plus *real game knowledge*
  injected into the prompt — chest directions, monster counts, party health — so their tips
  are true. Conversations persist per villager for the session.

### Local LLM setup

The server auto-detects **Ollama** (port 11434) or any **OpenAI-compatible** server such as
LM Studio (port 1234) and picks the smallest installed chat model. Override with
`LLM_MODEL=<name> node server.js`. No LLM running → villagers politely say so.

| Endpoint | Purpose |
|---|---|
| `GET /api/llm` | `{available, kind, model}` |
| `POST /api/chat` | `{messages:[...]}` → streamed NDJSON `{delta}` lines (backend-agnostic) |

### The vale (96x72 tiles)

Rolling hill country, oak and pine forests, three lakes, and a winding river split the
map; one dirt road runs east from the village gate, fording the river and cutting passes
through the hills. Monsters get meaner with distance: slimes near the walls, goblins in
the midlands, dire wolves in the deep east.

### Inventory & loot

Press **I** for the party goods panel (MM7-style stone-and-parchment chrome, painted in
code like everything else). Pick a hero, then click gear to equip it — weapons and armor
add real ATK/DEF. Potions heal the selected hero, rough emeralds sell for gold. Chests
now hold gear as well as gold (better loot farther out), and monsters sometimes drop
potions or gems. The party bar shows painted portraits, MM7-style.

### Quests & magic

- **The Lost Blade** — Bram the Smith's masterwork sword was stolen by goblins camped far
  east across the ford. Accept the quest in his dialogue (the offer button), follow the
  road, take the camp, walk over the blade, and bring it home. Reward: party XP and a new
  spell — **Fly** — for Malwick (R/X or PgUp/PgDn to rise and dive, cast again to land;
  melee monsters can't touch an airborne party). A quest tracker sits above the party bar.
- **Spell visuals** — every spell has a 3D effect: travelling bolts with trails, chain-
  lightning beams, expanding nova rings, rising self-buff motes, meteors during
  Armageddon, and impact bursts on every hit (including arrows and sword blows). All
  driven by a pooled particle system (`src/fx.js`) — a new spell's look is one line of
  registry data.
- **Schools of magic** — eight MM7-style schools: Fire, Air, Water, Earth, Body, Spirit,
  Light, and Dark, with 24 spells across them. Chain lightning, knockback thunderclaps,
  burning damage-over-time, roots that pin charging wolves, true-damage spirit strikes,
  vampiric drains, in-field Raise Dead, Water Walk (cross rivers without Fly), timed party
  buffs (Bless, Stone Skin, Hour of Power — timers show by the HUD), and Armageddon, which
  smites every monster in the vale and singes your own party, as is right and proper.
- **Learning magic** — each hero has MM7-authentic school access (Roderick trusts steel;
  Wren dabbles in Air/Water; Serena holds Body/Spirit/Light; Malwick commands the elements
  and Dark). New spells come from **scrolls**: Odo sells six, chests hide the rest, and
  the Armageddon scroll only turns up in the deep east. Keys 1–4 cast each hero's *readied*
  spell; **B** opens the spellbook — hero tabs, school-grouped pages, click to ready.

### Controls

| Context | Keys |
|---|---|
| Walk / strafe | W/S (or ↑/↓) walk, A/D strafe |
| Turn / look | ←/→, or click the view for mouse-look with vertical tilt (Esc releases) |
| Attack (party volley) | F, SPACE, or click |
| Cast readied spells | 1 / 2 / 3 / 4 |
| Spellbook / Inventory | B / I |
| Fly (once learned) | R/X or PgUp/PgDn rise and dive; cast again to land |
| Talk to villager | T (when close) |
| Minimap / Fullscreen | M / F11 |
| New game | N twice (progress auto-saves) |

## Contributing (humans or agents)

`CLAUDE.md` has the conventions, `ARCHITECTURE.md` maps the systems and extension
recipes, and `BACKLOG.md` is a list of self-contained tickets sized for a single
session each. Everything extends through registries — most tasks touch one file.

## Code layout

| File | Purpose |
|---|---|
| `src/data.js` | Party roster, villager personas, enemy stat blocks, shared game state, helpers |
| `src/dialogue.js` | Villager dialogue overlay + streaming LLM client + live-game-state prompt builder |
| `src/render3d.js` | three.js renderer: terrain heightfield mesh, water planes, wall boxes, gabled roofs, billboard sprites, projection helpers |
| `src/world.js` | `BootScene` (canvas-drawn textures) + `WorldScene` (map gen, movement, real-time combat, chase AI, minimap, HUD) |
| `src/main.js` | Phaser config (`?canvas` URL flag forces the Canvas renderer for headless captures) |
| `server.js` | Dependency-free static server; `POST /save/<name>.jpg` saves base64 screenshots to `captures/` |
| `vendor/phaser.min.js` | Phaser 3.87 (vendored, no npm install needed) |

## Scoping ideas (roughly in order of payoff)

1. **Real art** — swap generated textures for a tileset + sprite sheets (e.g. Kenney.nl or
   OpenGameArt, both CC0). Phaser loads sprite sheets natively.
2. **Towns & NPCs** — dialogue boxes, shops (spend that gold), inns, quest givers.
3. **Inventory & equipment** — weapons/armor that modify atk/def, potions usable in battle.
4. **More spells** — MM7-style spell schools per class instead of one skill each.
5. **Authored maps** — the [Tiled](https://www.mapeditor.org/) editor exports JSON that Phaser
   reads directly; replaces the procedural scatter with designed zones + dungeons.
6. **Save/load** — `GameData` is already one serializable object; `localStorage` makes it trivial.
7. **Sound** — Phaser has built-in audio; a few retro SFX + a music loop go a long way.

### Saving

Progress **saves itself** (every 10 seconds and on every kill, chest, purchase, and
quest beat) to your browser's localStorage. The save stores the world *seed*, so the
same vale regrows on load — minus every chest you've looted and monster you've slain.
Press **N twice** to abandon the journey and roll a fresh vale.

### Shopping

Talk to Odo the Peddler at his trading post and hit **Browse Odo's wares**: potions and
gear bought with a click (prices go red when your purse can't keep up). Sell gems from
your own pack via the inventory (I).
