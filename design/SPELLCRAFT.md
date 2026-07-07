# Spellcraft — inventing spells by talking (the LLM feature)

The reason this is an LLM game: you describe a spell you *wish* existed, and an
NPC weaves it into something real and castable. This is the marquee system.

## Fiction

**Xarthax the Spellwright** — shard-mad researcher, banned from three guilds,
theatrical, delighted by novelty. He visits the Silver Stoat and (later) lives
in the Shardfields. Talking to him opens the Spellcraft dialogue instead of
normal chat.

## The loop

1. Player tells Xarthax what they want ("a spell that turns my blood to fire and
   throws it," "something to make the wolves fight each other," "I want to fall
   upward").
2. The LLM, given a strict JSON tool-schema + the primitives catalog below,
   returns a spell **spec**: `{name, school, tier, cost, desc, fx:{type,color,r},
   effects:[...]}` where each effect is a known primitive with params.
3. Client **validates** the spec against the schema and a power budget (cost must
   match the effects' weighted sum ±20%; reject/renegotiate if Xarthax tries to
   mint a nuke for 2 mp — in fiction he says "ah, the weave won't hold that cheap").
4. On accept, the spec is added to `GameData.craftedSpells` and to `SPELLS` at
   runtime; a scroll is created; the chosen hero can learn it. Save persists
   `craftedSpells` and re-registers them on load.

## Primitive catalog (the LLM may only compose THESE)

The safety of the whole feature is that the model picks + parameterizes
primitives; it never writes code. Each maps to an existing/near-existing effect:

| Primitive | Params | Cost weight |
|---|---|---|
| `damage` | amount, radius(0=single), trueDmg? | amount×(radius?1.5:1) |
| `dot` | perSec, secs, tag(burn/poison) | perSec×secs×0.7 |
| `heal` | amount, party? | amount×(party?1.3:1) |
| `buff` | stat(atk/def/haste/dodge/reflect), secs, party? | tuned table |
| `debuff` | stat(atk/def/speed), secs | tuned table |
| `control` | kind(root/slow/sleep/knockback/charm), secs, radius | tuned table |
| `move` | kind(blink/fly/waterwalk/recall), amount | tuned table |
| `summon` | type, secs | 6 + secs×0.2 |
| `drain` | amount (dmg→caster hp) | amount×1.4 |
| `cost_hp` | amount (NEGATIVE cost — pay hp to discount mp) | −amount×0.5 |

`fx` is cosmetic and free: pick `type` (bolt/beam/nova/self) + hex color + radius.

## Guardrails

- Hard cap: total weighted cost ≤ 40 (Armageddon territory); tier inferred from cost.
- Max 3 primitives per spell (keeps them legible and balanced).
- School inferred from dominant primitive or player's framing; gates who can learn it.
- No primitive outside the catalog → Xarthax refuses in character and asks the
  player to rephrase ("I cannot weave what has no thread").
- Name/desc profanity + length filter; desc ≤ 90 chars.
- The validator is client-side and authoritative. The LLM is a *suggestion engine*;
  the client decides what becomes real. Never `eval` model output.

## Why primitives instead of freeform code

Freeform "LLM writes the effect" is unshippable (unsafe, unbalanced, unsaveable).
Primitive-composition gives 90% of the creative feel — players genuinely invent
combos the designers never listed — with 0% of the risk, and every crafted spell
is automatically balanced, saveable, and visually complete.

## Build order (tickets in BACKLOG)

1. Spec schema + validator + power-budget table (pure module, unit-testable).
2. Primitive→runtime executor (reuse castSkill effects; this is the shared
   `applyEffects(spec, ctx)` that hand-authored spells could also migrate to).
3. `craftedSpells` in save; runtime `SPELLS` registration on load.
4. Xarthax NPC + Spellcraft dialogue mode (LLM tool-call → spec → validate → learn).
5. Offline fallback: no LLM → a hand-authored "recipe picker" UI over the same
   primitives, so the feature works without Ollama.
