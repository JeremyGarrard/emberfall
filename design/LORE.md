# Emberfall — lore bible

Canon for all content: quests, villager LLM prompts, zone themes, item flavor.
Keep new content consistent with this. The common paragraph at the bottom is
injected into every NPC's system prompt.

## The world

The realm is **Averron**. Three centuries ago its heartland was **Kaethrum**, an
empire ruled through its Court of Wizards. When a star fell burning into the
Kaethrine mountains, the Court tried to bind it — to yoke a piece of heaven and
rule forever. The binding broke on the **Night of Cinders**: Kaethrum's capital
burned in a night, the Court scattered or worse, and the star — the **Ember** —
shattered across the frontier provinces.

Where **ember-shards** fell, magic pools like groundwater. Wild magic condenses
into living things (**emberspawn**: slimes are raw condensate; older shards
breed worse). Beasts that den near shards grow large and cunning (dire wolves,
the great bears of the deep woods). Goblin clans — the **Ashmarks** — were
ordinary hill-folk once; generations of living on shard-ground twisted them,
and they hoard shards they cannot use.

But shard-ground is also why *people* stay: magic learned near a shard sticks.
Scrolls scribed there hold. Fountains fed by shard-springs knit wounds closed
— that is what the fountain on Emberfall's green is, and why the village
exists at all.

## Factions

- **The Emberwardens** — a thin order of scholars and wardens who keep the
  frontier villages alive. Elder Maren is Emberfall's warden. They pay for
  monster culls, map shard-falls, and quietly make sure nobody rebuilds what
  the Court built. The party works for them.
- **The Guilds** — eight schools of magic, each holding shard-fragments and
  teaching their school for coin and oaths. Guild halls anchor the bigger
  towns. (Mechanics: spell shops + training, see design/PROGRESSION.md.)
- **The Ashen Court** — remnants and heirs of Kaethrum's wizards. They believe
  the binding failed only because it was interrupted, and they are collecting
  shards to try again. Campaign villains. Polite, learned, monstrous.
- **The Ashmark clans** — goblin bands; raiders and shard-scavengers. Cunning,
  not evil; some clans trade. (Bram's blade was an Ashmark raid.)

## The party

Four wardens-for-hire, summoned to Emberfall by Maren's letter: *"The wolves
come closer each winter, and something worse walks behind them."*
Roderick (a soldier who outlived his war), Wren (an Ashmark-border scout),
Serena (a fountain-priest of the Body guild), Malwick (expelled from the Fire
guild for "irresponsible curiosity" — he maintains it was responsible).

## Campaign arc & zones (see design/WORLD.md for mechanics)

| Act | Zone | Levels | Theme | Story beat |
|---|---|---|---|---|
| 1 | **Embervale** (current map) | 1–5 | pastoral frontier | Prove yourselves; the wolves are being *driven* west |
| 1 | **Pinereach** | 4–8 | deep pine forest, hunting lodges | Ashmark clans displaced by something; first Ashen Court agent |
| 2 | **Greymire** | 7–11 | marsh, drowned village, will-o-wisps | A shard sunk in the mire; the Court is dredging |
| 2 | **The Shardfields** | 10–14 | crystal wastes, wild magic storms | Xarthax's tower; magic misbehaves gloriously |
| 3 | **Kaethrum Ruins** | 13–17 | burned imperial city, undead | The old capital; what the Night of Cinders left |
| 3 | **The Cinder Court** | 16–20 | the crater, the Ember's heart | Stop the second binding |

## Key NPCs (present and planned)

- **Elder Maren** — Emberwarden of Emberfall. Knows more than she says about
  the Night of Cinders.
- **Bram** — smith; ex-Ashmark-fighter; his masterwork blade is shard-forged
  (that's why the goblins took it).
- **Odo** — peddler with guild contacts in every town; sells scrolls he
  probably shouldn't have.
- **Hilda** — tavern-keeper; the Stoat's gossip network outperforms the
  Wardens' scouts.
- **Marta** — wolf-hunter at Eastmarch; first to say aloud that the packs are
  running *from* something.
- **Xarthax the Spellwright** *(planned — design/SPELLCRAFT.md)* — a
  shard-mad researcher who weaves new spells from described ideas. Brilliant,
  theatrical, banned from three guilds. Visits Emberfall's tavern monthly;
  lives in the Shardfields.
- **Guildmasters** *(planned)* — one per school, personalities matching their
  school (the Earth master is patient and literal; the Dark master is
  scrupulously honest, which is worse).

## LLM prompt integration

`LORE_COMMON` (inject into every villager system prompt, ~60 words): *"The
world is Averron. Three hundred years ago the Ember — a fallen star — shattered
across the frontier on the Night of Cinders, ending the empire of Kaethrum.
Ember-shards breed monsters and feed magic; the Emberwardens keep the villages;
the guilds teach magic for coin; the Ashen Court gathers shards in secret to
try the binding again."*

Per-NPC `locale` strings say where they are; per-NPC `persona` stays personal.
NPCs know local + faction-appropriate lore only — villagers have rumors of the
Court, not facts.
