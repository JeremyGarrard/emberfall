// Spellcraft: the effect-primitive system (design/SPELLCRAFT.md).
//
// Spells are SPECS — a shape plus up to a few primitive effects. Hand-authored
// spells in data.js and player-crafted spells from Xarthax run through the SAME
// executor (world.castFromSpec → applyEffects). The LLM only ever *suggests* a
// spec; validateSpellSpec is the client-side authority. Never eval model output.
//
//   shape:  target {range} | projectile {range} | nova {r} | line {len} |
//           self | totem {r, secs}
//   effect: damage {amount, true?} | dot {perSec, secs, hop?} | heal {amount, party?}
//           buff {stat: atk|def|haste|dodge|reflect|ghost|deathless, secs}
//           control {c: root|slow|sleep|daze|charm, secs} | knockback {amount}
//           summon {type: golem|wisp, secs} | drain {amount} | hex {amount, secs}
//           blink {dist, behind?} | wall {len, secs} | recall | execute {factor}
//           mpgain {amount, hpcost} | spikes {count, amount, r}

const CRAFT_LIMITS = { maxEffects: 3, maxCost: 40, maxNameLen: 24, maxDescLen: 90 };

// power weights → mp cost (calibrated so Fireball ≈ 6, Heal ≈ 5)
function specWeight(spec) {
  const shapeMul = { nova: 1.6, line: 1.5, target: 1.0, projectile: 0.9, self: 1.0, totem: 1.2 }[spec.shape] || 1;
  let w = 0;
  for (const e of spec.effects || []) {
    switch (e.kind) {
      case 'damage': w += (e.amount || 0) * shapeMul * (e.true ? 1.6 : 1); break;
      case 'dot': w += (e.perSec || 0) * (e.secs || 0) * 0.7 * (e.hop ? 1.3 : 1); break;
      case 'heal': w += (e.amount || 0) * (e.party ? 1.4 : 0.9); break;
      case 'buff': w += ({ atk: 12, def: 12, haste: 14, dodge: 12, reflect: 12, ghost: 14, deathless: 26 }[e.stat] || 12) * (e.secs || 10) / 15; break;
      case 'control': w += ({ root: 2.2, slow: 1.2, sleep: 2.6, daze: 1.2, charm: 3.5 }[e.c] || 2) * (e.secs || 0) * (spec.shape === 'nova' ? 1.5 : 1); break;
      case 'knockback': w += (e.amount || 0) * 1.2; break;
      case 'summon': w += 8 + (e.secs || 0) * 0.25; break;
      case 'drain': w += (e.amount || 0) * 1.5; break;
      case 'hex': w += (e.amount || 0) * 1.2 * (e.secs || 8) / 8; break;
      case 'blink': w += 5 + (e.behind ? 3 : 0); break;
      case 'wall': w += (e.len || 0) * 2 + (e.secs || 0) * 0.3; break;
      case 'recall': w += 8; break;
      case 'execute': w += (e.factor || 0) * 28; break;
      case 'mpgain': w += Math.max(0, (e.amount || 0) - (e.hpcost || 0) * 0.8); break;
      case 'spikes': w += (e.count || 0) * (e.amount || 0) * 0.5; break;
      default: return NaN; // unknown primitive → invalid
    }
  }
  return w;
}

const CRAFT_KINDS = ['damage', 'dot', 'heal', 'buff', 'control', 'knockback', 'summon',
  'drain', 'hex', 'blink', 'wall', 'recall', 'execute', 'mpgain', 'spikes'];
const CRAFT_SHAPES = ['target', 'projectile', 'nova', 'line', 'self', 'totem'];

// small local models fumble the exact enums — normalize common variants before
// judging, so a good idea isn't rejected over capitalization or a synonym
const SCHOOL_ALIAS = {
  frost: 'water', ice: 'water', cold: 'water', ocean: 'water', storm: 'air',
  lightning: 'air', electric: 'air', wind: 'air', thunder: 'air', flame: 'fire',
  burn: 'fire', heat: 'fire', stone: 'earth', rock: 'earth', nature: 'earth',
  holy: 'light', radiant: 'light', sun: 'light', shadow: 'dark', death: 'dark',
  necromancy: 'dark', blood: 'dark', psychic: 'mind', psionic: 'mind',
  mental: 'mind', heal: 'body', healing: 'body', life: 'body', nature_body: 'body',
  soul: 'spirit', divine: 'spirit',
};
const SHAPE_ALIAS = {
  single: 'target', bolt: 'projectile', missile: 'projectile', ranged: 'projectile',
  area: 'nova', aoe: 'nova', burst: 'nova', ring: 'nova', beam: 'line', ray: 'line',
  pierce: 'line', buff: 'self', aura: 'totem', ground: 'totem',
};
const KIND_ALIAS = {
  dmg: 'damage', harm: 'damage', hurt: 'damage', burn: 'dot', poison: 'dot',
  bleed: 'dot', restore: 'heal', mend: 'heal', shield: 'buff', bless: 'buff',
  weaken: 'debuff', debuff: 'hex', slow: 'control', stun: 'control', root: 'control',
  freeze: 'control', sleep: 'control', charm: 'control', fear: 'control',
  push: 'knockback', repel: 'knockback', conjure: 'summon', lifesteal: 'drain',
  siphon: 'drain', teleport: 'blink', barrier: 'wall', mana: 'mpgain',
};
function normSpec(spec) {
  if (!spec || typeof spec !== 'object') return;
  const low = s => (typeof s === 'string' ? s.trim().toLowerCase() : s);
  spec.school = SCHOOL_ALIAS[low(spec.school)] || low(spec.school);
  spec.shape = SHAPE_ALIAS[low(spec.shape)] || low(spec.shape);
  for (const e of Array.isArray(spec.effects) ? spec.effects : []) {
    if (!e || typeof e !== 'object') continue;
    // some models nest the kind under "type" or fold a control name into kind
    if (!e.kind && e.type) e.kind = e.type;
    const k = low(e.kind);
    if (['root', 'slow', 'sleep', 'daze', 'charm', 'freeze', 'stun', 'fear'].includes(k)) {
      e.c = e.c || (k === 'freeze' ? 'sleep' : k === 'stun' ? 'daze' : k === 'fear' ? 'charm' : k);
      e.kind = 'control';
    } else {
      e.kind = KIND_ALIAS[k] || k;
    }
    if (e.c) e.c = low(e.c) === 'stun' ? 'daze' : low(e.c) === 'freeze' ? 'sleep' : low(e.c);
  }
}

function validateSpellSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return { ok: false, errors: ['no spec'] };
  normSpec(spec);
  if (typeof spec.name !== 'string' || !spec.name.trim()) spec.name = 'Woven Spell';
  if (spec.name.length > CRAFT_LIMITS.maxNameLen) spec.name = spec.name.slice(0, CRAFT_LIMITS.maxNameLen);
  if (!SCHOOLS[spec.school] || spec.school === 'martial') errors.push('unknown school');
  if (!CRAFT_SHAPES.includes(spec.shape)) spec.shape = 'target'; // forgiving default
  if (!Array.isArray(spec.effects) || !spec.effects.length) errors.push('needs 1-3 effects');
  if (spec.effects && spec.effects.length > CRAFT_LIMITS.maxEffects) spec.effects = spec.effects.slice(0, CRAFT_LIMITS.maxEffects);
  for (const e of spec.effects || []) {
    if (!CRAFT_KINDS.includes(e.kind)) errors.push('unknown primitive: ' + (e.kind || '?'));
  }
  // clamp raw numbers so a wild suggestion can't sneak scale in
  for (const e of spec.effects || []) {
    for (const k of ['amount', 'perSec', 'secs', 'count', 'dist', 'len', 'factor', 'hpcost']) {
      if (e[k] !== undefined) e[k] = Math.max(0, Math.min(60, Number(e[k]) || 0));
    }
  }
  if (spec.shape === 'nova' || spec.shape === 'totem') spec.r = Math.max(2, Math.min(7, Number(spec.r) || 4));
  if (spec.shape === 'target' || spec.shape === 'projectile') spec.range = Math.max(3, Math.min(11, Number(spec.range) || 8));
  if (spec.shape === 'line') spec.len = Math.max(3, Math.min(10, Number(spec.len) || 7));
  if (spec.shape === 'totem') spec.secs = Math.max(5, Math.min(30, Number(spec.secs) || 15));
  const w = specWeight(spec);
  if (isNaN(w)) errors.push('invalid effect parameters');
  const cost = Math.max(2, Math.min(CRAFT_LIMITS.maxCost, Math.round(w * 0.35)));
  if (w * 0.35 > CRAFT_LIMITS.maxCost) errors.push('the weave will not hold that much power');
  if (typeof spec.desc !== 'string') spec.desc = '';
  spec.desc = spec.desc.slice(0, CRAFT_LIMITS.maxDescLen);
  if (!spec.fx || !['bolt', 'beam', 'nova', 'self'].includes(spec.fx.type)) {
    spec.fx = { type: spec.shape === 'nova' ? 'nova' : spec.shape === 'self' ? 'self' : 'bolt', color: SCHOOLS[spec.school] ? SCHOOLS[spec.school].color : '#ffffff' };
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(spec.fx.color || '')) spec.fx.color = SCHOOLS[spec.school] ? SCHOOLS[spec.school].color : '#ffffff';
  if (spec.fx.type === 'nova') spec.fx.r = spec.r || 4;
  return { ok: errors.length === 0, errors, cost };
}

// ---------- the executor: one function runs EVERY spec spell ----------
// Returns {ok, msg} — msg is the refusal toast when not castable right now.
function applyEffects(scene, heroIdx, spec, target, time) {
  const h = GameData.party[heroIdx];
  const px = scene.px, py = scene.py;
  const tDist = target ? Math.hypot(target.x - px, target.y - py, scene.agl() - 0.5) : Infinity;

  // shape gathers victims (or validates the cast)
  let victims = [];
  switch (spec.shape) {
    case 'target':
    case 'projectile':
      if (!target || tDist > spec.range) return { ok: false, msg: 'No target in range!' };
      victims = [target];
      break;
    case 'nova':
      victims = scene.enemiesNear(px, py, spec.r);
      if (!victims.length && (spec.effects || []).some(e => ['damage', 'dot', 'control', 'knockback', 'drain', 'hex', 'execute'].includes(e.kind))) {
        return { ok: false, msg: 'No foes near enough!' };
      }
      break;
    case 'line': {
      const dx = Math.cos(scene.angle), dy = Math.sin(scene.angle);
      const hit = new Set();
      for (let d = 1; d <= spec.len; d += 0.5) {
        for (const e of scene.enemiesNear(px + dx * d, py + dy * d, 0.9)) hit.add(e);
      }
      victims = [...hit];
      if (!victims.length) return { ok: false, msg: 'Nothing in the line of the spell!' };
      break;
    }
    case 'self': victims = []; break;
    case 'totem': victims = []; break;
  }

  const run = () => {
    for (const e of spec.effects) scene.applyPrimitive(heroIdx, spec, e, victims, target, time);
    if (spec.shape === 'totem') scene.placeTotem(spec, time);
  };

  if (spec.shape === 'projectile' && target) {
    // a real missile: damage lands when (and where) it arrives
    const gz = scene.terrainH(target.x, target.y) + 0.5;
    FX.bolt(px + Math.cos(scene.angle) * 0.4, scene.camZ - 0.15, py + Math.sin(scene.angle) * 0.4,
      target.x, gz, target.y, spec.fx.color, {
        speed: 13,
        burst: 8,
      });
    const tx = target.x, ty = target.y;
    scene.time.delayedCall(Math.hypot(tx - px, ty - py) / 13 * 1000, () => {
      // hits whatever stands at the impact point now — projectiles are dodgeable
      const there = scene.enemiesNear(tx, ty, 1.1);
      victims = there.length ? [there[0]] : [];
      if (victims.length) run();
    });
    return { ok: true };
  }

  run();
  return { ok: true };
}

// ---------- Xarthax: turning talk into specs ----------

function craftSystemPrompt() {
  return `You translate a described spell idea into ONE JSON object and output ONLY that JSON, no prose, no markdown fences.
Schema: {"name":str<=24,"school":one of fire|air|water|earth|body|spirit|mind|light|dark,"desc":str<=90 (flavorful, medieval),"shape":one of target|projectile|nova|line|self|totem,"range":3-11 (target/projectile),"r":2-7 (nova/totem),"len":3-10 (line),"secs":5-30 (totem),"fx":{"type":bolt|beam|nova|self,"color":"#rrggbb"},"effects":[1 to 3 of:
 {"kind":"damage","amount":n,"true":bool?} {"kind":"dot","perSec":n,"secs":n} {"kind":"heal","amount":n,"party":bool?}
 {"kind":"buff","stat":atk|def|haste|dodge|reflect|ghost|deathless,"secs":n} {"kind":"control","c":root|slow|sleep|daze|charm,"secs":n}
 {"kind":"knockback","amount":n} {"kind":"summon","type":golem|wisp,"secs":n} {"kind":"drain","amount":n}
 {"kind":"hex","amount":n,"secs":n} {"kind":"blink","dist":n,"behind":bool?} {"kind":"wall","len":n,"secs":n}
 {"kind":"recall"} {"kind":"execute","factor":0.1-0.6} {"kind":"mpgain","amount":n,"hpcost":n} {"kind":"spikes","count":n,"amount":n,"r":n}]}
Keep power modest: single-target damage ~6-14, novas ~5-10, heals ~10-20, buffs/controls a few seconds. Map the IDEA faithfully onto these primitives; if the idea exceeds them, choose the closest combination. Output only the JSON object.`;
}

function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

// rune icon: every spec spell (crafted or data-authored) gets a consistent
// school-colored disc with a seeded rune — no hand-painting required
function makeRuneIcon(key, school, seedStr) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const color = (SCHOOLS[school] && SCHOOLS[school].color) || '#888888';
  g.fillStyle = color;
  g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.arc(16, 18, 11, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2;
  g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.stroke();
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  g.strokeStyle = '#f4f0e0'; g.lineWidth = 2.2; g.lineCap = 'round';
  let x = 10 + rnd() * 6, y = 9 + rnd() * 6;
  g.beginPath(); g.moveTo(x, y);
  for (let i = 0; i < 3 + (s % 2); i++) {
    x = Math.max(7, Math.min(25, x + (rnd() - 0.5) * 16));
    y = Math.max(7, Math.min(25, y + (rnd() - 0.35) * 14));
    g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#f4f0e0';
  g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
  ART[key] = c;
  return c;
}
