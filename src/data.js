// Shared game state and definitions. Plain globals — no build step.

// ---- magic system: one registry, heroes know spells, keys 1-4 cast each
// hero's readied "quick" spell, B opens the spellbook to swap it ----
const SPELLS = {
  cleave:     { name: 'Cleave',      cost: 3, desc: 'Sweep all foes within reach' },
  doubleshot: { name: 'Double Shot', cost: 4, desc: 'Two arrows at your target' },
  heal:       { name: 'Heal',        cost: 5, desc: 'Mend the most wounded ally' },
  fireball:   { name: 'Fireball',    cost: 6, desc: 'Explodes on your target' },
  frostnova:  { name: 'Frost Nova',  cost: 7, desc: 'Freeze and wound all foes around you' },
  fly:        { name: 'Fly',         cost: 10, desc: 'Take wing: R/X (or PgUp/PgDn) to rise and dive. Cast again to land.' },
};

function makeHero(name, cls, stats) {
  return {
    name, cls,
    level: 1, xp: 0,
    hp: stats.hp, maxHp: stats.hp,
    mp: stats.mp, maxMp: stats.mp,
    atk: stats.atk, def: stats.def,
    spells: stats.spells.slice(), // known spell ids
    quick: stats.spells[0],       // readied on this hero's hotkey
    range: stats.range,           // tiles; how far this hero's basic attack reaches
    rec: stats.rec,               // ms between attacks
    readyAt: 0,
  };
}

const GameData = {
  gold: 50,
  party: [
    makeHero('Roderick', 'Knight',   { hp: 44, mp: 6,  atk: 8, def: 4, spells: ['cleave'],     range: 2.2, rec: 1000 }),
    makeHero('Wren',     'Archer',   { hp: 32, mp: 8,  atk: 7, def: 2, spells: ['doubleshot'], range: 9,   rec: 850 }),
    makeHero('Serena',   'Cleric',   { hp: 30, mp: 14, atk: 4, def: 2, spells: ['heal'],       range: 6,   rec: 1200 }),
    makeHero('Malwick',  'Sorcerer', { hp: 26, mp: 16, atk: 3, def: 1, spells: ['fireball'],   range: 7,   rec: 1300 }),
  ],
  flags: { hasLostBlade: false },
  quests: { lostblade: 'available' }, // available -> active -> found -> done
};

const QUESTS = {
  lostblade: {
    title: 'The Lost Blade',
    accept: 'Bring my blade home and Maren\'s scroll is yours — Fly, no less. The wind\'s own gift. The goblins hauled my blade east, past the river ford. Watch the hills.',
    complete: 'My blade! By the forge — you actually brought it home! Here, as promised: Maren\'s scroll — FLY. Take the wind itself for a mount, and let the wolves snap at your shadow. Thank you, friends.',
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
];

// real-time combat stats: speed = chase tiles/sec, cd = ms between attacks
const ENEMY_TYPES = {
  slime:  { name: 'Slime',     hp: 16, atk: 4, def: 0, xp: 8,  gold: [2, 6],  speed: 1.2, cd: 1600 },
  goblin: { name: 'Goblin',    hp: 26, atk: 6, def: 1, xp: 14, gold: [4, 10], speed: 1.8, cd: 1300 },
  wolf:   { name: 'Dire Wolf', hp: 40, atk: 9, def: 2, xp: 24, gold: [8, 16], speed: 2.6, cd: 1100 },
};

function xpForLevel(level) { return level * 40; }

// Small helpers
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }
function dirName(dx, dy) {
  const oct = Math.round((((Math.atan2(dy, dx) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'][oct];
}
