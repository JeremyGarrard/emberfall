# World structure — multiple maps + a world map

Today everything is one 96x72 map. To reach the campaign in design/LORE.md we
need **separate zone maps** and a **world map** to travel between them. This is
the biggest architectural change on the board; do it before adding lots of zones.

## Target architecture

### Zones, not "the map"
Generalize the single implicit map into a `ZONES` registry:

```js
ZONES = {
  embervale: { name, seed, size:[96,72], theme:'pasture', settlements:[...],
               enemyTable, exits:[{edge:'east', to:'pinereach', at:[x,y]}],
               spawnPoint, worldPos:[wx,wy] },
  pinereach: { ... },
  ...
}
```

- `GameData.zone` = current zone id. `GameData.zoneState[zoneId]` holds that
  zone's `gone` list + any zone-local flags (so each zone remembers its dead/looted).
- `buildMap`/`buildEntities`/`buildHeights` take a zone descriptor instead of
  reading globals. Theme drives palette, enemy table, prop set, terrain params.
- **Transition**: walk into an `exit` tile → fade → `scene.restart({zone, entry})`.
  WorldScene already rebuilds from scratch cleanly; make it re-entrant on a zone arg.

### Save format v3
`{v:3, party, gold, inventory, craftedSpells, zone, zoneState:{[id]:{gone, seed, flags}}, worldPos}`.
Seed per-zone so each regrows independently. Migrate v2 → v3 (wrap current world
as `zoneState.embervale`). **Remember the CLAUDE.md rule: this changes spawn/save
shape — bump version + migrate.**

### The world map
A separate lightweight scene (`WorldMapScene`, could even be 2D Phaser, no 3D):
- Painted parchment map of Averron with the 6 zones as nodes on roads/rivers.
- Nodes unlock as the story opens them (`GameData.unlockedZones`).
- Click an unlocked node → travel (fade → WorldScene with that zone).
- Party token + fog-of-war over unvisited regions.
- Reached by walking to a zone's edge exit, or a "travel" option resting at a town.
- Random road encounters (optional later): small combat arena zone.

### Town zones vs wild zones
Towns (design/PROGRESSION.md) are small dense zones: guild halls, spell shops,
trainers, inns, no wandering monsters. Wild zones are the current style.
Same ZONES system; `theme:'town'` skips monster spawns and enables shop props.

## Zone themes (palette + mechanics per LORE act table)

| Theme | Palette | Terrain | Enemies | Hazard |
|---|---|---|---|---|
| pasture (Embervale) | green/blue, sunny | rolling hills, river | slime/goblin/wolf | none |
| forest (Pinereach) | deep green, dim | dense pines, ravines | wolf/bear/goblin-shaman | low visibility |
| marsh (Greymire) | brown/grey/sickly | flat, water everywhere | wisps/drowned/frogfolk | poison water, need Water Walk |
| crystal (Shardfields) | violet/cyan, storms | jagged shard spires | emberspawn/constructs | wild-magic zones (random spell procs) |
| ruins (Kaethrum) | ash/black/ember | broken streets, rubble walls | undead/wraiths | darkness (need Light) |
| crater (Cinder Court) | red/gold, heat-haze | the Ember crater | Ashen Court + boss | the second binding timer |

## Build order (tickets)
1. Extract ZONES registry; make WorldScene take a zone descriptor; wrap current
   world as `embervale`. No behavior change — pure refactor. (Biggest ticket; **M+**.)
2. Save v3 + per-zone zoneState + migration.
3. Edge-exit transitions between two zones (embervale ↔ pinereach stub).
4. Author Pinereach (forest theme, reuse tickets from monster/quest backlog).
5. WorldMapScene + node travel + unlocks.
6. Town-theme zones (feeds design/PROGRESSION.md).
