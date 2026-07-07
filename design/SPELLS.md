# Spell compendium — 9 schools, 72 spells

Design + implementation spec. Existing spells marked ✓. Tiers: **N**ovice /
**A**dept / **M**aster (ties into training + guild access, design/PROGRESSION.md).
Every new spell = `SPELLS` entry (school/name/cost/desc/icon/fx/tier) + icon
painter + `castSkill` case, per ARCHITECTURE.md. Scrolls auto-generate.

**New shared mechanics** some spells need (build once, reuse — each is a ticket):
- `summon(type, ttl)` — ally entity (kind `ally`): chases nearest enemy, melees,
  despawns on ttl/death. AI mirrors enemy chase with target=enemy.
- `wallSpell(tiles, type, ttl)` — temp map-tile override + R3D mesh, restores after ttl.
  (Track in a `tempTiles` list; save-safe = don't persist.)
- `charm(e, ttl)` — enemy fights enemies: `e.side='party'` branch in AI loop.
- `sleep(e, ttl)` — root + no attacks; any damage wakes it.
- `projectileSpell` — FX.bolt with a real travel-time damage callback (dodgeable).
- `blink(dx)` — teleport player along facing if destination `canStand`.
- `channel` — hold-to-recast pattern: key held → recast every 400ms at reduced cost.
- `aura(totemEntity)` — stationary decor entity applying an effect in radius per tick.

## Fire — damage, burning, area denial
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Fire Bolt ✓ | 3 | 6+2L dmg + burn 4s | done |
| N | Ember Spray | 5 | cone: 3 bolts in a 30° fan, 4+L each | 3× projectile at angle offsets |
| A | Fireball ✓ | 6 | aoe 2 on target | done |
| A | Ring of Fire ✓ | 9 | nova 4 + burn | done |
| A | Wall of Flame | 10 | 3 wall tiles across facing, 8s; enemies crossing burn 6/s | `wallSpell` + touch check |
| M | Immolation | 12 | self-aura 10s: enemies within 2.5 burn 5/s | aura on player pos per tick |
| M | Meteor Swarm | 18 | channel: 1 meteor/0.4s on target area while held | `channel` + armageddon meteor fx |
| M | Phoenix Heart | 20 | 60s buff: first hero death auto-revives at 50% | flag consumed on death check |

## Air — speed, lightning, mobility
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Spark ✓ | 4 | chain to 2 | done |
| N | Gust | 3 | knockback one target 3, no dmg | knockback, cheap |
| A | Thunderclap ✓ | 8 | nova knockback+daze | done |
| A | Haste | 8 | party haste ×0.6, 20s | buffs.hasteUntil (exists via Hour) |
| A | Blink | 7 | teleport 6 tiles along facing | `blink` |
| M | Fly ✓ | 10 | flight | done |
| M | Chain Storm | 14 | chain to EVERY enemy within 4 of last hit, 70% falloff | recursive chain, cap 8 |
| M | Eye of the Storm | 16 | 8s: enemies within 5 slowed + struck by a bolt/s | aura + FX bolts |

## Water — control, ice, passage
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Ice Bolt ✓ | 4 | dmg + slow | done |
| N | Cleansing Rain | 5 | party: clear sinking, +4 hp, douse burns (future enemy-burn on party) | simple |
| A | Frost Nova ✓ | 7 | nova slow | done |
| A | Water Walk ✓ | 8 | tread water | done |
| A | Ice Lance | 9 | pierce: hits ALL enemies on a line, 8+2L | line sample + beam fx |
| M | Flash Freeze | 13 | target frozen solid 4s (root + no attack + +50% dmg taken) | sleep variant w/ dmg-amp flag |
| M | Tidal Wave | 16 | wide cone 6: 10+2L + knockback + slow | cone helper |
| M | Blizzard | 18 | channel: nova 5 slow + 4 dmg per pulse | `channel` |

## Earth — defense, terrain, weight
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Rock Blast ✓ | 5 | dmg + knockback | done |
| N | Tremor | 5 | nova 3: 3+L dmg, brief stagger (nextAtk +1s) | cheap nova |
| A | Stone Skin ✓ | 6 | +3 def | done |
| A | Grasping Roots ✓ | 8 | root nova | done |
| A | Bulwark | 11 | raise a 3-tile stone wall across facing, 12s | `wallSpell` (T_ROCK-like, h 1.2) |
| M | Earthspike Field | 14 | 10 random spikes in 6-radius over 3s, 9+2L each | timed FX+dmg at points |
| M | Golem | 18 | summon stone golem 30s (hp 80, atk 12) | `summon` |
| M | Mountain's Patience | 16 | party +5 def, immune knockback/slow, but −30% speed, 20s | buff flags |

## Body — vitality, restoration
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Heal ✓ | 5 | single heal | done |
| N | Stimulant | 4 | one hero: recovery instantly ready + haste 5s | set readyAt=0 |
| A | Regeneration ✓ | 7 | party HoT | done |
| A | Great Heal ✓ | 11 | party heal | done |
| A | Iron Constitution | 9 | one hero +15 temp maxHp 30s | temp maxHp field, clamp on expiry |
| M | Martyr's Gift | 12 | transfer up to half caster's hp to most wounded ×1.5 | simple math |
| M | Second Wind | 15 | party: heal 10 + all recoveries reset + mp +5 | burst utility |
| M | Deathless | 22 | 15s: party hp can't drop below 1 | damage-floor flag (epic; long cooldown via cost) |

## Spirit — soul, blessing, the dead
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Bless ✓ | 5 | +2 atk | done |
| N | Spirit Lash ✓ | 6 | true dmg | done |
| A | Ghost Blades | 9 | 15s: party basic attacks +3 true dmg | buff flag read in partyAttack |
| A | Ancestor's Watch | 10 | totem 20s: enemies within 4 slowed, party within 4 +1 atk | `aura` totem |
| M | Raise Dead ✓ | 12 | revive 35% | done |
| M | Spirit Twin | 15 | summon a mirror of the caster (ranged true-dmg bolts) 20s | `summon` variant |
| M | Séance | 14 | ask the dead: reveals all chests+quest targets on minimap 30s | minimap ping layer |
| M | Soul Cage | 20 | target enemy dies → next Raise Dead is free & full-hp | kill-tag flag |

## Mind — the 9th school (new): confusion, knowledge, will
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Daze | 4 | target nextAtk +4s | trivial |
| N | Foresight | 5 | 20s: party +10% dodge (enemies deal 0 on roll) | dodge roll in enemyStrike |
| A | Sleep | 8 | nova 4: sleep 6s (damage wakes) | `sleep` |
| A | Charm Beast | 10 | one beast (slime/wolf/bear) fights for you 15s | `charm` |
| A | Mind Spike | 8 | 9+2L true dmg, +50% vs full-hp targets | conditional dmg |
| M | Mass Hysteria | 16 | enemies within 5 attack EACH OTHER 8s | charm-all variant |
| M | Dominate | 18 | charm any non-boss enemy 25s | `charm` |
| M | Astral Recall | 12 | teleport party to the last fountain touched | store recall point; fade+move |

## Light — radiance, judgment, protection
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Sunray ✓ | 7 | big single + dazzle | done |
| N | Lantern | 3 | 60s glowing orb follows party (night utility) | decor follower + PointLight |
| A | Prismatic Light ✓ | 10 | sight aoe + party heal | done |
| A | Aegis | 10 | 12s: reflect 30% of melee dmg taken | reflect flag in enemyStrike |
| M | Hour of Power ✓ | 12 | tri-buff | done |
| M | Consecrate | 14 | ground circle 5, 12s: party regen + enemies burn holy 4/s | `aura` zone |
| M | Judgment | 20 | target takes dmg = its missing hp ×0.5 (execute) | math |
| M | Dawn | 24 | (with day/night) force dawn; all undead within 10 take 40 | worldTime set |

## Dark — price-magic: power that costs
| Tier | Spell | Cost | Effect | Impl note |
|---|---|---|---|---|
| N | Vampiric Drain ✓ | 6 | drain | done |
| N | Hex | 5 | target −2 def 10s | enemy def debuff field |
| A | Curse ✓ | 7 | atk halved + slow | done |
| A | Blood Ritual | 0 | caster pays 10 hp → +14 mp | hp→mp |
| A | Shadowstep | 9 | blink BEHIND target + next attack +8 dmg | `blink` variant + tag |
| M | Enslave Dying | 13 | enemies below 30% hp within 5 become yours permanently* (*until zone change) | `charm` conditional |
| M | Plague | 16 | infect target: 4/s DoT that JUMPS to nearest enemy on death | dot + on-death hop |
| M | Armageddon ✓ | 30 | everything burns | done |

## Balance rails
- Damage-per-mp stays within ±30% of same-tier peers; utility justifies outliers.
- True damage always costs ≥1.5× equivalent normal damage.
- Charm/summon count cap: 2 allied entities at once.
- New status flags (dodge, reflect, dmg-floor, temp maxHp) each get ONE helper
  respected by ALL damage paths — never fork the damage formula per spell.
