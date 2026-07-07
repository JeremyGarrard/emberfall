# Backlog — the roadmap

Self-contained tickets, executable in isolation by any capable model. **Read
`CLAUDE.md` and `ARCHITECTURE.md` first.** Deep specs live in `design/`; each
epic below points to its doc — read that doc before starting the epic.

Rules (every ticket): verify in the running game (frame-pump + capture, see
CLAUDE.md), keep world-gen deterministic, and **if you change spawn order or
save shape, bump the save version + add a migration** (CLAUDE.md rule). Commit
per ticket with a clear message. Sizes: S ≈ a sitting, M ≈ a session, L ≈ a big
session, XL ≈ break into sub-tickets first.

Legend: 🔒 = blocked by a dependency (listed). Do unblocked tickets first.

---

## EPIC 1 — Graphics: kill the "blobs of paint" → `design/GRAPHICS.md`
The asset pipeline + a dialogue portrait slot are **already built** (this
session). These tickets fill and polish.

- **1.1 [S] Portrait painter overhaul.** Reshade `pt_*` + villager billboards:
  tone ramps, rim light, per-class vignette bg, 64→128px. GRAPHICS.md Track B1.
- **1.2 [S] Produce & wire real faces.** Generate/collect 10 face PNGs
  (`face_*`, `pt_*`), drop in `assets/`, list in `manifest.json`. Verify the
  dialogue portrait + HUD swap. GRAPHICS.md Track A. (No code — content ticket.)
- **1.3 [S] Billboard shading + contact shadows.** Vertical gradient + ground
  shadow decal under every billboard. GRAPHICS.md Track B2.
- **1.4 [S] Final-composite color grade + vignette.** GRAPHICS.md Track B5.
- **1.5 [S] Smooth-mode toggle.** Linear filter/mipmaps option for faces &
  billboards, crisp UI. GRAPHICS.md Track B4. Persist in save.

## EPIC 2 — More spells → `design/SPELLS.md`
72 spells specced; ~24 exist. Each sub-ticket = one school's remaining spells
(entry + icon painter + castSkill case; scroll auto-generates).

- **2.0 [M] Shared spell mechanics.** Build the reusable primitives SPELLS.md
  lists: `summon`, `wallSpell`, `charm`, `sleep`, `projectileSpell`, `blink`,
  `channel`, `aura`, and the status helpers (dodge/reflect/temp-maxHP/dmg-floor).
  **Do this first** — most new spells depend on it. Each helper respected by ALL
  damage paths (no formula forks).
- **2.1 [S] Fire school** remaining (Ember Spray, Wall of Flame, Immolation,
  Meteor Swarm, Phoenix Heart). 🔒2.0 for the last three.
- **2.2 [S] Air** remaining. 🔒2.0
- **2.3 [S] Water** remaining. 🔒2.0
- **2.4 [S] Earth** remaining (Golem needs summon). 🔒2.0
- **2.5 [S] Body** remaining. 🔒2.0 (temp-maxHP, dmg-floor)
- **2.6 [S] Spirit** remaining (totem/summon). 🔒2.0
- **2.7 [M] Mind school (NEW, 9th school).** Add to SCHOOLS/HERO_SCHOOLS + 8
  spells (charm/sleep-heavy). 🔒2.0
- **2.8 [S] Light** remaining. 🔒2.0
- **2.9 [S] Dark** remaining (Plague on-death hop). 🔒2.0

## EPIC 3 — Spellcraft: invent spells by talking → `design/SPELLCRAFT.md`
The marquee LLM feature. Primitive-composition, client-validated. 🔒 EPIC 2.0
(shares the primitive executor).

- **3.1 [M] Spec schema + validator + power-budget table.** Pure module, unit-
  testable. No UI yet.
- **3.2 [M] `applyEffects(spec, ctx)` executor** over EPIC-2.0 primitives; migrate
  a couple of hand-authored spells onto it to prove parity.
- **3.3 [S] craftedSpells persistence** + runtime SPELLS registration on load.
  (Save-shape change → version bump.)
- **3.4 [M] Xarthax NPC + Spellcraft dialogue mode.** LLM tool-call → spec →
  validate → learn. 🔒3.1–3.3
- **3.5 [S] Offline recipe-picker fallback** (same primitives, no LLM). 🔒3.1

## EPIC 4 — Multiple maps + world map → `design/WORLD.md`
Biggest architectural lift. Do the refactor before authoring many zones.

- **4.1 [L] ZONES refactor.** Extract the implicit single map into a ZONES
  registry; WorldScene takes a zone descriptor; wrap current world as
  `embervale`. Pure refactor, no behavior change. **Foundational.**
- **4.2 [M] Save v3 + per-zone zoneState + migration** from v2. 🔒4.1
- **4.3 [M] Edge-exit transitions** between two zones (embervale ↔ pinereach
  stub). 🔒4.1
- **4.4 [L] Author Pinereach** (forest theme; pulls in EPIC 6 monsters/quests).
  🔒4.1
- **4.5 [L] WorldMapScene** — parchment map of Averron, node travel, unlocks,
  fog-of-war. 🔒4.1
- **4.6 [M] Town-theme zones** (no monster spawns, shop props). 🔒4.1, feeds EPIC 5.

## EPIC 5 — Towns, guilds, training, upgrades → `design/PROGRESSION.md`
Makes gold matter and adds build depth. 🔒 EPIC 4 for the town zones.

- **5.1 [M] Skill ranks.** `hero.skillRank[school]`, rank multiplier at cast
  site, tier gating on learn/cast. No new zone needed — ship first.
- **5.2 [M] Guild trainer NPC + training panel** (gold sink, level gates). 🔒5.1
- **5.3 [S] Character sheet (C key)** — level/XP/ranks/gear per hero.
- **5.4 [L] Town zones + guild halls + spell shops with tier/standing gates.**
  🔒4.6, 5.1
- **5.5 [M] Guild standing + one guild questline** (Master-tier chase). 🔒5.4
- **5.6 [S] Gear tiers** (iron→steel→shard-forged) in later-town smiths.

## EPIC 6 — Content: monsters, quests, NPCs → `design/LORE.md`
Fills the world. Mostly unblocked; authoring against the lore bible.

- **6.1 [S] Bear** (deep-forest monster). Old ticket 3 — ENEMY_TYPES + billboard
  + append spawn.
- **6.2 [M] Goblin shaman** (ranged caster enemy; needs projectileSpell 🔒2.0).
- **6.3 [S] Emberspawn + wisp** monster art/stats for later zones.
- **6.4 [M] Quest #2 "The Wolfmother's Den"** (Marta/Maren; lostblade pattern).
- **6.5 [M] Guildmaster NPCs** (one per school, personalities per LORE.md). 🔒5.4
- **6.6 [S] Inject LORE_COMMON** into every villager system prompt; give
  existing NPCs faction-aware facts. LORE.md.

## EPIC 7 — Polish (all unblocked, all S)
- **7.1** Damage variance & crits (8% ×2, one shared helper).
- **7.2** WebAudio synth SFX (steps/casts/hits, no asset files; mute on 'U', save it).
- **7.3** Hit flinch on billboards (scale-pop + red tint + shake).
- **7.4** Enemy death fade-and-sink (0.6s).
- **7.5** Item tooltips (parchment, follows pointer).
- **7.6** Potion hotkeys (5/6) + counts on HUD.
- **7.7** Minimap quest-target ping (pulsing star).
- **7.8** Drag-and-drop inventory.

---

## Suggested global order
EPIC 1 (faces — immediate wow) → 2.0 (unblocks spells + spellcraft) → 2.x spells
→ 3 (spellcraft, the showpiece) → 5.1 skill ranks → 4 (zones, the big lift) →
5.4+ towns → 6 content → 7 polish throughout. Pick by appetite; respect 🔒.

## Done
Engine swap to three.js terrain · schools of magic + scrolls + buffs · FX system ·
spell visuals · save/load (seeded, v2) · shop · quests #1 · MM7 UI · LLM villagers ·
Fly/Water Walk · roofed village · Eastmarch camp · asset pipeline + dialogue
portrait slot (this session).
