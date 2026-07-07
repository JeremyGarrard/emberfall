# Progression — towns, guilds, spell shops, training, upgrades

How the party grows beyond "kill things, get XP." Ties to the economy so gold
finally matters at every stage.

## Towns (theme:'town' zones, see design/WORLD.md)

Each act has a hub town with:
- **Guild halls** — one or more of the 9 schools. Learn/train that school here.
- **Spell shop** — buy scrolls for the schools taught in this town (not all
  towns sell all schools; forces travel + choices).
- **Trainer** — pay gold + gate on level to raise stats / unlock spell tiers.
- **Inn** — rest (full heal, save point, "travel" menu), rumor board (quests).
- **Smith/Merchant** — better gear tiers than village peddlers.

Planned towns: **Oakhearth** (Act 1, near Pinereach — Body/Earth/Air guilds),
**Millrook** (Act 2, Greymire edge — Water/Mind/Dark), **Highspire** (Act 3,
Kaethrum approach — Fire/Light/Spirit + the Wardens' seat).

## The full spell economy

- **Novice** spells: cheap scrolls, sold in many shops, learnable by anyone with
  the school. (Odo-tier.)
- **Adept**: sold only in that school's guild town; require **guild standing**
  (a rep counter raised by guild quests) OR a steep price.
- **Master**: not sold. Earned — guild questlines, boss drops, hidden in zones,
  or **crafted via Xarthax** (design/SPELLCRAFT.md). This is the chase.

`ITEM_TYPES` scroll auto-gen already exists; add `tier` gating to shop stock and
a `guildStanding` map on GameData.

## Training & upgrades (the "how do we upgrade" answer)

Two axes, MM7-flavored:

### 1. Level (automatic, from XP) — already exists
Raises maxHP/maxMP/atk/def on the current curve. Keep.

### 2. Skill ranks (new — the depth)
Each hero has a **skill level per school they can use**
(`hero.skillRank[school]`, 0–3 = Untrained/Novice/Adept/Master). Rank does two
things:
- **Gates spell tiers**: can't learn/cast Adept spells in a school below Adept rank.
- **Scales power**: spell effect magnitude ×(1 + 0.25×rank). One multiplier at the
  cast site, applied to the primitive amounts — not a per-spell fork.

Raise a rank at that school's **guild trainer**: pay gold (rising: 100/400/1000)
+ meet a level gate (4/8/12) + sometimes a guild quest for Master. This is the
gold sink and the reason to return to towns.

### 3. Weapon/armor tiers — extend existing gear
Add tiers (iron→steel→shard-forged) to ITEM_TYPES with matching prices; smiths
in later towns stock higher tiers. Straightforward.

## Data shape additions
```js
hero.skillRank = { fire:0, air:0, ... }   // only schools in HERO_SCHOOLS[name]
GameData.guildStanding = { fire:0, ... }  // rep per school
GameData.trained = true/false gates in shop/trainer UIs
```
Save v3 carries these.

## UI (tickets)
- Trainer panel (reuse panel_ui chrome): school rows, current rank, cost, [Train] button.
- Spell shop already exists — add tier filter + standing gate + "requires Adept
  rank" refusal toasts.
- Character sheet panel (C key): per-hero level, XP bar, skill ranks, equipped
  gear, resistances (future). The "see your build" screen.

## Build order (tickets)
1. `hero.skillRank` + rank multiplier at cast site + tier gating on learn/cast.
2. Guild trainer NPC + training panel + gold sink.
3. Character sheet (C).
4. Town zones + guild halls (needs design/WORLD.md zones first).
5. Guild standing + guild questlines (Master-tier chase).
