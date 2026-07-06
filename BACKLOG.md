# Backlog — self-contained tickets

Each ticket is scoped to be done in isolation by any capable model. Read `CLAUDE.md`
and `ARCHITECTURE.md` first. Rules for every ticket: verify in the running game
(frame-pump + capture per CLAUDE.md), keep gen deterministic, commit with a clear
message when done. Sizes: S ≈ one sitting, M ≈ a focused session.

## Art & world

1. **[M] Second settlement: Eastmarch camp.** Generalize `VILLAGE`/`inVillage` into
   `SETTLEMENTS = [{layout, x1, y1, safe}]` (loop in `inVillage`, hills/forest/spawn
   exclusions, sanctuary). Then author a small palisade camp (~9x8 layout) at the east
   road's end (~x 78–86, y 32–40) with a campfire prop (new painter + flickering decor
   sprite), 2 tents (new wall type or props), and one villager ("Marta, wolf-hunter",
   specialty: wolf locations). Acceptance: monsters can't enter the camp; Marta talks
   via LLM; both settlements flatten terrain (extend `buildHeights` village-shelf loop).
2. **[S] Tile-type terrain detail.** The 3D terrain multiplies one noise texture over
   vertex colors. Upgrade: 2x2 atlas canvas (grass/dirt/cobble/water-bed detail), pick
   UV quadrant per tile in `buildTerrain`. Watch seams at tile borders (inset UVs 1px).
3. **[S] More monster art + one new monster.** Add `ENEMY_TYPES.bear` (hp 60, atk 12,
   def 3, speed 2.2, cd 1400, xp 40, gold 12–24), 64px billboard painter, spawn block
   APPENDED after wolves (uid rule!), deep-forest placement (near forest region centers).
4. **[S] Weather: rain.** ~200 FX-style streak sprites cycling above the camera when
   `weather==='rain'`, 60s on / 90s off timers, sky dimmed via a scene fog color lerp.
5. **[M] Day/night cycle.** `worldTime` advancing; sun light + fog + sky material color
   lerp through dawn/day/dusk/night palettes; lampposts get PointLights at night
   (cap at ~6 lights). Monsters get +1 atk at night. Save `worldTime`.

## Systems

6. **[M] Ranged enemy: goblin shaman.** New enemy that stops at ~6 tiles and casts
   firebolts (use `FX.bolt` toward the party + `enemyStrike`-style damage on arrival
   timer). Green-robed billboard. Spawns in goblin bands (append spawn block).
7. **[S] Item tooltips.** Hover on inventory/shop/spellbook cards shows a parchment
   tooltip (Phaser container following pointer) with name/stats/desc/price.
8. **[M] Drag-and-drop inventory.** Replace click-to-equip with Phaser drag events;
   drag onto hero card = equip, onto grid cell = move, outside panel = drop toast
   (no world item entities yet — refuse with a toast).
9. **[S] Potion hotkeys.** Keys 5/6 quaff the first hp/mp potion in the pack on the
   most wounded / lowest-mana living hero. Show counts on the HUD next to gold.
10. **[M] Quest #2: "The Wolfmother's Den".** Marta (ticket 1) or Maren offers: slay
    the Bear (ticket 3) or 4 wolves in the NE hills; reward `scroll_roots` + 150g.
    Follow the lostblade pattern exactly (states, offer button, tracker, LLM facts).
11. **[S] Minimap ping + quest markers.** Gold star on the minimap for the active
    quest target (sword camp / den), pulsing via sine alpha.

## Polish

12. **[S] Damage variance & crits.** 8% crit (×2, bigger floater, camera punch).
    One helper used by all damage sites — don't fork formulas.
13. **[S] Footstep/spell/hit sound.** WebAudio beeps-and-noise synth (no asset files):
    short filtered noise for steps (rate by speed), tone blips per school for casts.
    Master mute on 'M'? No — 'U' (M is map). Persist mute in the save.
14. **[S] Hit flinch on billboards.** Scale-pop + brief red tint (sprite material color
    lerp) when an enemy takes damage; shake the sprite for 120ms.
15. **[S] Better death.** Enemies fade + sink into the ground over 0.6s instead of
    vanishing (keep entity until anim done; exclude from targeting once hp≤0).

## Done (for context)

Engine swap to three.js terrain · schools of magic + scrolls + buffs · FX system ·
save/load (seeded) · shop · quest #1 · MM7 UI (inventory/spellbook/portraits) ·
LLM villagers · Fly/Water Walk · village with roofed buildings.
