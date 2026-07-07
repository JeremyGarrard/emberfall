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

## EPIC 2 — More spells → `design/SPELLS.md`  ✅ LARGELY DONE
72 specced; **59 now exist**. Core mechanics + Mind school + ~30 new spells
shipped this session as **spec spells** (data-only, run by the executor).

- **2.0 ✅ Shared spell mechanics.** summon (ally AI), charm, sleep, wall
  (real 3D `R3D.addTempWall`), blink, totem/aura, projectile (dodgeable), +
  status helpers dodge/reflect/ghost/deathless/hex, plague on-death hop. All in
  `applyPrimitive`, respected by every damage path.
- **2.1–2.9 ✅ mostly done.** All 9 schools have their headline spells incl. the
  **Mind school** (Sleep, Charm Beast, Mass Hysteria, Mind Spike, Foresight,
  Astral Recall). Remaining nice-to-haves (Phoenix Heart, Chain Storm, Deathless,
  Soul Cage, Enslave Dying, Dawn) are optional polish — each is one spec entry now.

## EPIC 3 — Spellcraft: invent spells by talking → `design/SPELLCRAFT.md`  ✅ DONE
The marquee LLM feature — **working end-to-end with the local LLM.**

- **3.1 ✅ Spec schema + validator + power-budget** (`validateSpellSpec`, with
  synonym normalization so small local models don't fail on capitalization).
- **3.2 ✅ `applyEffects` executor** — the same one all spec spells use.
- **3.3 ✅ craftedSpells persistence** + re-registration/re-paint on load.
- **3.4 ✅ Xarthax NPC + weave flow.** Talk → "pull the golden thread" →
  LLM→spec→validate→learn→pay gold. Verified: wove & cast "Frostshard" live.
- **3.5 [S] Offline recipe-picker fallback** (same primitives, no LLM). Still open.
- **3.6 [S] Polish:** spellbook page slightly crowds long names behind the icon;
  bump text x. Xarthax could show the woven spec's stats before charging.

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

- **6.1 ✅ Cave Bear** — ENEMY_TYPES.bear (hp68/atk13), 64px shaded billboard,
  folded into the deep-wilderness spawn roll (seeded, no uid shift).
- **6.2 [M] Goblin shaman** (ranged caster enemy; needs projectileSpell 🔒2.0).
- **6.3 [S] Emberspawn + wisp** monster art/stats for later zones.
- **6.4 [M] Quest #2 "The Wolfmother's Den"** (Marta/Maren; lostblade pattern).
- **6.5 [M] Guildmaster NPCs** (one per school, personalities per LORE.md). 🔒5.4
- **6.6 [S] Inject LORE_COMMON** into every villager system prompt; give
  existing NPCs faction-aware facts. LORE.md.

## EPIC 7 — Polish
- **7.1** Damage variance & crits (8% ×2, one shared helper).
- **7.2** WebAudio synth SFX (steps/casts/hits, no asset files; mute on 'U', save it).
- **7.3 ✅** Hit flinch on billboards (scale-pop + red tint) — in `R3D.syncEntities`.
- **7.4 ✅** Enemy death fade-and-sink — `killEnemy` marks `kind:'dying'`, animates,
  removes after 680ms. Plus idle bob + attack lunge, same system.
- **7.5** Item tooltips (parchment, follows pointer).
- **7.6** Potion hotkeys (5/6) + counts on HUD.
- **7.7** Minimap quest-target ping (pulsing star).
- **7.8** Drag-and-drop inventory.
- **7.9** Monster art now 64px shaded (slime/goblin/wolf/bear) — apply the same
  painterly lift to props/chests/trees if desired.

---

## Suggested global order
EPIC 1 (faces — immediate wow) → 2.0 (unblocks spells + spellcraft) → 2.x spells
→ 3 (spellcraft, the showpiece) → 5.1 skill ranks → 4 (zones, the big lift) →
5.4+ towns → 6 content → 7 polish throughout. Pick by appetite; respect 🔒.

## Done
Engine swap to three.js terrain · schools of magic + scrolls + buffs · FX system ·
spell visuals · save/load (seeded, v2) · shop · quests #1 · MM7 UI · LLM villagers ·
Fly/Water Walk · roofed village · Eastmarch camp · asset pipeline + dialogue
portrait slot · **spec-spell system + 9-school 59-spell roster (Mind school) +
Spellcraft (invent spells by talking to Xarthax, LLM-woven & client-validated).**
