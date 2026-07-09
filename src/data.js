// Shared game state and definitions. Plain globals — no build step.

// ---- magic system: one registry, heroes know spells, keys 1-4 cast each
// hero's readied "quick" spell, B opens the spellbook to swap it ----
// ---- the schools of magic (MM7-style) ----
const SCHOOLS = {
  martial: { name: 'Martial',  color: '#b8b8c0' },
  fire:    { name: 'Fire',     color: '#e05020' },
  air:     { name: 'Air',      color: '#70c8f0' },
  water:   { name: 'Water',    color: '#3070d0' },
  earth:   { name: 'Earth',    color: '#9a7a30' },
  body:    { name: 'Body',     color: '#d05050' },
  spirit:  { name: 'Spirit',   color: '#c8c8e8' },
  mind:    { name: 'Mind',     color: '#e878b8' },
  light:   { name: 'Light',    color: '#f0d060' },
  dark:    { name: 'Dark',     color: '#9a50c8' },
};

// which hero can ever learn which school
const HERO_SCHOOLS = {
  Roderick: ['martial'],
  Wren:     ['martial', 'air', 'water'],
  Serena:   ['body', 'spirit', 'mind', 'light'],
  Malwick:  ['fire', 'air', 'water', 'earth', 'dark'],
};

const SPELLS = {
  // martial (not magic; can't be scribed)
  cleave:     { school: 'martial', name: 'Cleave',       cost: 3,  desc: 'Sweep all foes within reach', icon: 'ic_cleave', fx: { type: 'nova', color: '#d0d0d8', r: 2.4 } },
  doubleshot: { school: 'martial', name: 'Double Shot',  cost: 4,  desc: 'Two arrows at your target', icon: 'ic_dshot', fx: { type: 'bolt', color: '#e8d8a0' } },
  // fire
  firebolt:   { school: 'fire',   name: 'Fire Bolt',     cost: 3,  desc: 'Scorch a foe; it burns awhile', icon: 'ic_firebolt', fx: { type: 'bolt', color: '#ff8030' } },
  fireball:   { school: 'fire',   name: 'Fireball',      cost: 6,  desc: 'Explodes on your target', icon: 'ic_fire', fx: { type: 'bolt', color: '#ff6020' } },
  ringfire:   { school: 'fire',   name: 'Ring of Fire',  cost: 9,  desc: 'Ignite everything around the party', icon: 'ic_ringfire', fx: { type: 'nova', color: '#ff7020', r: 4 } },
  // air
  spark:      { school: 'air',    name: 'Spark',         cost: 4,  desc: 'Lightning that arcs to nearby foes', icon: 'ic_spark', fx: { type: 'bolt', color: '#a0e0ff' } },
  thunderclap:{ school: 'air',    name: 'Thunderclap',   cost: 8,  desc: 'Blast nearby foes away and daze them', icon: 'ic_clap', fx: { type: 'nova', color: '#c8e8ff', r: 4 } },
  fly:        { school: 'air',    name: 'Fly',           cost: 10, desc: 'Take wing: R/X to rise and dive. Cast again to land.', icon: 'ic_fly', fx: { type: 'self', color: '#b0e8ff' } },
  // water
  icebolt:    { school: 'water',  name: 'Ice Bolt',      cost: 4,  desc: 'Wound and chill one foe', icon: 'ic_icebolt', fx: { type: 'bolt', color: '#70c0ff' } },
  frostnova:  { school: 'water',  name: 'Frost Nova',    cost: 7,  desc: 'Freeze and wound all foes around you', icon: 'ic_frost', fx: { type: 'nova', color: '#a0d8ff', r: 3.5 } },
  waterwalk:  { school: 'water',  name: 'Water Walk',    cost: 8,  desc: 'The party treads rivers and lakes awhile', icon: 'ic_wwalk', fx: { type: 'self', color: '#4090e0' } },
  // earth
  rockblast:  { school: 'earth',  name: 'Rock Blast',    cost: 5,  desc: 'A boulder that batters a foe backward', icon: 'ic_rock', fx: { type: 'bolt', color: '#c0a060' } },
  stoneskin:  { school: 'earth',  name: 'Stone Skin',    cost: 6,  desc: 'The party hardens: +3 DEF awhile', icon: 'ic_stone', fx: { type: 'self', color: '#b0985a' } },
  roots:      { school: 'earth',  name: 'Grasping Roots',cost: 8,  desc: 'Roots pin every nearby foe in place', icon: 'ic_roots', fx: { type: 'nova', color: '#7a9a30', r: 5 } },
  // body
  heal:       { school: 'body',   name: 'Heal',          cost: 5,  desc: 'Mend the most wounded ally', icon: 'ic_heal', fx: { type: 'self', color: '#80ff9a' } },
  regen:      { school: 'body',   name: 'Regeneration',  cost: 7,  desc: 'The party knits closed awhile', icon: 'ic_regen', fx: { type: 'self', color: '#ff9080' } },
  greatheal:  { school: 'body',   name: 'Great Heal',    cost: 11, desc: 'Mend the whole party at once', icon: 'ic_gheal', fx: { type: 'self', color: '#80ffb0' } },
  // spirit
  bless:      { school: 'spirit', name: 'Bless',         cost: 5,  desc: 'The party strikes harder: +2 ATK awhile', icon: 'ic_bless', fx: { type: 'self', color: '#f0e0a0' } },
  spiritlash: { school: 'spirit', name: 'Spirit Lash',   cost: 6,  desc: 'A soul-strike no armor can turn', icon: 'ic_lash', fx: { type: 'beam', color: '#e8e8ff' } },
  raisedead:  { school: 'spirit', name: 'Raise Dead',    cost: 12, desc: 'Call a fallen hero back to their feet', icon: 'ic_raise', fx: { type: 'self', color: '#ffffff' } },
  // light
  sunray:     { school: 'light',  name: 'Sunray',        cost: 7,  desc: 'A searing beam that leaves foes dazzled', icon: 'ic_sunray', fx: { type: 'beam', color: '#fff0a0' } },
  prismatic:  { school: 'light',  name: 'Prismatic Light', cost: 10, desc: 'Burn every foe in sight; soothe the party', icon: 'ic_prism', fx: { type: 'nova', color: '#ffffff', r: 6 } },
  hourofpower:{ school: 'light',  name: 'Hour of Power', cost: 12, desc: 'Bless, stone skin, and haste — all at once', icon: 'ic_hour', fx: { type: 'self', color: '#ffd040' } },
  // dark
  drain:      { school: 'dark',   name: 'Vampiric Drain', cost: 6, desc: 'Steal a foe\'s life for the caster', icon: 'ic_drain', fx: { type: 'beam', color: '#c03060' } },
  curse:      { school: 'dark',   name: 'Curse',         cost: 7,  desc: 'Wither a foe\'s strength and speed', icon: 'ic_curse', fx: { type: 'bolt', color: '#9040c0' } },
  armageddon: { school: 'dark',   name: 'Armageddon',    cost: 30, desc: 'The sky falls on every monster in the vale — and singes you', icon: 'ic_arma', fx: { type: 'nova', color: '#ff4020', r: 7 } },
};

// ---- spec spells: pure data, executed by applyEffects (src/spellcraft.js).
// icon 'rune_*' auto-paints a school-colored rune at boot. No castSkill case needed.
Object.assign(SPELLS, {
  // fire
  emberspray:  { school: 'fire', name: 'Ember Spray', cost: 5, desc: 'A fan of embers scorches all in a line', icon: 'rune_emberspray', shape: 'line', len: 5, effects: [{ kind: 'damage', amount: 5 }, { kind: 'dot', perSec: 2, secs: 3 }], fx: { type: 'beam', color: '#ff9040' } },
  immolation:  { school: 'fire', name: 'Immolation', cost: 12, desc: 'A pillar of flame burns around where you stand', icon: 'rune_immolation', shape: 'totem', r: 3, secs: 10, effects: [{ kind: 'damage', amount: 6 }], fx: { type: 'nova', color: '#ff5010', r: 3 } },
  meteorswarm: { school: 'fire', name: 'Meteor Swarm', cost: 16, desc: 'Stones of fire rain around your target', icon: 'rune_meteorswarm', shape: 'target', range: 9, effects: [{ kind: 'spikes', count: 8, amount: 9, r: 4 }], fx: { type: 'bolt', color: '#ff6020' } },
  // air
  gust:        { school: 'air', name: 'Gust', cost: 3, desc: 'A hammer of wind hurls a foe away', icon: 'rune_gust', shape: 'target', range: 8, effects: [{ kind: 'knockback', amount: 3.5 }], fx: { type: 'bolt', color: '#c8e8ff' } },
  haste:       { school: 'air', name: 'Haste', cost: 8, desc: 'The party moves like the wind awhile', icon: 'rune_haste', shape: 'self', effects: [{ kind: 'buff', stat: 'haste', secs: 20 }], fx: { type: 'self', color: '#b0e8ff' } },
  blink:       { school: 'air', name: 'Blink', cost: 7, desc: 'Step between heartbeats to where you gaze', icon: 'rune_blink', shape: 'self', effects: [{ kind: 'blink', dist: 6 }], fx: { type: 'self', color: '#d8f0ff' } },
  stormcall:   { school: 'air', name: 'Stormcall', cost: 11, desc: 'Thunder answers, striking all around you', icon: 'rune_stormcall', shape: 'nova', r: 4, effects: [{ kind: 'damage', amount: 7 }, { kind: 'control', c: 'daze', secs: 2 }], fx: { type: 'nova', color: '#a0d0ff', r: 4 } },
  // water
  cleansingrain: { school: 'water', name: 'Cleansing Rain', cost: 6, desc: 'Cool rain soothes the whole party', icon: 'rune_cleansingrain', shape: 'self', effects: [{ kind: 'heal', amount: 7, party: true }], fx: { type: 'self', color: '#70b8e8' } },
  icelance:    { school: 'water', name: 'Ice Lance', cost: 9, desc: 'A spear of ice pierces everything in a line', icon: 'rune_icelance', shape: 'line', len: 7, effects: [{ kind: 'damage', amount: 8 }, { kind: 'control', c: 'slow', secs: 2 }], fx: { type: 'beam', color: '#a0e0ff' } },
  flashfreeze: { school: 'water', name: 'Flash Freeze', cost: 11, desc: 'One foe becomes a statue of brittle ice', icon: 'rune_flashfreeze', shape: 'target', range: 8, effects: [{ kind: 'control', c: 'sleep', secs: 4 }, { kind: 'hex', amount: 3, secs: 6 }], fx: { type: 'bolt', color: '#d8f4ff' } },
  // earth
  tremor:      { school: 'earth', name: 'Tremor', cost: 5, desc: 'The ground bucks beneath nearby foes', icon: 'rune_tremor', shape: 'nova', r: 3, effects: [{ kind: 'damage', amount: 4 }, { kind: 'control', c: 'daze', secs: 1.5 }], fx: { type: 'nova', color: '#c0a060', r: 3 } },
  bulwark:     { school: 'earth', name: 'Bulwark', cost: 11, desc: 'A wall of stone rises before you', icon: 'rune_bulwark', shape: 'self', effects: [{ kind: 'wall', len: 3, secs: 12 }], fx: { type: 'self', color: '#b0985a' } },
  earthspikes: { school: 'earth', name: 'Earthspike Field', cost: 13, desc: 'Stone fangs erupt around your target', icon: 'rune_earthspikes', shape: 'target', range: 8, effects: [{ kind: 'spikes', count: 8, amount: 8, r: 4 }], fx: { type: 'bolt', color: '#9a7a30' } },
  golem:       { school: 'earth', name: 'Summon Golem', cost: 16, desc: 'A servant of stone rises to fight for you', icon: 'rune_golem', shape: 'self', effects: [{ kind: 'summon', type: 'golem', secs: 30 }], fx: { type: 'self', color: '#8a8f98' } },
  // body
  stimulant:   { school: 'body', name: 'Stimulant', cost: 6, desc: 'Hearts hammer: the party heals and quickens', icon: 'rune_stimulant', shape: 'self', effects: [{ kind: 'heal', amount: 6, party: true }, { kind: 'buff', stat: 'haste', secs: 6 }], fx: { type: 'self', color: '#ff9080' } },
  vigor:       { school: 'body', name: 'Vigor', cost: 9, desc: 'Mend flesh and harden it against the next blow', icon: 'rune_vigor', shape: 'self', effects: [{ kind: 'heal', amount: 14 }, { kind: 'buff', stat: 'def', secs: 10 }], fx: { type: 'self', color: '#e87060' } },
  secondwind:  { school: 'body', name: 'Second Wind', cost: 13, desc: 'The whole party rallies, wounds and weariness lifting', icon: 'rune_secondwind', shape: 'self', effects: [{ kind: 'heal', amount: 10, party: true }, { kind: 'mpgain', amount: 5, hpcost: 0 }], fx: { type: 'self', color: '#a0ffb8' } },
  // spirit
  ghostblades: { school: 'spirit', name: 'Ghost Blades', cost: 9, desc: "The party's blows carry spectral edges awhile", icon: 'rune_ghostblades', shape: 'self', effects: [{ kind: 'buff', stat: 'ghost', secs: 15 }], fx: { type: 'self', color: '#d8d8ff' } },
  ancestorswatch: { school: 'spirit', name: "Ancestor's Watch", cost: 12, desc: 'A spirit totem slows foes who dare approach', icon: 'rune_ancestorswatch', shape: 'totem', r: 4, secs: 20, effects: [{ kind: 'control', c: 'slow', secs: 2 }], fx: { type: 'self', color: '#c8c8e8' } },
  spiritwisp:  { school: 'spirit', name: 'Spirit Wisp', cost: 10, desc: 'A hungry wisp hunts your enemies', icon: 'rune_spiritwisp', shape: 'self', effects: [{ kind: 'summon', type: 'wisp', secs: 20 }], fx: { type: 'self', color: '#e8e8ff' } },
  // mind (Serena's new school)
  foresight:   { school: 'mind', name: 'Foresight', cost: 8, desc: 'See each blow before it lands; some never do', icon: 'rune_foresight', shape: 'self', effects: [{ kind: 'buff', stat: 'dodge', secs: 20 }], fx: { type: 'self', color: '#f0a0d8' } },
  sleep:       { school: 'mind', name: 'Sleep', cost: 9, desc: 'Nearby foes drop where they stand, dreaming', icon: 'rune_sleep', shape: 'nova', r: 4, effects: [{ kind: 'control', c: 'sleep', secs: 6 }], fx: { type: 'nova', color: '#e878b8', r: 4 } },
  charmbeast:  { school: 'mind', name: 'Charm Beast', cost: 10, desc: 'One beast forgets whose side it was on', icon: 'rune_charmbeast', shape: 'target', range: 8, effects: [{ kind: 'control', c: 'charm', secs: 15 }], fx: { type: 'bolt', color: '#f0a0d8' } },
  mindspike:   { school: 'mind', name: 'Mind Spike', cost: 8, desc: 'A needle of pure will; no armor answers it', icon: 'rune_mindspike', shape: 'target', range: 9, effects: [{ kind: 'damage', amount: 9, true: true }], fx: { type: 'beam', color: '#ff90d0' } },
  masshysteria: { school: 'mind', name: 'Mass Hysteria', cost: 16, desc: 'Nearby foes turn on one another in terror', icon: 'rune_masshysteria', shape: 'nova', r: 5, effects: [{ kind: 'control', c: 'charm', secs: 8 }], fx: { type: 'nova', color: '#e878b8', r: 5 } },
  astralrecall: { school: 'mind', name: 'Astral Recall', cost: 12, desc: 'Fold the world; stand again at the fountain', icon: 'rune_astralrecall', shape: 'self', effects: [{ kind: 'recall' }], fx: { type: 'self', color: '#f0c8e8' } },
  // light
  aegis:       { school: 'light', name: 'Aegis', cost: 10, desc: 'A shining shield turns pain back on the striker', icon: 'rune_aegis', shape: 'self', effects: [{ kind: 'buff', stat: 'reflect', secs: 12 }], fx: { type: 'self', color: '#fff0b0' } },
  consecrate:  { school: 'light', name: 'Consecrate', cost: 14, desc: 'Holy ground mends friends and sears foes', icon: 'rune_consecrate', shape: 'totem', r: 4, secs: 12, effects: [{ kind: 'heal', amount: 6, party: true }, { kind: 'damage', amount: 4 }], fx: { type: 'nova', color: '#fff0a0', r: 4 } },
  judgment:    { school: 'light', name: 'Judgment', cost: 15, desc: 'The wounded are weighed, and found wanting', icon: 'rune_judgment', shape: 'target', range: 9, effects: [{ kind: 'execute', factor: 0.5 }], fx: { type: 'beam', color: '#ffe880' } },
  // dark
  hex:         { school: 'dark', name: 'Hex', cost: 5, desc: "Rot a foe's armor from within", icon: 'rune_hex', shape: 'target', range: 9, effects: [{ kind: 'hex', amount: 3, secs: 10 }], fx: { type: 'bolt', color: '#b060d8' } },
  bloodritual: { school: 'dark', name: 'Blood Ritual', cost: 2, desc: 'Pay in blood; be repaid in power', icon: 'rune_bloodritual', shape: 'self', effects: [{ kind: 'mpgain', amount: 14, hpcost: 10 }], fx: { type: 'self', color: '#c03060' } },
  shadowstep:  { school: 'dark', name: 'Shadowstep', cost: 9, desc: 'Vanish, and reappear at your victim\'s back', icon: 'rune_shadowstep', shape: 'target', range: 8, effects: [{ kind: 'blink', behind: true }], fx: { type: 'self', color: '#8040a8' } },
  plague:      { school: 'dark', name: 'Plague', cost: 14, desc: 'A sickness that leaps to the next living thing', icon: 'rune_plague', shape: 'target', range: 8, effects: [{ kind: 'dot', perSec: 4, secs: 8, hop: true }], fx: { type: 'bolt', color: '#80c030' } },
});

// Xarthax is spawned specially (uid-safe) and opens the Spellcraft flow
const XARTHAX = {
  id: 'xarthax', name: 'Xarthax the Spellwright', art: 'spellwright', spot: [5, 10],
  home: 'a corner table at the Silver Stoat',
  locale: 'You are visiting Emberfall village from your tower in the distant Shardfields, taking a corner table at the Silver Stoat tavern. You travel the frontier collecting spell-ideas.',
  persona: 'a shard-mad spell-researcher, banned from three guilds for irresponsible brilliance, theatrical and utterly delighted by novelty. You weave NEW spells from ideas adventurers describe to you. Draw out their idea; ask at most one clarifying question; when the idea is clear, tell them to pull the golden thread.',
  specialty: 'spellcraft',
  greeting: 'Ahh, wardens! Sit, sit! I smell unspent mana and unripe IDEAS. Describe me a spell that does not exist — anything at all! — and when your idea is ripe, pull the golden thread and I shall weave it into the world.',
};

// every non-martial spell exists as a learnable scroll item
const SCROLL_PRICE = {
  firebolt: 60, fireball: 110, ringfire: 170, spark: 70, thunderclap: 160, fly: 250,
  icebolt: 60, frostnova: 130, waterwalk: 150, rockblast: 90, stoneskin: 120, roots: 160,
  heal: 80, regen: 130, greatheal: 190, bless: 90, spiritlash: 110, raisedead: 220,
  sunray: 130, prismatic: 200, hourofpower: 260, drain: 110, curse: 130, armageddon: 400,
};

// ---- items: equipment adds real stats, potions restore, valuables sell ----
const ITEM_TYPES = {
  shortsword: { name: 'Short Sword',     kind: 'weapon', atk: 2, icon: 'it_sword',   price: 70 },
  broadsword: { name: 'Broadsword',      kind: 'weapon', atk: 4, icon: 'it_bsword',  price: 200 },
  huntbow:    { name: 'Hunting Bow',     kind: 'weapon', atk: 3, icon: 'it_bow',     price: 120 },
  leather:    { name: 'Leather Jerkin',  kind: 'armor',  def: 1, icon: 'it_leather', price: 60 },
  chain:      { name: 'Chain Shirt',     kind: 'armor',  def: 3, icon: 'it_chain',   price: 160 },
  hpotion:    { name: 'Healing Draught', kind: 'potion', heal: 22, icon: 'it_hpot',  price: 25 },
  mpotion:    { name: 'Mana Philtre',    kind: 'potion', mana: 14, icon: 'it_mpot',  price: 30 },
  emerald:    { name: 'Rough Emerald',   kind: 'valuable', gold: 35, icon: 'it_gem' },
  lostblade:  { name: "Bram's Blade",    kind: 'quest', icon: 'it_blade' },
};

// every non-martial spell exists as a learnable scroll (icon reuses the spell's)
for (const [sid, sp] of Object.entries(SPELLS)) {
  if (sp.school === 'martial') continue;
  ITEM_TYPES['scroll_' + sid] = {
    name: 'Scroll: ' + sp.name, kind: 'scroll', spell: sid,
    icon: sp.icon, price: SCROLL_PRICE[sid] || 100,
  };
}

const SHOP_STOCK = [
  'hpotion', 'mpotion', 'leather', 'shortsword', 'huntbow', 'chain', 'broadsword',
  'scroll_frostnova', 'scroll_stoneskin', 'scroll_regen',
  'scroll_drain', 'scroll_sunray', 'scroll_raisedead',
];

function heroAtk(h) { return h.atk + (h.weapon ? ITEM_TYPES[h.weapon].atk || 0 : 0); }
function heroDef(h) { return h.def + (h.armor ? ITEM_TYPES[h.armor].def || 0 : 0); }
function invAdd(id) {
  const i = GameData.inventory.indexOf(null);
  if (i < 0) return false;
  GameData.inventory[i] = id;
  return true;
}

function makeHero(name, cls, stats) {
  return {
    name, cls,
    level: 1, xp: 0,
    hp: stats.hp, maxHp: stats.hp,
    mp: stats.mp, maxMp: stats.mp,
    atk: stats.atk, def: stats.def,
    spells: stats.spells.slice(), // known spell ids
    quick: stats.spells[0],       // readied on this hero's hotkey
    weapon: null, armor: null,    // equipped item ids
    range: stats.range,           // tiles; how far this hero's basic attack reaches
    rec: stats.rec,               // ms between attacks
    readyAt: 0,
  };
}

const GameData = {
  gold: 1000, // test-mode purse: coach fares, scrolls, and weavings on the house

  party: [
    makeHero('Roderick', 'Knight',   { hp: 44, mp: 12, atk: 8, def: 4, spells: ['cleave', 'doubleshot'], range: 2.2, rec: 1000 }),
    makeHero('Wren',     'Archer',   { hp: 32, mp: 26, atk: 7, def: 2, spells: ['doubleshot', 'spark', 'thunderclap', 'stormcall', 'blink', 'haste', 'gust', 'icebolt', 'icelance', 'flashfreeze', 'cleansingrain', 'waterwalk'], range: 9, rec: 850 }),
    makeHero('Serena',   'Cleric',   { hp: 30, mp: 42, atk: 4, def: 2, spells: ['heal', 'greatheal', 'regen', 'bless', 'stimulant', 'vigor', 'secondwind', 'sunray', 'prismatic', 'hourofpower', 'aegis', 'consecrate', 'judgment', 'spiritlash', 'ghostblades', 'ancestorswatch', 'spiritwisp', 'raisedead', 'foresight', 'sleep', 'charmbeast', 'mindspike', 'masshysteria', 'astralrecall'], range: 6, rec: 1200 }),
    makeHero('Malwick',  'Sorcerer', { hp: 26, mp: 55, atk: 3, def: 1, spells: ['fireball', 'firebolt', 'ringfire', 'emberspray', 'immolation', 'meteorswarm', 'frostnova', 'rockblast', 'stoneskin', 'roots', 'tremor', 'bulwark', 'earthspikes', 'golem', 'drain', 'curse', 'hex', 'bloodritual', 'shadowstep', 'plague', 'fly', 'armageddon'], range: 7, rec: 1300 }),
  ],
  flags: { hasLostBlade: false, wolfKills: 0 },
  quests: { lostblade: 'available', wolfcull: 'available' }, // available -> active -> (found/ready) -> done
  inventory: new Array(32).fill(null),
  craftedSpells: [], // player-invented spell specs (persisted; re-registered on load)
  zone: 'embervale',      // current map
  zoneState: {},          // { [zoneId]: { seed, gone:[] } } — each map remembers itself
};

// ---- zones: separate maps you travel between by coach (design/WORLD.md) ----
// home = the Emberfall vale (village, camp, river, quest). town = authored
// walled settlement, no monsters. wild = themed wilderness. `arrive` is where
// the coach drops you.

// Oakhearth: a walled market town beneath Castle Oakhearth (Act 1 hub).
// Legend: k tall castle wall · S stone · m stone window · T timber · n window ·
// B plank · o plank window · D door · C chimney · ':' cobble · ',' dirt ·
// W well · L lamp · '.' grass
const OAKHEARTH_LAYOUT = [
  'kkkkkkkmmkkkkmmkkkkkkk',
  'k::::::::::::::::::::k',
  'k:::SSSSSmmSSSSS:::::k',
  'k:::S::::::::::m:::::k',
  'k:::m::::::::::S:::::k',
  'k:::SSSSSDSSSSSS:::::k',
  'k::::::::,:::::::::::k',
  'kkkkkkkkkDkkkkkkkkkkkk',
  '.....,,,,,............',
  '.TTnTT.,,,.SSmSS......',
  '.TDTTC.,,,.SSDSS......',
  '.......,,,............',
  '.BBoBB.,,,.TTnTT......',
  '.BDBBB.,,,.TDTTT......',
  '...L..,,,,..W.........',
  '......,,,,............',
];

const OAK_VILLAGERS = [
  {
    id: 'aldric', name: 'Lord Aldric', art: 'lord', st: 0, spot: [12, 6],
    home: 'the courtyard of Castle Oakhearth',
    locale: 'You keep Oakhearth, a walled market town beneath your family\'s old castle, a coach-ride west of the Emberfall frontier. Its market square holds an inn, houses, and the mages\' guild hall.',
    persona: 'the graying castellan of Oakhearth — courteous, tired, iron underneath. The wolf packs of Pinereach have grown bold enough to take riders on the road, and you want sword-hands to thin them.',
    specialty: 'wolfcull',
    greeting: 'Welcome to Oakhearth, wardens. Forgive the thin garrison — every spare blade watches the Pinereach road. Perhaps you are the answer to that.',
  },
  {
    id: 'orwin', name: 'Magister Orwin', art: 'mage2', st: 0, spot: [13, 11],
    home: 'the guild hall on Oakhearth\'s square',
    locale: 'You keep the mages\' guild hall in Oakhearth, a walled market town with a castle, an inn, and a market square.',
    persona: 'a precise, dry-witted guild magister who catalogues ember-shards and disapproves of Xarthax by name (though you keep his letters). You lecture gently about the nine schools of magic.',
    specialty: 'magic',
    greeting: 'Ah — travellers with mana on their fingers. Mind the carpets. What would you know of the Art?',
  },
  {
    id: 'betha', name: 'Betha the Innkeeper', art: 'innkeep', st: 0, spot: [2, 11],
    home: 'the Gilded Acorn inn',
    locale: 'You run the Gilded Acorn, the inn on Oakhearth\'s market square, in the shadow of the castle.',
    persona: 'a brisk, warm innkeeper who hears every rumor that rides the coach road and repeats the best ones free with supper.',
    specialty: 'rumors',
    greeting: 'Come in out of the dust! Stew\'s hot, beds are clean, and the gossip is fresher than either.',
  },
];

const ZONES = {
  embervale: {
    name: 'Embervale', home: true, arrive: [20.5, 36.5],
  },
  pinereach: {
    name: 'Pinereach', arrive: [12.5, 36.5],
    dense: true, // thick pine forest
    enemies: [['wolf', 0.5], ['bear', 0.82], ['goblin', 1]],
    palette: { fog: 0x8ea89a, fogNear: 7, fogFar: 26, hemiSky: 0x9ab0c4,
               hemiGround: 0x22331c, hemiInt: 0.72, sun: 0xdfe6c4, sunInt: 0.6, water: 0x2c5240 },
  },
  oakhearth: {
    name: 'Oakhearth', town: true, arrive: [17.5, 36.5],
    settlements: [{ layout: OAKHEARTH_LAYOUT, x1: 8, y1: 26 }],
    villagers: OAK_VILLAGERS,
    // roofs, relative to the town stamp (st 0)
    buildings: [
      { x1: 4, y1: 2, x2: 15, y2: 5, h: 2.35, color: 0x4a5a6e },   // the keep
      { x1: 1, y1: 9, x2: 5, y2: 10, h: 1.25, color: 0x7a4a2a },   // house
      { x1: 11, y1: 9, x2: 15, y2: 10, h: 1.35, color: 0x5a6a8a }, // guild hall
      { x1: 1, y1: 12, x2: 5, y2: 13, h: 1.25, color: 0x6b4526 },  // the Gilded Acorn
      { x1: 11, y1: 12, x2: 15, y2: 13, h: 1.25, color: 0x7a5a2a },// house
    ],
    palette: { fog: 0xc8d4e8, fogNear: 12, fogFar: 40, hemiSky: 0xbfd8f8,
               hemiGround: 0x5a6a4a, hemiInt: 0.95, sun: 0xffeecc, sunInt: 0.85, water: 0x2f6fa8 },
  },
  greymire: {
    name: 'Greymire', arrive: [12.5, 36.5],
    marsh: true, // drowned fen: pools everywhere, Water Walk earns its keep
    enemies: [['wisp', 0.45], ['slime', 0.75], ['goblin', 1]],
    palette: { fog: 0x7a8a74, fogNear: 5, fogFar: 20, hemiSky: 0x8a9a84,
               hemiGround: 0x2a3324, hemiInt: 0.6, sun: 0xc8c8a8, sunInt: 0.45, water: 0x3a4a34 },
  },
  shardfields: {
    name: 'The Shardfields', arrive: [12.5, 36.5],
    crystals: 70, // ember-shard spires litter the wastes
    enemies: [['emberspawn', 0.55], ['wisp', 0.8], ['goblin', 1]],
    // Xarthax's tower — he weaves here too (it IS his home; the Stoat is his outing)
    settlements: [{
      layout: [
        '..kkk..',
        '..kmk..',
        '..kkk..',
        '..kDk..',
        '..,,,..',
        '.,,,,,.',
      ], x1: 70, y1: 12,
    }],
    villagers: [Object.assign({}, XARTHAX, {
      st: 0, spot: [3, 4],
      home: 'your crystal-crowned tower in the Shardfields',
      locale: 'You are at your own tower in the Shardfields — violet wastes where the Ember fell thickest, shard-spires humming with wild magic. Emberspawn condense out of the air here; you find them fascinating.',
    })],
    buildings: [{ x1: 2, y1: 0, x2: 4, y2: 3, h: 3.1, color: 0x5a3a8a }],
    palette: { fog: 0x9a86c8, fogNear: 9, fogFar: 30, hemiSky: 0xa890d8,
               hemiGround: 0x3a2a54, hemiInt: 0.8, sun: 0xe8d0ff, sunInt: 0.62, water: 0x5a4a9a },
  },
};

// hand-placed positions on the parchment world map (V), 700x430 canvas
ZONES.embervale.worldPos = [420, 250];
ZONES.pinereach.worldPos = [560, 150];
ZONES.oakhearth.worldPos = [255, 180];
ZONES.greymire.worldPos = [150, 310];
ZONES.shardfields.worldPos = [140, 90];

// coach routes: where each zone's coachman can send you, and the fare
const TRAVEL = {
  embervale: [
    { to: 'pinereach', name: 'Pinereach', price: 40 },
    { to: 'oakhearth', name: 'Oakhearth', price: 60 },
  ],
  pinereach: [
    { to: 'embervale', name: 'Emberfall', price: 0 }, // ride home is on the house
    { to: 'oakhearth', name: 'Oakhearth', price: 30 },
  ],
  oakhearth: [
    { to: 'embervale', name: 'Emberfall', price: 60 },
    { to: 'pinereach', name: 'Pinereach', price: 30 },
    { to: 'greymire', name: 'Greymire', price: 50 },
    { to: 'shardfields', name: 'The Shardfields', price: 80 },
  ],
  greymire: [
    { to: 'oakhearth', name: 'Oakhearth', price: 0 }, // nobody lingers in the mire
  ],
  shardfields: [
    { to: 'oakhearth', name: 'Oakhearth', price: 0 }, // the return trip is a mercy
  ],
};

// the coachman NPC (placed per-zone in buildEntities; talking opens the travel menu)
const COACHMAN = {
  id: 'coachman', name: 'Jori the Coachman', art: 'coachman', specialty: 'coach',
  home: 'the carriage post',
  persona: 'a cheerful, road-worn carriage driver who ferries folk between the frontier holds. You know every rut and toll on the roads and love to talk of far places.',
  greeting: 'Climb aboard, friends! My team\'s rested and the roads are open. Where can I carry you today?',
};

// the party sets out with a modest kit
GameData.party[0].weapon = 'shortsword';
GameData.party[0].armor = 'leather';
GameData.party[1].weapon = 'huntbow';
GameData.inventory[0] = 'hpotion';
GameData.inventory[1] = 'hpotion';
GameData.inventory[2] = 'mpotion';

const QUESTS = {
  lostblade: {
    title: 'The Lost Blade',
    accept: 'Bring my blade home and Maren\'s scroll is yours — Fly, no less. The wind\'s own gift. The goblins hauled my blade east, past the river ford. Watch the hills.',
    complete: 'My blade! By the forge — you actually brought it home! Here, as promised: Maren\'s scroll — FLY. Take the wind itself for a mount, and let the wolves snap at your shadow. Thank you, friends.',
  },
  wolfcull: {
    title: 'The Wolves of Pinereach',
    need: 6, // dire wolves to cull
    accept: 'Six of the boldest, wardens — thin the packs that stalk the Pinereach road, and Oakhearth\'s purse opens to you: three hundred and fifty gold, and a scroll from the guild\'s own vault. The coach will carry you there.',
    complete: 'Six pelts\' worth of quiet on my road — the coachmen already toast your names. Here: three hundred and fifty gold, and Magister Orwin parts (grudgingly) with a guild scroll. Oakhearth thanks you.',
  },
};

// villagers of Emberfall — personas feed the local LLM's system prompt.
// spot = the tile they stand on (matches the village layout in world.js)
const VILLAGERS = [
  {
    id: 'maren', name: 'Elder Maren', art: 'elder', spot: [4, 3], home: 'the town hall',
    persona: 'the village\'s white-haired elder and keeper of its lore. You speak gently, sometimes in half-riddles, and you worry over the monsters plaguing the vale.',
    specialty: 'monsters',
    greeting: 'Welcome, travelers. The vale grows darker than the old tales ever warned — ask, and I will share what I remember.',
  },
  {
    id: 'bram', name: 'Bram the Smith', art: 'smith', spot: [10, 3], home: 'my smithy',
    persona: 'the village\'s gruff, big-hearted blacksmith. You speak plainly, size up warriors at a glance, and respect anyone who fights the vale\'s monsters.',
    specialty: 'party',
    greeting: 'Hah! Steel on your hips and dents in your shields — my kind of visitors. Speak up, the forge won\'t wait.',
  },
  {
    id: 'tilly', name: 'Tilly', art: 'child', spot: [9, 8], home: 'the village well',
    persona: 'a wide-eyed farm child of about nine. You are excitable, easily distracted, obsessed with frogs and chickens, and you think adventurers are the best thing ever.',
    specialty: 'silly',
    greeting: 'Ooh!! Real adventurers!! Did you see any frogs out there? Or WOLVES? Did you fight one?!',
  },
  {
    id: 'odo', name: 'Odo the Peddler', art: 'merchant', spot: [11, 11], home: 'my trading post',
    persona: 'a traveling peddler with a nose for coin. You are friendly but always angling toward profit, and you keep careful track of rumors about treasure.',
    specialty: 'chests',
    greeting: 'Ah, customers — er, heroes! Odo\'s the name. Rumors, directions, the occasional map... all fairly priced, some even free.',
  },
  {
    id: 'hilda', name: 'Hilda', art: 'innkeep', spot: [4, 11], home: 'the Silver Stoat tavern',
    persona: 'the warm, sharp-tongued keeper of the Silver Stoat tavern. You mother every guest, trade in gossip, and hear every rumor that passes through the vale.',
    specialty: 'rumors',
    greeting: 'Come in, loves, mind the step. The Stoat hears everything worth hearing — and I pour most of it back out.',
  },
  {
    // st: 1 = the Eastmarch camp; spot is relative to that settlement's stamp
    id: 'marta', name: 'Marta the Wolf-hunter', art: 'marta', st: 1, spot: [4, 5],
    home: 'my fire at Eastmarch camp',
    locale: 'You keep Eastmarch, a small palisaded hunting camp at the east road\'s end, its campfire always burning and two hide tents pitched against the wind. You know Emberfall village to the west, but the wilds are your home.',
    persona: 'a weathered, watchful wolf-hunter who camps at the vale\'s eastern edge. You speak in clipped, practical sentences, track the dire wolves for a living, and trust your hounds more than most folk.',
    specialty: 'wolves',
    greeting: 'Hold there. You smell of the road, not of wolf — good. Warm yourself by the fire, or ask me where the packs are running.',
  },
];

// real-time combat stats: speed = chase tiles/sec, cd = ms between attacks
const ENEMY_TYPES = {
  slime:  { name: 'Slime',     hp: 16, atk: 4, def: 0, xp: 8,  gold: [2, 6],  speed: 1.2, cd: 1600 },
  goblin: { name: 'Goblin',    hp: 26, atk: 6, def: 1, xp: 14, gold: [4, 10], speed: 1.8, cd: 1300 },
  wolf:   { name: 'Dire Wolf', hp: 40, atk: 9, def: 2, xp: 24, gold: [8, 16], speed: 2.6, cd: 1100 },
  bear:   { name: 'Cave Bear', hp: 68, atk: 13, def: 3, xp: 44, gold: [14, 28], speed: 2.1, cd: 1400 },
  wisp:   { name: 'Mire Wisp', hp: 26, atk: 11, def: 0, xp: 30, gold: [10, 22], speed: 3.0, cd: 1150 },
  emberspawn: { name: 'Emberspawn', hp: 48, atk: 14, def: 2, xp: 58, gold: [18, 34], speed: 2.4, cd: 1050 },
};

function xpForLevel(level) { return level * 40; }

// Seeded RNG for WORLD GENERATION only — a save stores the seed, so the same
// vale regrows on load (combat/loot randomness stays on Math.random).
let genSeed = 1;
function setSeed(s) { genSeed = (s >>> 0) || 1; }
function grand() {
  genSeed = (genSeed * 1664525 + 1013904223) >>> 0;
  return genSeed / 4294967296;
}
function gri(a, b) { return Math.floor(grand() * (b - a + 1)) + a; }

// Small helpers
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }
function dirName(dx, dy) {
  const oct = Math.round((((Math.atan2(dy, dx) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'][oct];
}
