// BootScene: draws all art onto offscreen 32x32 canvases (walls + billboards).
// WorldScene: first-person exploration with REAL-TIME combat — crosshair
//   targeting, party attack volleys, hero skills on hotkeys, monsters that
//   chase and strike back — plus villagers, chests, fountain, minimap, HUD.

// floors (walk on / see across) vs walls (block rays; heights in raycast.js)
const T_GRASS = 0, T_DIRT = 1, T_COBBLE = 2, T_WATER = 3, T_WOOD = 4;
const T_ROCK = 5, T_FENCE = 6, T_TIMBER = 7, T_PLANK = 8, T_STONE = 9;
const T_DOOR = 10, T_TIMBER_WIN = 11, T_STONE_WIN = 12, T_PLANK_WIN = 13;
const T_SIGN_TAVERN = 14, T_SIGN_SMITH = 15, T_SIGN_TRADE = 16, T_BANNER = 17, T_CHIMNEY = 18;
const T_CASTLE = 19; // tall castle curtain wall (Oakhearth)

// settlement-stamp legend, shared by every authored layout (village/camp/town)
const CHAR_TILE = {
  F: T_FENCE, T: T_TIMBER, V: T_TIMBER, S: T_STONE, B: T_PLANK, k: T_CASTLE,
  D: T_DOOR, n: T_TIMBER_WIN, m: T_STONE_WIN, o: T_PLANK_WIN,
  a: T_SIGN_TAVERN, b: T_SIGN_SMITH, c: T_SIGN_TRADE, h: T_BANNER, C: T_CHIMNEY,
  ':': T_COBBLE, ',': T_DIRT, '=': T_WOOD,
  K: T_DIRT, X: T_DIRT, // campfire & tents stand on dirt (props supply the art)
};
const MAP_W = 96, MAP_H = 72;
const BRIDGE_H = 0.3; // deck height at the bridge's ends (it arches higher mid-span)
const START = { x: 10.5, y: 35.5 }; // the village green

// Emberfall village, hand-authored (Harmondale-flavored: walled village, one
// gate facing the wilderness). Stamped onto the map at VILLAGE.x1/y1.
//   F palisade   T timber wall (town hall / tavern)   S stone wall (smithy)
//   B plank wall (trading post)   D door (opens as you approach)
//   n/m/o windows (timber / stone-forgeglow / plank-shuttered)
//   a/b/c hanging signs (tavern mug / smith anvil / trader coins)
//   h heraldic banner   C chimney   = wood floor   U fountain   W well
//   L lamppost   G gate (opening)   : cobbles   , dirt road   . grass
const VILLAGE_LAYOUT = [
  'FFFFFFFFFFFFFFF',
  'F.............F',
  'F.TTTTT.SSSCS.F',
  'F.n===T.S===m.F',
  'F.T===T.S===S.F',
  'F.ThDhT.SmDbS.F',
  'F......L......F',
  'F.::U:::::W:L.F',
  'F,,,,,,,,,,,,,G',
  'F.VaDnV..BcDoBF',
  'F.V===V..B===BF',
  'F.V===V..B===BF',
  'F.VVVVV..BBBBBF',
  'FFFFFFFFFFFFFFF',
];
// building footprints (layout-relative, inclusive) — walls come from the tile
// stamp; these rects give each building its gabled roof
const BUILDINGS = [
  { x1: 2, y1: 2, x2: 6, y2: 5, color: 0x7a3a30 },   // town hall
  { x1: 8, y1: 2, x2: 12, y2: 5, color: 0x4e545e },  // smithy (slate)
  { x1: 2, y1: 9, x2: 6, y2: 12, color: 0x8a7434 },  // tavern (thatch)
  { x1: 9, y1: 9, x2: 13, y2: 12, color: 0x7a3a30 }, // trading post
];

// Eastmarch — a little palisade hunting camp at the east road's end. No roofed
// buildings; two tents and a campfire are billboard props (see CHAR_PROP).
//   F palisade   G gate (west, onto the road)   K campfire   X tent
//   , trodden dirt   . grass
const CAMP_LAYOUT = [
  'FFFFFFFFF',
  'F,,,,,,,F',
  'F,X,,,X,F',
  'F,,,,,,,F',
  'G,,,K,,,F',
  'F,,,,,,,F',
  'F,,,,,,,F',
  'FFFFFFFFF',
];

// every walled, monster-proof settlement. Stamped over the wilderness in order;
// inVillage/heights/props all loop this list (VILLAGE aliases settlement 0).
const SETTLEMENTS = [
  { layout: VILLAGE_LAYOUT, x1: 4, y1: 28 },
  { layout: CAMP_LAYOUT, x1: 78, y1: 32 },
];
for (const s of SETTLEMENTS) {
  s.x2 = s.x1 + s.layout[0].length - 1;
  s.y2 = s.y1 + s.layout.length - 1;
}
const VILLAGE = SETTLEMENTS[0];  // the road & terrain shelf key off Emberfall

// billboard proportions: bigger vDiv = smaller sprite (bottom stays on the floor)
const SPRITE_META = {
  slime: { vDiv: 2.0 }, goblin: { vDiv: 1.45 }, wolf: { vDiv: 1.55 }, bear: { vDiv: 1.15 },
  chest: { vDiv: 2.3 }, fountain: { vDiv: 1.12 }, well: { vDiv: 1.5 }, lamp: { vDiv: 1.05 },
  tree: { vDiv: 0.85 }, pine: { vDiv: 0.8 }, sword: { vDiv: 1.9 },
  anvil: { vDiv: 2.4 }, barrel: { vDiv: 2.0 }, crate: { vDiv: 2.1 }, smoke: { vDiv: 1.5 },
  spellwright: { vDiv: 1.35 }, golem: { vDiv: 1.1 }, wisp: { vDiv: 2.0 }, totemArt: { vDiv: 1.6 },
  coachman: { vDiv: 1.32 }, carriage: { vDiv: 0.82 },
  lord: { vDiv: 1.3 }, mage2: { vDiv: 1.33 },
  emberspawn: { vDiv: 1.35 }, shard: { vDiv: 1.3 },
  elder: { vDiv: 1.35 }, smith: { vDiv: 1.3 }, child: { vDiv: 1.8 }, merchant: { vDiv: 1.35 },
  innkeep: { vDiv: 1.35 }, marta: { vDiv: 1.32 },
  campfire: { vDiv: 2.2 }, flame: { vDiv: 2.0 }, tent: { vDiv: 1.15 },
};

function makeArt(key, draw, size = 32) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  draw(g);
  ART[key] = c;
  return c;
}

function makeArtWH(key, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  ART[key] = c;
  return c;
}

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  // Optional real-asset overrides: assets/manifest.json lists {key, file} pairs
  // (e.g. {"key":"pt_roderick","file":"portraits/roderick.png"}). Anything it
  // loads replaces the painted fallback at native resolution — for portraits,
  // billboards, faces (face_<villagerId>), anything keyed in ART. No manifest,
  // no assets: every painter below still works. See design/GRAPHICS.md.
  preload() {
    this.load.json('asset-manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-asset-manifest', () => {
      const man = this.cache.json.get('asset-manifest');
      if (Array.isArray(man)) {
        for (const { key, file } of man) this.load.image('asset_' + key, 'assets/' + file);
      }
    });
    this.load.on('loaderror', f => console.warn('[assets] missing:', f.key));
  }

  applyAssetOverrides() {
    const man = this.cache.json.get('asset-manifest');
    if (!Array.isArray(man)) return;
    for (const { key } of man) {
      if (!this.textures.exists('asset_' + key)) continue;
      const img = this.textures.get('asset_' + key).getSourceImage();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      ART[key] = c; // native-res replacement; sprites/UI read art.width
    }
  }

  create() {
    const ell = (g, x, y, rx, ry, color) => {
      g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    };
    const tri = (g, pts, color) => {
      g.fillStyle = color; g.beginPath(); g.moveTo(pts[0], pts[1]);
      g.lineTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.closePath(); g.fill();
    };

    // deterministic scatter for organic texture detail
    let seed = 7;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;

    // -- floor textures, 64px (sampled per-pixel by the ground caster) --
    makeArt('grassfloor', g => {
      g.fillStyle = '#4a8a42'; g.fillRect(0, 0, 64, 64);
      const tones = ['#417c3a', '#559a4a', '#4f8f46', '#43823c'];
      for (let i = 0; i < 90; i++) {
        g.fillStyle = tones[(rnd() * tones.length) | 0];
        g.fillRect(rnd() * 61, rnd() * 61, 2 + rnd() * 3, 2 + rnd() * 3);
      }
      for (let i = 0; i < 45; i++) {
        g.fillStyle = rnd() < 0.5 ? '#5fa852' : '#387534';
        g.fillRect(rnd() * 63, rnd() * 59, 1, 2 + rnd() * 3);
      }
    }, 64);
    makeArt('dirtfloor', g => {
      g.fillStyle = '#7a5c34'; g.fillRect(0, 0, 64, 64);
      const tones = ['#6a4e2a', '#8a6a3e', '#74562e', '#816036'];
      for (let i = 0; i < 70; i++) {
        g.fillStyle = tones[(rnd() * tones.length) | 0];
        g.fillRect(rnd() * 58, rnd() * 59, 3 + rnd() * 6, 2 + rnd() * 4);
      }
      for (let i = 0; i < 26; i++) {
        g.fillStyle = rnd() < 0.5 ? '#95805c' : '#5e452a';
        g.fillRect(rnd() * 61, rnd() * 62, 1 + rnd() * 2, 1 + rnd());
      }
    }, 64);
    makeArt('cobblefloor', g => {
      g.fillStyle = '#4e525a'; g.fillRect(0, 0, 64, 64);
      const grays = ['#8a8f98', '#82878f', '#8f949c', '#7d828a', '#878c94'];
      for (let ry = 0; ry < 4; ry++) {
        const offX = (ry % 2) * 8;
        for (let cx = -1; cx < 5; cx++) {
          const x = cx * 16 + offX, y = ry * 16;
          g.fillStyle = grays[(rnd() * grays.length) | 0];
          g.fillRect(x + 1, y + 1, 14, 14);
          g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(x + 1, y + 1, 14, 2);
          g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + 1, y + 13, 14, 2);
        }
      }
    }, 64);
    makeArt('waterfloor', g => {
      g.fillStyle = '#2a5d8f'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#33679b';
      for (let y = 2; y < 64; y += 8) g.fillRect(0, y, 64, 3);
      for (let i = 0; i < 22; i++) {
        g.fillStyle = rnd() < 0.6 ? '#4d82b8' : '#3a6fa3';
        g.fillRect(rnd() * 48, rnd() * 62, 6 + rnd() * 10, 1);
      }
      g.fillStyle = '#9ac8e8';
      for (let i = 0; i < 12; i++) g.fillRect(rnd() * 60, rnd() * 62, 2, 1);
    }, 64);
    // near-white noise for the 3D terrain's detail map (multiplied over vertex colors)
    makeArt('terrainNoise', g => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 130; i++) {
        g.fillStyle = ['#c8c8c8', '#e6e6e6', '#cfcfcf', '#dfdfdf'][(rnd() * 4) | 0];
        g.fillRect(rnd() * 61, rnd() * 61, 2 + rnd() * 4, 2 + rnd() * 3);
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rnd() < 0.5 ? '#bfbfbf' : '#efefef';
        g.fillRect(rnd() * 63, rnd() * 59, 1, 2 + rnd() * 4);
      }
    }, 64);

    makeArt('woodfloor', g => {
      for (let b = 0; b < 8; b++) {
        const y = b * 8;
        g.fillStyle = b % 2 ? '#9a7248' : '#8f6a42';
        g.fillRect(0, y, 64, 8);
        g.fillStyle = '#6b4a2e'; g.fillRect(0, y + 7, 64, 1);
        for (let i = 0; i < 4; i++) {
          g.fillStyle = rnd() < 0.5 ? '#82603c' : '#a87f52';
          g.fillRect(rnd() * 44, y + 1 + rnd() * 5, 6 + rnd() * 14, 1);
        }
        g.fillStyle = '#5e452a'; g.fillRect((b * 23) % 56 + 2, y + 3, 2, 2);
      }
    }, 64);
    [[T_GRASS, 'grassfloor'], [T_DIRT, 'dirtfloor'], [T_COBBLE, 'cobblefloor'], [T_WATER, 'waterfloor'], [T_WOOD, 'woodfloor']]
      .forEach(([id, key]) => {
        const c = ART[key];
        FLOOR_PIX[id] = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      });

    // -- day sky strip (panned by view angle; sun sits at one heading) --
    {
      const sky = document.createElement('canvas');
      sky.width = 2048; sky.height = 256;
      const sg = sky.getContext('2d');
      const grad = sg.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#5a90d8');
      grad.addColorStop(0.75, '#a8c8ec');
      grad.addColorStop(1, '#c6d8ec');
      sg.fillStyle = grad; sg.fillRect(0, 0, 2048, 256);
      sg.fillStyle = 'rgba(255,240,180,0.35)';
      sg.beginPath(); sg.arc(600, 72, 56, 0, Math.PI * 2); sg.fill();
      sg.fillStyle = '#fff2c8';
      sg.beginPath(); sg.arc(600, 72, 28, 0, Math.PI * 2); sg.fill();
      const cloud = (x, y, s, a) => {
        sg.fillStyle = `rgba(255,255,255,${a})`;
        sg.beginPath(); sg.ellipse(x, y, 52 * s, 18 * s, 0, 0, Math.PI * 2); sg.fill();
        sg.beginPath(); sg.ellipse(x - 30 * s, y + 6 * s, 32 * s, 14 * s, 0, 0, Math.PI * 2); sg.fill();
        sg.beginPath(); sg.ellipse(x + 34 * s, y + 8 * s, 36 * s, 14 * s, 0, 0, Math.PI * 2); sg.fill();
      };
      cloud(260, 88, 1, 0.9); cloud(940, 60, 1.3, 0.85); cloud(1380, 112, 0.8, 0.8);
      cloud(1760, 76, 1.1, 0.9); cloud(480, 152, 0.6, 0.7); cloud(1180, 160, 0.7, 0.75);
      SKY = sky;
    }

    // -- wall textures, 64px (painters are shared so windows/signs can build on them) --
    const paintStone = g => {
      g.fillStyle = '#3a3d44'; g.fillRect(0, 0, 64, 64);
      const tones = ['#565a63', '#5e626b', '#525660', '#5a5e67'];
      for (let ry = 0; ry < 4; ry++) {
        const offX = (ry % 2) * 16;
        for (let cx = -1; cx < 3; cx++) {
          const x = cx * 32 + offX, y = ry * 16;
          g.fillStyle = tones[(rnd() * tones.length) | 0];
          g.fillRect(x + 1, y + 1, 30, 14);
          g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 1, y + 1, 30, 2);
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 1, y + 13, 30, 2);
        }
      }
      for (let i = 0; i < 14; i++) {
        g.fillStyle = rnd() < 0.5 ? '#6a6e78' : '#484c55';
        g.fillRect(rnd() * 58, rnd() * 58, 2 + rnd() * 3, 1 + rnd() * 2);
      }
    };
    makeArt('rockwall', paintStone, 64);
    makeArt('rockwall2', paintStone, 64); // fresh scatter = different stones
    // palisade: rough vertical logs
    makeArt('fencewall', g => {
      for (let i = 0; i < 8; i++) {
        const x = i * 8;
        g.fillStyle = i % 2 ? '#8a6238' : '#7f5a33';
        g.fillRect(x, 0, 8, 64);
        g.fillStyle = '#96703f'; g.fillRect(x, 0, 2, 64);
        g.fillStyle = '#5a3f20'; g.fillRect(x + 6, 0, 1, 64);
        g.fillStyle = '#4a3418'; g.fillRect(x + 7, 0, 1, 64);
      }
      for (let i = 0; i < 22; i++) {
        g.fillStyle = rnd() < 0.5 ? '#a07a48' : '#6a4c26';
        g.fillRect(2 + rnd() * 60, rnd() * 58, 1, 2 + rnd() * 4);
      }
      g.fillStyle = '#4a3418'; g.fillRect(0, 9, 64, 4); g.fillRect(0, 50, 64, 4); // cross-braces
      g.fillStyle = '#6a4c26'; g.fillRect(0, 9, 64, 1); g.fillRect(0, 50, 64, 1);
    }, 64);
    // timber-frame: cream plaster with dark beams (town hall, tavern)
    const paintPlaster = g => {
      g.fillStyle = '#d8cfb8'; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rnd() < 0.5 ? '#cfc4a8' : '#e0d8c2';
        g.fillRect(rnd() * 56, rnd() * 56, 3 + rnd() * 5, 2 + rnd() * 4);
      }
      g.fillStyle = '#5a4028';
      g.fillRect(0, 0, 64, 5); g.fillRect(0, 59, 64, 5);   // top/bottom beams
      g.fillRect(0, 0, 5, 64); g.fillRect(59, 0, 5, 64);   // side beams
      g.fillRect(0, 29, 64, 4);                             // mid beam
    };
    const paintTimber = g => {
      paintPlaster(g);
      g.strokeStyle = '#5a4028'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(4, 33); g.lineTo(60, 60); g.moveTo(60, 33); g.lineTo(4, 60); g.stroke();
      g.fillStyle = '#3a2a18';
      [[2, 2], [60, 2], [2, 60], [60, 60], [31, 30]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    };
    makeArt('timberwall', paintTimber, 64);
    makeArt('timberwall2', g => { // vertical-stud variant to break repetition
      paintPlaster(g);
      g.fillStyle = '#5a4028'; g.fillRect(20, 29, 5, 35); g.fillRect(39, 29, 5, 35);
      g.fillStyle = '#3a2a18';
      [[2, 2], [60, 2], [2, 60], [60, 60]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    }, 64);
    // horizontal planks (trading post)
    const paintPlank = g => {
      for (let b = 0; b < 6; b++) {
        const y = b * 11;
        g.fillStyle = b % 2 ? '#8a6238' : '#845d34';
        g.fillRect(0, y, 64, 11);
        g.fillStyle = '#9a7248'; g.fillRect(0, y, 64, 1);
        g.fillStyle = '#5a3f20'; g.fillRect(0, y + 9, 64, 2);
        for (let i = 0; i < 5; i++) {
          g.fillStyle = rnd() < 0.5 ? '#79552c' : '#956e3f';
          g.fillRect(rnd() * 40, y + 2 + rnd() * 6, 8 + rnd() * 16, 1);
        }
      }
      g.fillStyle = '#4a3418';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(2 + rnd() * 60, 2 + rnd() * 60, 1.5, 0, Math.PI * 2); g.fill(); }
    };
    makeArt('plankwall', paintPlank, 64);

    // oak door in a stone jamb (opens as you approach)
    makeArt('doorwall', g => {
      g.fillStyle = '#6a6e78'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#565a63'; g.fillRect(0, 0, 64, 4); g.fillRect(0, 0, 4, 64); g.fillRect(60, 0, 4, 64);
      g.fillStyle = '#6b4526'; g.fillRect(6, 6, 52, 58);
      g.fillStyle = '#4a2f16';
      for (let x = 14; x < 58; x += 9) g.fillRect(x, 6, 2, 58);
      g.fillStyle = '#2a2d33'; g.fillRect(6, 16, 52, 4); g.fillRect(6, 42, 52, 4);
      g.fillStyle = '#3a3d44';
      [[10, 17], [50, 17], [10, 43], [50, 43]].forEach(([x, y]) => g.fillRect(x, y, 3, 2));
      g.fillStyle = '#d9a520'; g.beginPath(); g.arc(48, 32, 3, 0, Math.PI * 2); g.fill();
    }, 64);

    // windows
    makeArt('timberwin', g => {
      paintTimber(g);
      g.fillStyle = '#5a4028'; g.fillRect(18, 6, 28, 26);
      g.fillStyle = '#3a4c66'; g.fillRect(22, 10, 20, 18);
      g.fillStyle = '#7a94b8'; g.fillRect(24, 11, 5, 16);
      g.fillStyle = '#5a4028'; g.fillRect(31, 10, 2, 18); g.fillRect(22, 18, 20, 2);
      g.fillStyle = '#6b4a2e'; g.fillRect(16, 32, 32, 4);
    }, 64);
    makeArt('stonewin', g => { // the forge glows through the smithy window
      paintStone(g);
      g.fillStyle = '#3a3d44'; g.fillRect(18, 8, 28, 28);
      g.fillStyle = '#c8622a'; g.fillRect(21, 11, 22, 22);
      g.fillStyle = '#f0a04a'; g.fillRect(24, 18, 10, 12);
      g.fillStyle = '#2a2d33'; g.fillRect(21, 11, 22, 3);
      g.fillStyle = '#1a1d23'; g.fillRect(27, 11, 3, 22); g.fillRect(35, 11, 3, 22);
    }, 64);
    makeArt('plankwin', g => { // shuttered
      paintPlank(g);
      g.fillStyle = '#4a3418'; g.fillRect(16, 10, 32, 26);
      g.fillStyle = '#6b4526'; g.fillRect(18, 12, 13, 22); g.fillRect(33, 12, 13, 22);
      g.fillStyle = '#4a2f16'; g.fillRect(31, 12, 2, 22);
      g.fillStyle = '#3a3d44';
      g.fillRect(19, 16, 11, 2); g.fillRect(34, 16, 11, 2);
      g.fillRect(19, 28, 11, 2); g.fillRect(34, 28, 11, 2);
    }, 64);

    // hanging shop signs
    const paintSign = (g, base, icon) => {
      base(g);
      g.fillStyle = '#2a2d33'; g.fillRect(30, 4, 4, 8); g.fillRect(20, 10, 24, 3);
      g.fillStyle = '#8a6238'; g.fillRect(20, 13, 24, 22);
      g.strokeStyle = '#4a3418'; g.lineWidth = 2; g.strokeRect(21, 14, 22, 20);
      icon(g);
    };
    makeArt('signtavern', g => paintSign(g, paintTimber, () => {
      g.fillStyle = '#d9a520'; g.fillRect(26, 20, 10, 11);
      g.fillStyle = '#f0e6c8'; g.fillRect(25, 17, 12, 4);
      g.fillStyle = '#d9a520'; g.fillRect(37, 22, 3, 6);
    }), 64);
    makeArt('signsmith', g => paintSign(g, paintStone, () => {
      g.fillStyle = '#2a2d33';
      g.fillRect(24, 21, 16, 4); g.fillRect(39, 21, 3, 3);
      g.fillRect(28, 25, 8, 3); g.fillRect(26, 28, 12, 3);
    }), 64);
    makeArt('signtrade', g => paintSign(g, paintPlank, () => {
      g.fillStyle = '#d9a520';
      g.beginPath(); g.arc(28, 23, 5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(35, 28, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f0d060'; g.fillRect(26, 21, 2, 2); g.fillRect(33, 26, 2, 2);
    }), 64);

    // heraldic banner (town hall)
    makeArt('bannerwall', g => {
      paintTimber(g);
      g.fillStyle = '#2a2d33'; g.fillRect(18, 4, 28, 3);
      g.fillStyle = '#8a2a2a'; g.fillRect(22, 7, 20, 42);
      g.fillStyle = '#d9a520'; g.fillRect(22, 7, 20, 3); g.fillRect(22, 46, 20, 3);
      g.beginPath(); g.moveTo(32, 16); g.quadraticCurveTo(39, 27, 32, 36); g.quadraticCurveTo(25, 27, 32, 16); g.fill();
      g.fillStyle = '#8a2a2a'; g.beginPath(); g.arc(32, 28, 3, 0, Math.PI * 2); g.fill();
    }, 64);
    WALL_ART[T_ROCK] = ART.rockwall;
    WALL_ART[T_FENCE] = ART.fencewall;
    WALL_ART[T_TIMBER] = ART.timberwall;
    WALL_ART[T_PLANK] = ART.plankwall;
    WALL_ART[T_STONE] = ART.rockwall;
    WALL_ART[T_DOOR] = ART.doorwall;
    WALL_ART[T_TIMBER_WIN] = ART.timberwin;
    WALL_ART[T_STONE_WIN] = ART.stonewin;
    WALL_ART[T_PLANK_WIN] = ART.plankwin;
    WALL_ART[T_SIGN_TAVERN] = ART.signtavern;
    WALL_ART[T_SIGN_SMITH] = ART.signsmith;
    WALL_ART[T_SIGN_TRADE] = ART.signtrade;
    // grassy hillsides (impassable rolling terrain)
    const paintHill = g => {
      g.fillStyle = '#4a7a3a'; g.fillRect(0, 0, 64, 64);
      const tones = ['#417036', '#528544', '#457a3c', '#3c6a32'];
      for (let i = 0; i < 50; i++) {
        g.fillStyle = tones[(rnd() * tones.length) | 0];
        g.fillRect(rnd() * 58, rnd() * 60, 3 + rnd() * 5, 2 + rnd() * 3);
      }
      g.fillStyle = '#6a6e78';
      for (let i = 0; i < 8; i++) g.fillRect(rnd() * 56, 20 + rnd() * 40, 3 + rnd() * 4, 2 + rnd() * 3);
      g.fillStyle = '#5fa852'; g.fillRect(0, 0, 64, 3); // sunlit crest
    };
    makeArt('hillwall', paintHill, 64);
    makeArt('hillwall2', paintHill, 64);

    WALL_ART[T_BANNER] = ART.bannerwall;
    WALL_ART[T_CHIMNEY] = ART.rockwall;
    WALL_ART_ALT[T_TIMBER] = ART.timberwall2;
    WALL_ART_ALT[T_ROCK] = ART.rockwall2;
    WALL_ART_ALT[T_STONE] = ART.rockwall2;

    // -- monsters (64px, shaded) --
    makeArt('slime', g => {
      const bg = g.createRadialGradient(26, 34, 4, 32, 42, 26);
      bg.addColorStop(0, '#6fe0a0'); bg.addColorStop(0.6, '#35b06a'); bg.addColorStop(1, '#1e7a44');
      g.fillStyle = bg;
      g.beginPath(); g.moveTo(8, 44); g.bezierCurveTo(6, 22, 18, 14, 32, 16); g.bezierCurveTo(46, 14, 58, 22, 56, 44);
      g.bezierCurveTo(56, 54, 44, 54, 32, 54); g.bezierCurveTo(20, 54, 8, 54, 8, 44); g.fill();
      g.save(); g.globalAlpha = 0.5; ell(g, 24, 28, 8, 5, '#b8f8d0'); g.restore();       // sheen
      ell(g, 24, 40, 4, 5, '#f4fff8'); ell(g, 40, 40, 4, 5, '#f4fff8');                   // eye whites
      ell(g, 25, 41, 2, 2.6, '#0e2e1c'); ell(g, 41, 41, 2, 2.6, '#0e2e1c');               // pupils
      ell(g, 24, 39.5, 0.9, 1, '#ffffff'); ell(g, 40, 39.5, 0.9, 1, '#ffffff');           // catchlights
      g.strokeStyle = '#123a24'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(28, 48); g.quadraticCurveTo(32, 50, 36, 48); g.stroke();    // mouth
      g.save(); g.globalAlpha = 0.4; g.fillStyle = '#1e7a44'; ell(g, 32, 54, 16, 3, '#1e7a44'); g.restore();
    }, 64);
    makeArt('goblin', g => {
      // ears
      g.fillStyle = '#5a8a2c'; tri(g, [12, 20, 2, 14, 14, 28]); tri(g, [52, 20, 62, 14, 50, 28]);
      // body
      const bd = g.createLinearGradient(0, 28, 0, 58); bd.addColorStop(0, '#6da036'); bd.addColorStop(1, '#42661c');
      g.fillStyle = bd; g.fillRect(18, 30, 28, 28);
      g.fillStyle = '#3a5518'; g.fillRect(18, 50, 28, 8);                                  // loincloth
      // head with volume
      const hd = g.createRadialGradient(26, 16, 3, 30, 22, 22); hd.addColorStop(0, '#88bd4e'); hd.addColorStop(1, '#4a731f');
      g.fillStyle = hd; g.beginPath(); g.ellipse(32, 20, 15, 14, 0, 0, Math.PI * 2); g.fill();
      // brow + red eyes
      g.fillStyle = '#3a5518'; g.fillRect(20, 15, 24, 3);
      ell(g, 26, 20, 3, 2.4, '#d94040'); ell(g, 38, 20, 3, 2.4, '#d94040');
      ell(g, 26, 20, 1.2, 1.2, '#ffd0d0'); ell(g, 38, 20, 1.2, 1.2, '#ffd0d0');
      // snout + tusks
      g.fillStyle = '#5a8a2c'; ell(g, 32, 27, 5, 3, '#5a8a2c');
      g.fillStyle = '#e8e0c8'; tri(g, [28, 28, 30, 34, 26, 30]); tri(g, [36, 28, 34, 34, 38, 30]);
      g.save(); g.globalAlpha = 0.4; g.fillStyle = '#2a3f12'; ell(g, 32, 60, 14, 2.5, '#2a3f12'); g.restore();
    }, 64);
    makeArt('wolf', g => {
      // body + haunches
      const bd = g.createLinearGradient(0, 24, 0, 52); bd.addColorStop(0, '#868c98'); bd.addColorStop(1, '#565b66');
      g.fillStyle = bd; g.beginPath(); g.ellipse(26, 40, 20, 12, 0, 0, Math.PI * 2); g.fill();
      // legs
      g.fillStyle = '#4d515c'; g.fillRect(14, 46, 5, 12); g.fillRect(24, 48, 5, 10); g.fillRect(36, 46, 5, 12);
      // head lowered, snarling
      const hd = g.createRadialGradient(44, 22, 2, 46, 28, 16); hd.addColorStop(0, '#9096a2'); hd.addColorStop(1, '#5a5f6a');
      g.fillStyle = hd; g.beginPath(); g.ellipse(46, 28, 13, 11, 0, 0, Math.PI * 2); g.fill();
      // ears
      g.fillStyle = '#5a5f6a'; tri(g, [40, 18, 36, 6, 46, 16]); tri(g, [54, 18, 58, 6, 48, 16]);
      // snout + fangs
      g.fillStyle = '#6a6f7a'; g.beginPath(); g.moveTo(52, 26); g.lineTo(64, 30); g.lineTo(52, 34); g.fill();
      g.fillStyle = '#f4f0e8'; tri(g, [56, 32, 58, 38, 54, 33]); tri(g, [60, 31, 61, 36, 57, 32]);
      // red eye
      ell(g, 44, 25, 2.4, 2, '#e04040'); ell(g, 44, 25, 1, 1, '#ffd0d0');
      // fur streaks
      g.save(); g.globalAlpha = 0.4; g.strokeStyle = '#3a3e48'; g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(14 + i * 6, 32); g.lineTo(16 + i * 6, 44); g.stroke(); } g.restore();
      g.save(); g.globalAlpha = 0.4; g.fillStyle = '#3a3e48'; ell(g, 30, 58, 18, 2.5, '#3a3e48'); g.restore();
    }, 64);
    makeArt('bear', g => {
      // hulking body
      const bd = g.createRadialGradient(28, 28, 4, 32, 36, 30); bd.addColorStop(0, '#7a5636'); bd.addColorStop(1, '#432d1a');
      g.fillStyle = bd; g.beginPath(); g.ellipse(32, 38, 22, 20, 0, 0, Math.PI * 2); g.fill();
      // legs + arms with claws
      g.fillStyle = '#3a2614'; g.fillRect(16, 50, 9, 12); g.fillRect(39, 50, 9, 12);
      g.fillStyle = '#e8e0d0'; for (const bx of [16, 20, 39, 43]) tri(g, [bx, 62, bx + 2, 58, bx + 4, 62]);
      // head
      const hd = g.createRadialGradient(28, 12, 2, 32, 18, 18); hd.addColorStop(0, '#8a6440'); hd.addColorStop(1, '#4a3018');
      g.fillStyle = hd; g.beginPath(); g.ellipse(32, 18, 14, 13, 0, 0, Math.PI * 2); g.fill();
      // ears
      ell(g, 22, 8, 4, 4, '#4a3018'); ell(g, 42, 8, 4, 4, '#4a3018');
      ell(g, 22, 8, 2, 2, '#6a4830'); ell(g, 42, 8, 2, 2, '#6a4830');
      // snout
      g.fillStyle = '#6a4830'; ell(g, 32, 24, 6, 4, '#6a4830');
      g.fillStyle = '#1a1008'; ell(g, 32, 22, 2.5, 2, '#1a1008');
      // small angry eyes
      ell(g, 27, 16, 1.8, 1.8, '#2a1a0e'); ell(g, 37, 16, 1.8, 1.8, '#2a1a0e');
      ell(g, 26.5, 15.5, 0.7, 0.7, '#ffffff'); ell(g, 36.5, 15.5, 0.7, 0.7, '#ffffff');
      g.save(); g.globalAlpha = 0.4; g.fillStyle = '#2a1c10'; ell(g, 32, 62, 22, 3, '#2a1c10'); g.restore();
    }, 64);
    makeArt('chest', g => {
      g.fillStyle = '#7a4a1e'; g.fillRect(4, 15, 24, 13);
      g.fillStyle = '#9a6428'; g.fillRect(4, 10, 24, 7);
      g.strokeStyle = '#3a2410'; g.lineWidth = 1; g.strokeRect(4.5, 10.5, 23, 17);
      g.fillStyle = '#d9a520'; g.fillRect(14, 10, 4, 18);
      ell(g, 16, 18, 2.4, 2.4, '#ffd75e');
    });
    makeArt('fountain', g => {
      ell(g, 16, 27, 13, 4.5, '#8a8f98');
      ell(g, 16, 26, 10, 3.2, '#4a86c8');
      g.fillStyle = '#8a8f98'; g.fillRect(14, 12, 4, 14);
      ell(g, 16, 12, 7, 2.5, '#9aa0aa');
      ell(g, 16, 11, 5, 1.8, '#6fb0e8');
      g.fillStyle = '#bfe0ff'; g.fillRect(12, 14, 1, 6); g.fillRect(19, 15, 1, 5);
    });

    // wilderness tree (billboard — you can see between them now), 64px
    makeArt('tree', g => {
      g.fillStyle = '#5b3a1e'; g.fillRect(28, 42, 8, 22);
      g.fillStyle = '#4a2f16'; g.fillRect(28, 42, 2, 22);
      g.fillStyle = '#6b4526'; g.fillRect(34, 42, 2, 22);
      ell(g, 32, 24, 22, 20, '#1e4d22');
      ell(g, 20, 18, 12, 10, '#2a5f2d');
      ell(g, 42, 16, 12, 10, '#2c6330');
      ell(g, 32, 32, 16, 10, '#255828');
      g.fillStyle = '#3a7a3a';
      for (let i = 0; i < 12; i++) g.fillRect(12 + rnd() * 40, 6 + rnd() * 30, 2, 2);
      g.fillStyle = '#173d1b';
      for (let i = 0; i < 8; i++) g.fillRect(14 + rnd() * 36, 12 + rnd() * 26, 3, 2);
    }, 64);

    // furniture & dressing
    makeArt('anvil', g => {
      g.fillStyle = '#6b4526'; g.fillRect(11, 24, 10, 6);
      g.fillStyle = '#3a3d44';
      g.fillRect(8, 12, 16, 4); g.fillRect(22, 12, 5, 3);
      g.fillRect(13, 16, 6, 5); g.fillRect(10, 21, 12, 3);
      g.fillStyle = '#5a5e66'; g.fillRect(8, 12, 16, 1);
    });
    makeArt('barrel', g => {
      ell(g, 16, 28, 9, 3, '#4a3418');
      g.fillStyle = '#8a6238'; g.fillRect(7, 8, 18, 20);
      ell(g, 16, 8, 9, 3, '#9a7248');
      g.fillStyle = '#7a5530'; g.fillRect(10, 8, 2, 20); g.fillRect(20, 8, 2, 20);
      g.fillStyle = '#3a3d44'; g.fillRect(7, 11, 18, 2); g.fillRect(7, 23, 18, 2);
    });
    makeArt('crate', g => {
      g.fillStyle = '#8a6238'; g.fillRect(6, 10, 20, 20);
      g.strokeStyle = '#4a3418'; g.lineWidth = 2;
      g.strokeRect(7, 11, 18, 18);
      g.beginPath(); g.moveTo(7, 11); g.lineTo(25, 29); g.moveTo(25, 11); g.lineTo(7, 29); g.stroke();
    });
    makeArt('smoke', g => {
      g.globalAlpha = 0.55;
      ell(g, 14, 24, 8, 6, '#b8bcc4');
      ell(g, 20, 15, 9, 7, '#c8ccd4');
      ell(g, 12, 8, 6, 5, '#d4d8de');
      g.globalAlpha = 1;
    });

    // pine tree (forest variety)
    makeArt('pine', g => {
      g.fillStyle = '#5b3a1e'; g.fillRect(29, 50, 6, 14);
      tri(g, [32, 2, 17, 24, 47, 24], '#1d4a24');
      tri(g, [32, 13, 13, 40, 51, 40], '#225530');
      tri(g, [32, 26, 9, 54, 55, 54], '#1e4d28');
      g.fillStyle = '#2e6338';
      for (let i = 0; i < 10; i++) g.fillRect(14 + rnd() * 36, 18 + rnd() * 32, 2, 2);
    }, 64);

    // Bram's masterwork blade, point-down in the earth
    makeArt('sword', g => {
      ell(g, 16, 4, 2.5, 2.5, '#d9a520');
      g.fillStyle = '#6b4526'; g.fillRect(14, 6, 4, 7);
      g.fillStyle = '#d9a520'; g.fillRect(9, 13, 14, 3);
      g.fillStyle = '#c8ccd4'; g.fillRect(14, 16, 4, 14);
      g.fillStyle = '#f0f2f6'; g.fillRect(14, 16, 2, 14);
    });

    // village props
    makeArt('well', g => {
      g.fillStyle = '#5a4028'; g.fillRect(6, 4, 2, 16); g.fillRect(24, 4, 2, 16); // posts
      tri(g, [3, 6, 16, 0, 29, 6], '#7a5530');                                    // little roof
      ell(g, 16, 24, 11, 6, '#8a8f98');                                           // stone ring
      ell(g, 16, 23, 8, 4, '#2a3038');                                            // dark shaft
      g.fillStyle = '#6a4a26'; g.fillRect(15, 6, 2, 12);                           // rope
      g.fillStyle = '#7a5530'; g.fillRect(12, 16, 8, 5);                           // bucket
    });
    makeArt('lamp', g => {
      g.fillStyle = '#3a3d44'; g.fillRect(14, 8, 4, 24);
      g.fillStyle = '#2a2d33'; g.fillRect(11, 30, 10, 2);
      g.fillStyle = '#ffd75e'; g.fillRect(12, 2, 8, 8);
      g.fillStyle = '#fff2b8'; g.fillRect(14, 4, 4, 4);
      g.fillStyle = '#3a3d44'; g.fillRect(11, 0, 10, 2); g.fillRect(11, 10, 10, 2);
    });

    // -- Eastmarch camp props --
    makeArt('campfire', g => {
      ell(g, 16, 27, 12, 4, '#4a4e56');                     // ring of stones (shadow)
      for (let i = 0; i < 7; i++) {                          // stone ring
        const a = i / 7 * Math.PI * 2;
        ell(g, 16 + Math.cos(a) * 11, 27 + Math.sin(a) * 3.5, 3, 2.2, '#9a9ea8');
      }
      g.fillStyle = '#4a3418';                               // crossed logs
      g.save(); g.translate(16, 24); g.rotate(0.5);
      g.fillRect(-11, -2, 22, 4); g.restore();
      g.save(); g.translate(16, 24); g.rotate(-0.5);
      g.fillStyle = '#5a4020'; g.fillRect(-11, -2, 22, 4); g.restore();
      ell(g, 11, 23, 2, 2, '#2a1c0e'); ell(g, 21, 25, 2, 2, '#2a1c0e'); // log ends
      ell(g, 16, 22, 6, 3, '#e07a20');                       // embers glow
      ell(g, 16, 22, 3, 1.6, '#ffc040');
    });
    // the flame — a decor sprite; R3D pulses its opacity for the flicker
    makeArt('flame', g => {
      tri(g, [16, 2, 8, 26, 24, 26], '#ff7418');
      tri(g, [16, 8, 10, 26, 22, 26], '#ffb020');
      tri(g, [16, 14, 12, 27, 20, 27], '#ffe268');
      ell(g, 16, 24, 3, 3, '#fff2b8');
    });
    // hunter's tent — hide stretched over a ridgepole
    makeArt('tent', g => {
      tri(g, [32, 8, 6, 56, 58, 56], '#6a5230');             // main canvas
      tri(g, [32, 8, 20, 56, 44, 56], '#463218');            // shaded doorway slit
      g.fillStyle = '#8a6c40';                                // lit left face
      tri(g, [32, 8, 6, 56, 20, 56], '#7a5e38');
      g.strokeStyle = '#2a1e10'; g.lineWidth = 2;             // ridgepole overhang
      g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 12); g.stroke();
      g.fillStyle = '#3a2a16'; g.fillRect(4, 55, 56, 3);      // ground line
    }, 64);

    // -- villagers --
    makeArt('innkeep', g => {
      g.fillStyle = '#7a4a3a'; g.fillRect(9, 14, 14, 16);   // dress
      g.fillStyle = '#e8e4da'; g.fillRect(11, 18, 10, 12);  // apron
      ell(g, 16, 10, 5.5, 5.5, '#e8c39e');
      ell(g, 16, 5.5, 4, 3, '#a8763a');                     // hair bun
      g.fillStyle = '#a8763a'; g.fillRect(10.5, 8, 3, 5); g.fillRect(18.5, 8, 3, 5);
    });
    makeArt('elder', g => {
      g.fillStyle = '#7a7490'; g.fillRect(10, 14, 12, 16);
      tri(g, [8, 30, 16, 12, 24, 30], '#7a7490');
      ell(g, 16, 10, 5.5, 5.5, '#e8c39e');
      ell(g, 16, 6.5, 5.5, 3, '#e8e4da');
      g.fillStyle = '#d8d4ca'; g.fillRect(13, 13, 6, 6);
      g.fillStyle = '#6a4a26'; g.fillRect(26, 6, 2, 24);
      ell(g, 27, 5, 2.5, 2.5, '#3ecfb0');
    });
    makeArt('smith', g => {
      g.fillStyle = '#4a3527'; g.fillRect(9, 14, 14, 16);
      g.fillStyle = '#8a5a2a'; g.fillRect(11, 17, 10, 12);
      ell(g, 16, 9.5, 6, 6, '#d8a878');
      g.fillStyle = '#3a2a1a'; g.fillRect(11, 11, 10, 4); g.fillRect(12, 4, 8, 3);
      g.fillStyle = '#6a4a26'; g.fillRect(4, 16, 2, 13);
      g.fillStyle = '#9aa0aa'; g.fillRect(1, 13, 8, 4);
    });
    makeArt('child', g => {
      g.fillStyle = '#b05a7a'; g.fillRect(11, 18, 10, 11);
      tri(g, [9, 29, 16, 18, 23, 29], '#b05a7a');
      ell(g, 16, 13.5, 5, 5, '#e8c39e');
      ell(g, 16, 10.5, 5, 2.5, '#c87830');
      ell(g, 10, 13, 2, 3, '#c87830');
      ell(g, 22, 13, 2, 3, '#c87830');
    });
    makeArt('merchant', g => {
      g.fillStyle = '#6a4a8a'; g.fillRect(10, 15, 12, 15);
      ell(g, 16, 11, 5.5, 5.5, '#e8c39e');
      ell(g, 16, 6.5, 8, 2.5, '#4a3527');
      g.fillStyle = '#4a3527'; g.fillRect(12, 2, 8, 5);
      ell(g, 25, 24, 3.5, 4, '#d9a520');
    });
    makeArt('marta', g => {
      g.fillStyle = '#4d5b3a'; g.fillRect(9, 14, 14, 16);     // green huntress coat
      g.fillStyle = '#6b5a3a'; tri(g, [7, 30, 16, 13, 25, 30], '#6b5a3a'); // fur mantle
      ell(g, 16, 9.5, 5.5, 5.5, '#d8a878');
      tri(g, [9, 11, 16, 1, 23, 11], '#3a4a28');              // hood
      g.fillStyle = '#7a6038'; g.fillRect(12, 12, 8, 3);      // hair fringe
      g.strokeStyle = '#5a4026'; g.lineWidth = 2;             // slung bow
      g.beginPath(); g.arc(25, 18, 9, -1.1, 1.1); g.stroke();
      g.strokeStyle = '#d8d4ca'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(25, 9.2); g.lineTo(25, 26.8); g.stroke();
    });

    // ================= MM7-style UI art =================

    // stone frame + parchment (or dark leather) field
    const paintPanel = (g, w, h, dark) => {
      if (dark) {
        g.fillStyle = '#2e2a22'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < w * h / 260; i++) {
          g.fillStyle = rnd() < 0.5 ? '#282419' : '#35302a';
          g.fillRect(rnd() * (w - 8), rnd() * (h - 5), 4 + rnd() * 7, 2 + rnd() * 4);
        }
      } else {
        g.fillStyle = '#c9b184'; g.fillRect(0, 0, w, h);
        const tones = ['#c2a878', '#d0ba8e', '#bfa678', '#cbb488'];
        for (let i = 0; i < w * h / 220; i++) {
          g.fillStyle = tones[(rnd() * tones.length) | 0];
          g.fillRect(rnd() * (w - 10), rnd() * (h - 6), 5 + rnd() * 9, 2 + rnd() * 5);
        }
      }
      const F = 14; // stone frame
      g.fillStyle = '#4e525c';
      g.fillRect(0, 0, w, F); g.fillRect(0, h - F, w, F);
      g.fillRect(0, 0, F, h); g.fillRect(w - F, 0, F, h);
      g.fillStyle = '#6a6f7a'; // lit bevel
      g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
      g.fillStyle = '#33363e'; // shadow bevel
      g.fillRect(0, h - 3, w, 3); g.fillRect(w - 3, 0, 3, h);
      for (let i = 0; i < (w + h) / 30; i++) { // stone cracks
        g.fillStyle = '#43474f';
        const side = rnd() < 0.5;
        g.fillRect(side ? rnd() * w : (rnd() < 0.5 ? 2 : w - F + 2), side ? (rnd() < 0.5 ? 3 : h - F + 3) : rnd() * h, side ? 8 : 2, side ? 2 : 8);
      }
      g.strokeStyle = '#c9a227'; g.lineWidth = 2; // gold trim
      g.strokeRect(F + 2, F + 2, w - 2 * F - 4, h - 2 * F - 4);
      for (const [cx, cy] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) {
        ell(g, cx, cy, 4, 4, '#c9a227');
        ell(g, cx - 1, cy - 1, 1.5, 1.5, '#f0d060');
      }
    };
    makeArtWH('panel_ui', 780, 470, (g, w, h) => paintPanel(g, w, h, false));
    makeArtWH('panel_hud', 960, 130, (g, w, h) => {
      paintPanel(g, w, h, true);
      g.fillStyle = '#4e525c'; // divider columns between hero sections
      for (let i = 1; i < 4; i++) g.fillRect(i * 236 + 4, 8, 4, h - 16);
    });
    makeArtWH('slot', 40, 40, g => {
      g.fillStyle = '#4a4032'; g.fillRect(0, 0, 40, 40);
      g.fillStyle = '#3a3226'; g.fillRect(2, 2, 36, 36);
      g.fillStyle = '#2e281e'; g.fillRect(2, 2, 36, 3); g.fillRect(2, 2, 3, 36);
      g.fillStyle = '#5a4e3a'; g.fillRect(2, 35, 36, 3); g.fillRect(35, 2, 3, 36);
    });

    // ---- painterly portrait kit (128px): gradient-shaded faces with real
    // eyes, rim light and volumetric hair. Every party + villager face uses it.
    // Override any painter with a real PNG via assets/manifest.json.
    const disc = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    const oval = (g, x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };

    const paintEye = (g, x, y, o) => {
      g.save();
      g.globalAlpha = 0.35; oval(g, x, y + 1.5, 8, 5.5, o.skinShadow); g.globalAlpha = 1; // socket
      oval(g, x, y, 6.5, 4.4, '#f4efe4');                     // sclera
      g.fillStyle = 'rgba(120,90,70,0.25)'; g.beginPath(); g.ellipse(x, y - 1, 6.5, 3, 0, Math.PI, 0); g.fill();
      disc(g, x, y + 0.4, 3.3, o.eye);                        // iris
      disc(g, x, y + 0.4, 1.7, '#161018');                   // pupil
      disc(g, x - 1.3, y - 1, 1.1, '#ffffff');               // catchlight
      g.strokeStyle = o.lid; g.lineWidth = 2; g.lineCap = 'round'; // upper lid
      g.beginPath(); g.moveTo(x - 7, y - 2.5); g.quadraticCurveTo(x, y - 6, x + 7, y - 2.5); g.stroke();
      g.restore();
    };

    const paintPortrait = (g, o) => {
      const W = 128, H = 128, fx = 64, fy = 76, rx = 31, ry = 37;
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, o.bg1); bg.addColorStop(1, o.bg0);
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(64, 64, 6, 64, 70, 70);
      glow.addColorStop(0, o.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      if (o.shoulders) o.shoulders(g);
      // neck
      g.fillStyle = o.skinShadow; g.fillRect(53, 100, 22, 20);
      g.globalAlpha = 0.4; g.fillStyle = '#000'; g.fillRect(53, 100, 22, 6); g.globalAlpha = 1;
      // face volume via radial gradient (light upper-left → shadow lower-right)
      const fg = g.createRadialGradient(fx - 11, fy - 14, 5, fx, fy, 44);
      fg.addColorStop(0, o.skinLight); fg.addColorStop(0.55, o.skin); fg.addColorStop(1, o.skinShadow);
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(fx - rx, fy - 6);
      g.bezierCurveTo(fx - rx, fy - ry, fx + rx, fy - ry, fx + rx, fy - 6);
      g.bezierCurveTo(fx + rx, fy + ry - 6, fx + 12, fy + ry + 4, fx, fy + ry + 6);
      g.bezierCurveTo(fx - 12, fy + ry + 4, fx - rx, fy + ry - 6, fx - rx, fy - 6);
      g.fill();
      // cheek blush
      g.save(); g.globalAlpha = 0.22; disc(g, 48, 86, 8, o.blush); disc(g, 80, 86, 8, o.blush); g.restore();
      // rim light down the shadow edge
      g.save(); g.globalAlpha = 0.55; g.strokeStyle = o.rim; g.lineWidth = 3;
      g.beginPath(); g.ellipse(fx, fy, rx, ry, 0, -0.5, 1.0); g.stroke(); g.restore();
      // brows
      g.strokeStyle = o.brow; g.lineWidth = 3.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(44, 64); g.quadraticCurveTo(53, 60 + (o.brY || 0), 62, 64); g.stroke();
      g.beginPath(); g.moveTo(66, 64); g.quadraticCurveTo(75, 60 + (o.brY || 0), 84, 64); g.stroke();
      paintEye(g, 53, 72, o); paintEye(g, 75, 72, o);
      // nose: shadow on one side, lit bridge
      g.save(); g.globalAlpha = 0.4; g.fillStyle = o.skinShadow;
      g.beginPath(); g.moveTo(64, 74); g.lineTo(59, 90); g.lineTo(66, 90); g.closePath(); g.fill(); g.restore();
      g.fillStyle = o.skinLight; g.globalAlpha = 0.7; g.fillRect(63, 76, 2.5, 13); g.globalAlpha = 1;
      disc(g, 61, 90, 1.6, o.skinShadow); disc(g, 67, 90, 1.6, o.skinShadow); // nostrils
      // mouth
      g.strokeStyle = o.mouth; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(56, 99); g.quadraticCurveTo(64, o.smile ? 104 : 100.5, 72, 99); g.stroke();
      if (o.smile) { g.globalAlpha = 0.3; g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(58, 100); g.quadraticCurveTo(64, 103, 70, 100); g.stroke(); g.globalAlpha = 1; }
      if (o.hair) o.hair(g);
      if (o.head) o.head(g);
      if (o.extra) o.extra(g);
    };

    // strand-textured hair mass; drawShape fills the silhouette, then streaks
    const hairMass = (g, drawShape, base, dark, light) => {
      g.fillStyle = base; drawShape(g);
      g.save(); g.beginPath(); drawShape(g); g.clip();
      g.lineWidth = 2; g.lineCap = 'round';
      let s = 20;
      const r = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
      for (let i = 0; i < 34; i++) {
        g.strokeStyle = r() < 0.5 ? dark : light;
        const x = 20 + r() * 88, y = 6 + r() * 60;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 10, y + 12, x + (r() - 0.5) * 8, y + 26); g.stroke();
      }
      g.restore();
    };

    // -- party portraits --
    makeArtWH('pt_roderick', 128, 128, g => paintPortrait(g, {
      bg0: '#1a1e28', bg1: '#2c3446', glow: 'rgba(120,140,180,0.5)',
      skin: '#d9a878', skinLight: '#f0c99e', skinShadow: '#a97c52', blush: '#d06848',
      eye: '#5a7a5a', lid: '#7a5638', brow: '#5a3f28', mouth: '#8a5040', rim: '#cfe0ff',
      shoulders: g2 => { g2.fillStyle = '#5a616e'; g2.fillRect(8, 104, 112, 24); g2.fillStyle = '#454b56'; g2.fillRect(8, 104, 112, 5); g2.fillStyle = '#787f8c'; g2.fillRect(20, 108, 88, 3); },
      hair: g2 => { g2.fillStyle = '#5a3f28'; g2.beginPath(); g2.moveTo(30, 96); g2.lineTo(34, 108); g2.lineTo(50, 106); g2.lineTo(46, 92); g2.fill(); g2.beginPath(); g2.moveTo(98, 96); g2.lineTo(94, 108); g2.lineTo(78, 106); g2.lineTo(82, 92); g2.fill(); },
      head: g2 => {
        // steel great-helm: dome + brow band + nasal guard
        const hg = g2.createLinearGradient(0, 20, 0, 62); hg.addColorStop(0, '#b3b9c4'); hg.addColorStop(1, '#767d8a');
        g2.fillStyle = hg;
        g2.beginPath(); g2.moveTo(30, 58); g2.bezierCurveTo(28, 18, 100, 18, 98, 58); g2.lineTo(92, 58); g2.bezierCurveTo(92, 30, 36, 30, 36, 58); g2.closePath(); g2.fill();
        g2.fillStyle = '#8d9099'; g2.fillRect(30, 54, 68, 8);
        g2.fillStyle = '#c8ccd4'; g2.fillRect(30, 54, 68, 2);
        g2.fillStyle = '#767d8a'; g2.fillRect(61, 58, 6, 26);      // nasal guard
        g2.fillStyle = '#aeb4bf'; g2.fillRect(61, 58, 2, 26);
        disc(g2, 64, 26, 3, '#d0b040');                            // crest stud
      },
      extra: g2 => { g2.fillStyle = '#5a3f28'; g2.beginPath(); g2.moveTo(46, 92); g2.quadraticCurveTo(64, 122, 82, 92); g2.quadraticCurveTo(64, 104, 46, 92); g2.fill(); }, // beard
    }));

    makeArtWH('pt_wren', 128, 128, g => paintPortrait(g, {
      bg0: '#161f16', bg1: '#26361f', glow: 'rgba(150,180,110,0.45)',
      skin: '#d6a476', skinLight: '#eec39a', skinShadow: '#a6754e', blush: '#cc6a4a',
      eye: '#6a8f4a', lid: '#6a4a30', brow: '#4a3420', mouth: '#8a5040', rim: '#e0f0c0', smile: 1, brY: -1,
      shoulders: g2 => { g2.fillStyle = '#3c5c34'; g2.fillRect(6, 104, 116, 24); g2.fillStyle = '#2e4828'; g2.fillRect(6, 104, 116, 5); },
      hair: g2 => hairMass(g2, gg => { gg.beginPath(); gg.moveTo(34, 60); gg.quadraticCurveTo(30, 96, 44, 110); gg.lineTo(52, 104); gg.quadraticCurveTo(40, 84, 44, 56); gg.fill(); gg.beginPath(); gg.moveTo(94, 60); gg.quadraticCurveTo(98, 96, 84, 110); gg.lineTo(76, 104); gg.quadraticCurveTo(88, 84, 84, 56); gg.fill(); }, '#6a4a28', '#4a3018', '#8a6636'),
      head: g2 => {
        // green hood
        g2.fillStyle = '#3c5c34';
        g2.beginPath(); g2.moveTo(28, 66); g2.bezierCurveTo(24, 14, 104, 14, 100, 66); g2.lineTo(88, 66); g2.bezierCurveTo(90, 34, 38, 34, 40, 66); g2.closePath(); g2.fill();
        g2.fillStyle = '#4d7042'; g2.beginPath(); g2.moveTo(30, 58); g2.bezierCurveTo(26, 14, 102, 14, 98, 58); g2.lineTo(90, 56); g2.bezierCurveTo(92, 26, 36, 26, 38, 56); g2.closePath(); g2.fill();
        g2.fillStyle = '#2e4828'; g2.beginPath(); g2.moveTo(38, 56); g2.quadraticCurveTo(64, 64, 90, 56); g2.lineTo(90, 50); g2.quadraticCurveTo(64, 58, 38, 50); g2.fill(); // inner-hood shadow at the hairline
        g2.fillStyle = '#d0b040'; g2.beginPath(); g2.moveTo(94, 18); g2.lineTo(106, 42); g2.lineTo(98, 40); g2.closePath(); g2.fill(); // feather
      },
    }));

    makeArtWH('pt_serena', 128, 128, g => paintPortrait(g, {
      bg0: '#241f30', bg1: '#3a3552', glow: 'rgba(150,150,220,0.5)',
      skin: '#eec19a', skinLight: '#fadcbb', skinShadow: '#c2916a', blush: '#e07a68',
      eye: '#5a86c8', lid: '#b08850', brow: '#a07838', mouth: '#c26a5a', rim: '#fff0d0', smile: 1,
      shoulders: g2 => { g2.fillStyle = '#eae5da'; g2.fillRect(8, 104, 112, 24); g2.fillStyle = '#d0c9ba'; g2.fillRect(8, 104, 112, 5); g2.fillStyle = '#c9a227'; g2.fillRect(56, 108, 16, 20); },
      hair: g2 => hairMass(g2, gg => { gg.beginPath(); gg.moveTo(30, 52); gg.bezierCurveTo(20, 100, 34, 122, 46, 118); gg.lineTo(52, 104); gg.quadraticCurveTo(36, 88, 40, 50); gg.fill(); gg.beginPath(); gg.moveTo(98, 52); gg.bezierCurveTo(108, 100, 94, 122, 82, 118); gg.lineTo(76, 104); gg.quadraticCurveTo(92, 88, 88, 50); gg.fill(); gg.beginPath(); gg.ellipse(64, 44, 34, 22, 0, Math.PI, 0); gg.fill(); }, '#d9c26a', '#b89a44', '#f0dc94'),
      head: g2 => {
        g2.strokeStyle = '#c9a227'; g2.lineWidth = 4; g2.lineCap = 'round';   // circlet
        g2.beginPath(); g2.moveTo(36, 50); g2.quadraticCurveTo(64, 40, 92, 50); g2.stroke();
        g2.strokeStyle = '#f0dc94'; g2.lineWidth = 1.5; g2.beginPath(); g2.moveTo(36, 49); g2.quadraticCurveTo(64, 39, 92, 49); g2.stroke();
        disc(g2, 64, 44, 4, '#6fb0e8'); disc(g2, 62.5, 42.5, 1.5, '#d8f0ff');
      },
    }));

    makeArtWH('pt_malwick', 128, 128, g => paintPortrait(g, {
      bg0: '#1e1a2c', bg1: '#332a4c', glow: 'rgba(150,110,200,0.5)',
      skin: '#dcbc98', skinLight: '#f2d6b4', skinShadow: '#ab8a66', blush: '#c07858',
      eye: '#7a5aa8', lid: '#8a8f98', brow: '#c4c8d0', mouth: '#9a6858', brY: 1,
      shoulders: g2 => { g2.fillStyle = '#4a3a6a'; g2.fillRect(8, 104, 112, 24); g2.fillStyle = '#372a52'; g2.fillRect(8, 104, 112, 5); g2.fillStyle = '#6a4a98'; g2.fillRect(20, 110, 88, 2); },
      extra: g2 => {
        // long grey beard over the mouth/chin
        g2.fillStyle = '#c4c8d0';
        g2.beginPath(); g2.moveTo(46, 88); g2.quadraticCurveTo(48, 124, 64, 128); g2.quadraticCurveTo(80, 124, 82, 88); g2.quadraticCurveTo(64, 100, 46, 88); g2.fill();
        g2.strokeStyle = '#a6abb5'; g2.lineWidth = 1.4;
        for (let i = 0; i < 6; i++) { g2.beginPath(); g2.moveTo(52 + i * 4, 92); g2.lineTo(53 + i * 4, 120); g2.stroke(); }
        g2.fillStyle = '#e4e8ee'; g2.beginPath(); g2.moveTo(58, 90); g2.quadraticCurveTo(64, 96, 70, 90); g2.quadraticCurveTo(64, 92, 58, 90); g2.fill(); // moustache
      },
      head: g2 => {
        // tall wizard hat, slightly slumped
        const hg = g2.createLinearGradient(20, 0, 80, 46); hg.addColorStop(0, '#4a3078'); hg.addColorStop(1, '#6a4a98');
        g2.fillStyle = hg;
        g2.beginPath(); g2.moveTo(28, 50); g2.quadraticCurveTo(30, 46, 96, 50); g2.quadraticCurveTo(88, 44, 74, 4); g2.quadraticCurveTo(70, -2, 60, 8); g2.quadraticCurveTo(40, 30, 28, 50); g2.fill();
        g2.fillStyle = '#372457'; g2.beginPath(); g2.ellipse(62, 50, 40, 8, 0, 0, Math.PI * 2); g2.fill();
        g2.fillStyle = '#5a4088'; g2.fillRect(24, 46, 76, 6);
        // gold stars
        g2.fillStyle = '#f0d060';
        [[54, 20, 3], [66, 34, 2], [46, 36, 2]].forEach(([x, y, r]) => { g2.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.8; g2.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g2.closePath(); g2.fill(); });
      },
    }));

    // -- villager dialogue faces (face_<id>) --
    makeArtWH('face_maren', 128, 128, g => paintPortrait(g, {
      bg0: '#1c2420', bg1: '#33443a', glow: 'rgba(150,190,160,0.4)',
      skin: '#e6c4a2', skinLight: '#f6dcc0', skinShadow: '#bd977a', blush: '#cc8878',
      eye: '#6a8a70', lid: '#b0a890', brow: '#d8d8d0', mouth: '#b07868', smile: 1, brY: 1,
      shoulders: g2 => { g2.fillStyle = '#4a6a52'; g2.fillRect(6, 104, 116, 24); g2.fillStyle = '#39543f'; g2.fillRect(6, 104, 116, 5); g2.fillStyle = '#c9a227'; disc(g2, 64, 112, 4, '#c9a227'); },
      hair: g2 => hairMass(g2, gg => { gg.beginPath(); gg.moveTo(28, 54); gg.bezierCurveTo(18, 104, 36, 120, 48, 116); gg.lineTo(52, 100); gg.quadraticCurveTo(38, 84, 42, 50); gg.fill(); gg.beginPath(); gg.moveTo(100, 54); gg.bezierCurveTo(110, 104, 92, 120, 80, 116); gg.lineTo(76, 100); gg.quadraticCurveTo(90, 84, 86, 50); gg.fill(); gg.beginPath(); gg.ellipse(64, 46, 36, 22, 0, Math.PI, 0); gg.fill(); }, '#e0e0da', '#c2c2ba', '#f4f4ee'),
      head: g2 => { g2.fillStyle = '#4a6a52'; g2.beginPath(); g2.moveTo(26, 60); g2.bezierCurveTo(22, 20, 106, 20, 102, 60); g2.lineTo(94, 58); g2.bezierCurveTo(96, 32, 32, 32, 34, 58); g2.closePath(); g2.fill(); },
      extra: g2 => { g2.save(); g2.globalAlpha = 0.3; g2.strokeStyle = '#a6866a'; g2.lineWidth = 1.4; g2.lineCap = 'round'; // age lines
        g2.beginPath(); g2.moveTo(44, 66); g2.lineTo(48, 68); g2.moveTo(80, 66); g2.lineTo(84, 68); g2.moveTo(50, 92); g2.quadraticCurveTo(64, 96, 78, 92); g2.stroke(); g2.restore(); },
    }));

    makeArtWH('face_bram', 128, 128, g => paintPortrait(g, {
      bg0: '#2a1c18', bg1: '#48342a', glow: 'rgba(220,140,80,0.4)',
      skin: '#cf9a6e', skinLight: '#ecbb8c', skinShadow: '#9c6c46', blush: '#c25e3e',
      eye: '#5a4a38', lid: '#5a3a22', brow: '#2e1c12', mouth: '#7a4030', smile: 1,
      shoulders: g2 => { g2.fillStyle = '#4a3527'; g2.fillRect(4, 102, 120, 26); g2.fillStyle = '#8a5a2a'; g2.fillRect(50, 104, 28, 24); g2.fillStyle = '#3a2a1a'; g2.fillRect(4, 102, 120, 5); },
      hair: g2 => { g2.fillStyle = '#2e1c12'; g2.beginPath(); g2.moveTo(32, 56); g2.quadraticCurveTo(30, 40, 46, 40); g2.quadraticCurveTo(64, 34, 82, 40); g2.quadraticCurveTo(98, 40, 96, 56); g2.quadraticCurveTo(80, 48, 64, 48); g2.quadraticCurveTo(48, 48, 32, 56); g2.fill(); },
      extra: g2 => {
        // big black beard
        g2.fillStyle = '#2e1c12';
        g2.beginPath(); g2.moveTo(38, 80); g2.quadraticCurveTo(34, 126, 64, 128); g2.quadraticCurveTo(94, 126, 90, 80); g2.quadraticCurveTo(64, 96, 38, 80); g2.fill();
        g2.strokeStyle = '#1a0f08'; g2.lineWidth = 1.4;
        for (let i = 0; i < 7; i++) { g2.beginPath(); g2.moveTo(46 + i * 5, 88); g2.lineTo(47 + i * 5, 122); g2.stroke(); }
        g2.fillStyle = '#2e1c12'; g2.fillRect(54, 88, 20, 8); // moustache
        g2.save(); g2.globalAlpha = 0.25; disc(g2, 82, 78, 6, '#4a4a4a'); g2.restore(); // soot smudge
      },
    }));

    makeArtWH('face_tilly', 128, 128, g => paintPortrait(g, {
      bg0: '#2a2418', bg1: '#4a4228', glow: 'rgba(240,210,120,0.45)',
      skin: '#f2cba0', skinLight: '#ffe4c2', skinShadow: '#cf9e72', blush: '#f07a68',
      eye: '#4a86c8', lid: '#c89858', brow: '#c88838', mouth: '#e07868', smile: 1, brY: -2,
      shoulders: g2 => { g2.fillStyle = '#b05a7a'; g2.fillRect(10, 106, 108, 22); g2.fillStyle = '#8e4460'; g2.fillRect(10, 106, 108, 5); },
      hair: g2 => hairMass(g2, gg => { gg.beginPath(); gg.ellipse(64, 46, 34, 22, 0, Math.PI, 0); gg.fill(); gg.beginPath(); gg.ellipse(30, 74, 12, 18, 0, 0, Math.PI * 2); gg.fill(); gg.beginPath(); gg.ellipse(98, 74, 12, 18, 0, 0, Math.PI * 2); gg.fill(); }, '#e0b040', '#c08820', '#f8d868'),
      extra: g2 => { g2.fillStyle = '#d88850'; g2.save(); g2.globalAlpha = 0.6; // freckles
        [[46, 84], [50, 88], [54, 85], [78, 85], [82, 88], [86, 84]].forEach(([x, y]) => disc(g2, x, y, 1.3, '#c87848')); g2.restore();
        g2.fillStyle = '#f8d868'; g2.fillRect(24, 60, 6, 4); g2.fillRect(98, 60, 6, 4); }, // ribbon bits
    }));

    makeArtWH('face_odo', 128, 128, g => paintPortrait(g, {
      bg0: '#241f2a', bg1: '#3e3546', glow: 'rgba(180,150,120,0.4)',
      skin: '#d8a878', skinLight: '#eec69a', skinShadow: '#a87c52', blush: '#c06848',
      eye: '#7a6a4a', lid: '#7a5638', brow: '#4a3420', mouth: '#8a5040', smile: 1,
      shoulders: g2 => { g2.fillStyle = '#6a4a8a'; g2.fillRect(8, 104, 112, 24); g2.fillStyle = '#523970'; g2.fillRect(8, 104, 112, 5); g2.fillStyle = '#d0b040'; disc(g2, 64, 114, 3, '#d0b040'); },
      hair: g2 => { g2.fillStyle = '#5a4028'; g2.beginPath(); g2.moveTo(34, 58); g2.quadraticCurveTo(38, 48, 50, 50); g2.lineTo(48, 58); g2.fill(); g2.beginPath(); g2.moveTo(94, 58); g2.quadraticCurveTo(90, 48, 78, 50); g2.lineTo(80, 58); g2.fill(); },
      head: g2 => {
        g2.fillStyle = '#5a2a3a'; g2.beginPath(); g2.moveTo(28, 54); g2.quadraticCurveTo(30, 34, 64, 32); g2.quadraticCurveTo(98, 34, 100, 54); g2.quadraticCurveTo(64, 46, 28, 54); g2.fill(); // cap
        g2.fillStyle = '#6e3648'; g2.beginPath(); g2.ellipse(64, 54, 38, 8, 0, 0, Math.PI * 2); g2.fill();
        g2.fillStyle = '#e0c050'; g2.beginPath(); g2.moveTo(90, 30); g2.lineTo(108, 48); g2.lineTo(94, 46); g2.closePath(); g2.fill(); // feather
      },
      extra: g2 => { g2.strokeStyle = '#4a3420'; g2.lineWidth = 2.4; g2.lineCap = 'round'; // thin moustache
        g2.beginPath(); g2.moveTo(64, 92); g2.quadraticCurveTo(54, 90, 48, 94); g2.moveTo(64, 92); g2.quadraticCurveTo(74, 90, 80, 94); g2.stroke(); },
    }));

    makeArtWH('face_hilda', 128, 128, g => paintPortrait(g, {
      bg0: '#2a2018', bg1: '#463628', glow: 'rgba(220,170,110,0.4)',
      skin: '#eab890', skinLight: '#f8d4ac', skinShadow: '#c28a62', blush: '#e07858',
      eye: '#7a5a3a', lid: '#b07848', brow: '#8a5828', mouth: '#c26858', smile: 1,
      shoulders: g2 => { g2.fillStyle = '#7a4a3a'; g2.fillRect(6, 104, 116, 24); g2.fillStyle = '#e8e4da'; g2.fillRect(46, 104, 36, 24); g2.fillStyle = '#5e382c'; g2.fillRect(6, 104, 116, 5); },
      hair: g2 => hairMass(g2, gg => { gg.beginPath(); gg.moveTo(30, 60); gg.quadraticCurveTo(24, 40, 64, 36); gg.quadraticCurveTo(104, 40, 98, 60); gg.quadraticCurveTo(64, 50, 30, 60); gg.fill(); gg.beginPath(); gg.ellipse(64, 34, 16, 12, 0, 0, Math.PI * 2); gg.fill(); }, '#a8763a', '#89592a', '#c89658'),
    }));

    makeArtWH('face_marta', 128, 128, g => paintPortrait(g, {
      bg0: '#1e2420', bg1: '#34423a', glow: 'rgba(160,180,150,0.35)',
      skin: '#cc9c72', skinLight: '#e6bd92', skinShadow: '#9a6e4a', blush: '#bc6244',
      eye: '#8a8a6a', lid: '#6a4a30', brow: '#3a2a1a', mouth: '#7a4838', brY: 1,
      shoulders: g2 => { g2.fillStyle = '#5a4a38'; g2.fillRect(6, 104, 116, 24); g2.fillStyle = '#7a6248'; g2.fillRect(6, 104, 116, 8); g2.fillStyle = '#3a2e20'; g2.fillRect(6, 112, 116, 3); },
      hair: g2 => hairMass(g2, gg => { gg.beginPath(); gg.moveTo(32, 58); gg.quadraticCurveTo(28, 84, 40, 104); gg.lineTo(50, 100); gg.quadraticCurveTo(40, 82, 44, 56); gg.fill(); }, '#4a3826', '#33261a', '#665038'),
      head: g2 => { // fur-trimmed hood
        g2.fillStyle = '#7a6248'; g2.beginPath(); g2.moveTo(24, 64); g2.bezierCurveTo(20, 14, 108, 14, 104, 64); g2.lineTo(94, 62); g2.bezierCurveTo(96, 30, 32, 30, 34, 62); g2.closePath(); g2.fill();
        g2.strokeStyle = '#c4b498'; g2.lineWidth = 7; g2.lineCap = 'round'; g2.beginPath(); g2.moveTo(30, 58); g2.bezierCurveTo(26, 20, 102, 20, 98, 58); g2.stroke();
        g2.save(); g2.globalAlpha = 0.5; g2.strokeStyle = '#8a7a5e'; g2.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = Math.PI + i * Math.PI / 11; g2.beginPath(); g2.moveTo(64 + Math.cos(a) * 40, 40 + Math.sin(a) * 30); g2.lineTo(64 + Math.cos(a) * 46, 40 + Math.sin(a) * 34); g2.stroke(); } g2.restore();
      },
      extra: g2 => { g2.strokeStyle = '#a86a56'; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(82, 60); g2.lineTo(86, 78); g2.stroke(); }, // scar
    }));

    makeArtWH('face_xarthax', 128, 128, g => paintPortrait(g, {
      bg0: '#201a30', bg1: '#3a2c5a', glow: 'rgba(120,200,180,0.45)',
      skin: '#dcbc98', skinLight: '#f2d6b4', skinShadow: '#a88a66', blush: '#c06858',
      eye: '#3ecfb0', lid: '#8a8f98', brow: '#dadfe4', mouth: '#9a6858', smile: 1, brY: -2,
      shoulders: g2 => { g2.fillStyle = '#3a2a5a'; g2.fillRect(8, 104, 112, 24); g2.fillStyle = '#2a1e46'; g2.fillRect(8, 104, 112, 5); g2.fillStyle = '#d0b040'; [[30, 116], [64, 120], [98, 116]].forEach(([x, y]) => disc(g2, x, y, 2, '#d0b040')); },
      hair: g2 => hairMass(g2, gg => { gg.beginPath(); gg.moveTo(28, 56); gg.quadraticCurveTo(10, 40, 24, 22); gg.quadraticCurveTo(40, 34, 44, 50); gg.fill(); gg.beginPath(); gg.moveTo(100, 56); gg.quadraticCurveTo(118, 40, 104, 22); gg.quadraticCurveTo(88, 34, 84, 50); gg.fill(); gg.beginPath(); gg.moveTo(40, 44); gg.quadraticCurveTo(64, 20, 88, 44); gg.quadraticCurveTo(64, 34, 40, 44); gg.fill(); }, '#dadfe4', '#b8bec6', '#f2f4f8'),
      head: g2 => { // brass goggles pushed up on the forehead
        g2.strokeStyle = '#8a6a2a'; g2.lineWidth = 3; g2.beginPath(); g2.moveTo(40, 52); g2.lineTo(88, 52); g2.stroke();
        g2.fillStyle = '#b8912a'; disc(g2, 48, 52, 8, '#b8912a'); disc(g2, 80, 52, 8, '#b8912a');
        g2.fillStyle = '#3ecfb0'; disc(g2, 48, 52, 5, '#2a8a78'); disc(g2, 80, 52, 5, '#2a8a78');
        g2.fillStyle = '#7effe0'; disc(g2, 46, 50, 1.6, '#7effe0'); disc(g2, 78, 50, 1.6, '#7effe0');
      },
    }));

    // -- item icons, 32px --
    makeArt('it_sword', g => {
      g.fillStyle = '#c8ccd4'; g.save(); g.translate(16, 16); g.rotate(-Math.PI / 4);
      g.fillRect(-2, -13, 4, 20); g.fillStyle = '#f0f2f6'; g.fillRect(-2, -13, 2, 20);
      g.fillStyle = '#c9a227'; g.fillRect(-6, 7, 12, 3); g.fillStyle = '#6b4526'; g.fillRect(-1.5, 10, 3, 6);
      g.restore();
    });
    makeArt('it_bsword', g => {
      g.fillStyle = '#9aa2b0'; g.save(); g.translate(16, 16); g.rotate(-Math.PI / 4);
      g.fillRect(-3, -14, 6, 22); g.fillStyle = '#c8ccd4'; g.fillRect(-3, -14, 3, 22);
      g.fillStyle = '#c9a227'; g.fillRect(-8, 8, 16, 3); g.fillStyle = '#4a2f16'; g.fillRect(-2, 11, 4, 6);
      g.restore();
    });
    makeArt('it_bow', g => {
      g.strokeStyle = '#8a6238'; g.lineWidth = 3;
      g.beginPath(); g.arc(12, 16, 12, -Math.PI / 2.4, Math.PI / 2.4); g.stroke();
      g.strokeStyle = '#e8e4da'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(16, 5); g.lineTo(16, 27); g.stroke();
      g.strokeStyle = '#6b4526'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(8, 16); g.lineTo(26, 16); g.stroke();
      g.fillStyle = '#c8ccd4'; tri(g, [26, 16, 22, 13, 22, 19]);
    });
    makeArt('it_leather', g => {
      g.fillStyle = '#8a5a2a'; g.fillRect(9, 8, 14, 18);
      g.fillRect(5, 8, 6, 8); g.fillRect(21, 8, 6, 8);
      g.fillStyle = '#6b4526'; g.fillRect(15, 8, 2, 18);
      g.fillStyle = '#a8763a'; g.fillRect(9, 8, 14, 3);
    });
    makeArt('it_chain', g => {
      g.fillStyle = '#7a8090'; g.fillRect(9, 8, 14, 18);
      g.fillRect(5, 8, 6, 8); g.fillRect(21, 8, 6, 8);
      g.fillStyle = '#5a616e';
      for (let y = 10; y < 25; y += 4) for (let x = 10 + (y % 8 === 2 ? 2 : 0); x < 22; x += 4) {
        g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill();
      }
    });
    const paintPotion = (g, liquid, glow) => {
      g.fillStyle = '#b8c4cc'; g.fillRect(13, 4, 6, 5);
      g.fillStyle = '#6b4526'; g.fillRect(12, 2, 8, 3);
      g.fillStyle = 'rgba(200,215,225,0.5)';
      g.beginPath(); g.arc(16, 20, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = liquid;
      g.beginPath(); g.arc(16, 21, 7.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = glow; ell(g, 13, 18, 2.5, 3, glow);
    };
    makeArt('it_hpot', g => paintPotion(g, '#a82430', '#e86a70'));
    makeArt('it_mpot', g => paintPotion(g, '#2848a8', '#6a90e8'));
    makeArt('it_gem', g => {
      g.fillStyle = '#2a9a5a'; tri(g, [16, 4, 4, 14, 28, 14]);
      tri(g, [4, 14, 16, 28, 28, 14], '#238a4e');
      g.fillStyle = '#5fd490'; tri(g, [16, 4, 10, 14, 20, 14]);
      g.fillStyle = '#8af0b8'; g.fillRect(13, 8, 3, 3);
    });
    makeArt('it_blade', g => {
      g.fillStyle = '#d9a520'; g.save(); g.translate(16, 16); g.rotate(-Math.PI / 4);
      g.fillRect(-2.5, -14, 5, 21); g.fillStyle = '#f0d060'; g.fillRect(-2.5, -14, 2.5, 21);
      g.fillStyle = '#c9a227'; g.fillRect(-7, 7, 14, 3); g.fillStyle = '#6b4526'; g.fillRect(-2, 10, 4, 6);
      g.restore();
      g.fillStyle = '#fff2c8'; ell(g, 8, 8, 2, 2, '#fff2c8');
    });

    // -- spell icons, 32px --
    makeArt('ic_cleave', g => {
      g.strokeStyle = '#c8ccd4'; g.lineWidth = 4;
      g.beginPath(); g.arc(16, 22, 11, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.fillStyle = '#e8e8e8'; g.save(); g.translate(16, 14); g.rotate(0.5);
      g.fillRect(-1.5, -10, 3, 16); g.restore();
      g.fillStyle = '#c9a227'; g.fillRect(11, 18, 10, 3);
    });
    makeArt('ic_dshot', g => {
      g.strokeStyle = '#d0b040'; g.lineWidth = 2.5;
      for (const o of [-4, 4]) {
        g.beginPath(); g.moveTo(6, 22 + o); g.lineTo(24, 8 + o); g.stroke();
        g.fillStyle = '#e8e8e8'; tri(g, [26, 6 + o, 20, 8 + o, 24, 12 + o]);
      }
    });
    makeArt('ic_heal', g => {
      g.fillStyle = 'rgba(240,220,140,0.5)';
      g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f0e6c8'; g.fillRect(13, 6, 6, 20); g.fillRect(6, 13, 20, 6);
      g.fillStyle = '#c9a227'; g.fillRect(14, 7, 2, 18); g.fillRect(7, 14, 2, 4);
    });
    makeArt('ic_fire', g => {
      g.fillStyle = '#c8622a';
      g.beginPath(); g.arc(16, 18, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f0a04a';
      g.beginPath(); g.arc(16, 18, 6, 0, Math.PI * 2); g.fill();
      tri(g, [16, 2, 10, 12, 22, 12], '#f0a04a');
      tri(g, [16, 5, 13, 12, 19, 12], '#f8d060');
      g.fillStyle = '#f8d060'; ell(g, 14, 16, 2.5, 3, '#f8d060');
    });
    makeArt('ic_frost', g => {
      g.strokeStyle = '#9ad8f0'; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        g.beginPath(); g.moveTo(16, 16);
        g.lineTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12); g.stroke();
      }
      ell(g, 16, 16, 4, 4, '#e8f6ff');
    });
    makeArt('ic_fly', g => {
      g.fillStyle = '#e8f0f8';
      for (const [ox, s] of [[0, 1], [2, 0.7], [4, 0.45]]) {
        g.beginPath();
        g.ellipse(14 - ox * 2, 18 + ox * 2, 12 * s, 4.5 * s, -0.5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#9ad8f0'; ell(g, 24, 10, 3, 3, '#9ad8f0');
    });

    // -- school spell icons: colored disc + glyph --
    const spellDisc = (g, color) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.beginPath(); g.arc(12, 11, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2;
      g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.stroke();
    };
    makeArt('ic_firebolt', g => {
      spellDisc(g, '#8a2a10');
      tri(g, [16, 5, 9, 20, 23, 20], '#f0a04a');
      tri(g, [16, 9, 12, 19, 20, 19], '#f8d060');
      ell(g, 16, 22, 5, 4, '#f0a04a');
    });
    makeArt('ic_ringfire', g => {
      spellDisc(g, '#6a2008');
      g.strokeStyle = '#f0a04a'; g.lineWidth = 3;
      g.beginPath(); g.arc(16, 17, 7, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        tri(g, [16 + Math.cos(a) * 10, 17 + Math.sin(a) * 10 - 3,
                16 + Math.cos(a) * 8 - 2, 17 + Math.sin(a) * 8 + 2,
                16 + Math.cos(a) * 8 + 2, 17 + Math.sin(a) * 8 + 2], '#f8d060');
      }
    });
    makeArt('ic_spark', g => {
      spellDisc(g, '#1a4a70');
      g.fillStyle = '#f8f0a0';
      g.beginPath();
      g.moveTo(19, 5); g.lineTo(10, 17); g.lineTo(15, 17);
      g.lineTo(12, 27); g.lineTo(22, 14); g.lineTo(17, 14); g.closePath(); g.fill();
    });
    makeArt('ic_clap', g => {
      spellDisc(g, '#2a5a80');
      ell(g, 16, 16, 4, 4, '#f8f0a0');
      g.strokeStyle = '#c8e8f8'; g.lineWidth = 2;
      for (const r of [7, 11]) {
        g.beginPath(); g.arc(16, 16, r, -0.6, 0.6); g.stroke();
        g.beginPath(); g.arc(16, 16, r, Math.PI - 0.6, Math.PI + 0.6); g.stroke();
      }
    });
    makeArt('ic_icebolt', g => {
      spellDisc(g, '#1a3a6a');
      tri(g, [16, 4, 11, 22, 21, 22], '#9ad8f0');
      tri(g, [16, 8, 13, 20, 19, 20], '#e8f6ff');
      tri(g, [16, 28, 11, 22, 21, 22], '#6ab0e0');
    });
    makeArt('ic_wwalk', g => {
      spellDisc(g, '#204a8a');
      g.strokeStyle = '#9ad8f0'; g.lineWidth = 2.5;
      for (const y of [13, 19, 25]) {
        g.beginPath();
        g.moveTo(7, y); g.quadraticCurveTo(11, y - 4, 16, y); g.quadraticCurveTo(21, y + 4, 25, y);
        g.stroke();
      }
      ell(g, 16, 9, 3, 2, '#f0e6c8');
    });
    makeArt('ic_rock', g => {
      spellDisc(g, '#5a4a20');
      g.fillStyle = '#8a8f98';
      g.beginPath();
      g.moveTo(9, 21); g.lineTo(12, 10); g.lineTo(20, 8); g.lineTo(24, 16); g.lineTo(20, 24); g.lineTo(11, 24);
      g.closePath(); g.fill();
      g.fillStyle = '#b8bcc4'; g.fillRect(13, 11, 5, 4);
      g.fillStyle = '#5a5e66'; g.fillRect(16, 17, 6, 3);
    });
    makeArt('ic_stone', g => {
      spellDisc(g, '#6a5a28');
      g.fillStyle = '#8a8f98';
      g.beginPath();
      g.moveTo(16, 5); g.lineTo(25, 10); g.lineTo(25, 20); g.lineTo(16, 27); g.lineTo(7, 20); g.lineTo(7, 10);
      g.closePath(); g.fill();
      g.fillStyle = '#b8bcc4'; g.fillRect(10, 9, 12, 3);
      g.strokeStyle = '#5a5e66'; g.lineWidth = 2; g.strokeRect(11, 13, 10, 8);
    });
    makeArt('ic_roots', g => {
      spellDisc(g, '#4a3a14');
      g.strokeStyle = '#8a6238'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(16, 27); g.lineTo(16, 14); g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(16, 20); g.quadraticCurveTo(9, 16, 7, 9); g.stroke();
      g.beginPath(); g.moveTo(16, 18); g.quadraticCurveTo(23, 14, 25, 7); g.stroke();
      g.beginPath(); g.moveTo(16, 14); g.quadraticCurveTo(13, 9, 14, 5); g.stroke();
      g.fillStyle = '#5fa852';
      ell(g, 7, 8, 2.5, 2, '#5fa852'); ell(g, 25, 6, 2.5, 2, '#5fa852'); ell(g, 14, 5, 2, 2, '#5fa852');
    });
    makeArt('ic_regen', g => {
      spellDisc(g, '#7a2020');
      g.fillStyle = '#f07070';
      g.beginPath();
      g.moveTo(16, 26);
      g.bezierCurveTo(4, 16, 9, 6, 16, 12);
      g.bezierCurveTo(23, 6, 28, 16, 16, 26);
      g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(14, 13, 4, 9); g.fillRect(11.5, 15.5, 9, 4);
    });
    makeArt('ic_gheal', g => {
      spellDisc(g, '#8a3030');
      g.fillStyle = '#f0e6c8';
      for (const [cx, cy, s] of [[16, 11, 4], [10, 21, 3], [22, 21, 3]]) {
        g.fillRect(cx - 1.5, cy - s, 3, s * 2);
        g.fillRect(cx - s, cy - 1.5, s * 2, 3);
      }
    });
    makeArt('ic_bless', g => {
      spellDisc(g, '#6a6a9a');
      g.fillStyle = '#f8f0c0';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        tri(g, [16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10,
                16 + Math.cos(a + 2.2) * 4, 16 + Math.sin(a + 2.2) * 4,
                16 + Math.cos(a - 2.2) * 4, 16 + Math.sin(a - 2.2) * 4]);
      }
      ell(g, 16, 16, 3, 3, '#ffffff');
    });
    makeArt('ic_lash', g => {
      spellDisc(g, '#50508a');
      g.strokeStyle = '#e8e8f8'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(8, 25); g.quadraticCurveTo(20, 22, 22, 12); g.quadraticCurveTo(23, 7, 19, 7);
      g.stroke();
      ell(g, 24, 9, 3, 3, '#ffffff');
    });
    makeArt('ic_raise', g => {
      spellDisc(g, '#3a3a6a');
      g.fillStyle = '#e8e8f8';
      ell(g, 16, 11, 4, 4, '#e8e8f8');
      tri(g, [16, 14, 10, 27, 22, 27], '#e8e8f8');
      g.strokeStyle = '#f8f0c0'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(7, 22); g.lineTo(7, 14); g.stroke();
      g.beginPath(); g.moveTo(25, 22); g.lineTo(25, 14); g.stroke();
      tri(g, [7, 11, 4, 16, 10, 16], '#f8f0c0');
      tri(g, [25, 11, 22, 16, 28, 16], '#f8f0c0');
    });
    makeArt('ic_sunray', g => {
      spellDisc(g, '#8a6a10');
      ell(g, 16, 16, 6, 6, '#f8e080');
      g.strokeStyle = '#f8e080'; g.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.beginPath();
        g.moveTo(16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8);
        g.lineTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12);
        g.stroke();
      }
    });
    makeArt('ic_prism', g => {
      spellDisc(g, '#7a6a20');
      tri(g, [16, 6, 7, 24, 25, 24], '#e8e8f0');
      const cols = ['#e05020', '#f0d060', '#3ecf5a', '#3070d0'];
      cols.forEach((c, i) => {
        g.strokeStyle = c; g.lineWidth = 2;
        g.beginPath(); g.moveTo(21, 18 + i); g.lineTo(29, 14 + i * 3); g.stroke();
      });
    });
    makeArt('ic_hour', g => {
      spellDisc(g, '#9a7a10');
      g.fillStyle = '#f8d040';
      g.beginPath();
      g.moveTo(7, 24); g.lineTo(7, 12); g.lineTo(12, 17); g.lineTo(16, 8); g.lineTo(20, 17); g.lineTo(25, 12); g.lineTo(25, 24);
      g.closePath(); g.fill();
      g.fillStyle = '#c8352a'; ell(g, 16, 20, 2.5, 2.5, '#c8352a');
    });
    makeArt('ic_drain', g => {
      spellDisc(g, '#4a1a5a');
      g.fillStyle = '#c83a5a';
      g.beginPath();
      g.moveTo(16, 6);
      g.bezierCurveTo(8, 16, 10, 24, 16, 25);
      g.bezierCurveTo(22, 24, 24, 16, 16, 6);
      g.fill();
      g.fillStyle = '#f07090'; ell(g, 13, 16, 2, 3.5, '#f07090');
    });
    makeArt('ic_curse', g => {
      spellDisc(g, '#3a1a4a');
      ell(g, 16, 14, 8, 9, '#c8a8e0');
      g.fillStyle = '#c8a8e0'; g.fillRect(11, 20, 10, 6);
      g.fillStyle = '#3a1a4a';
      ell(g, 12.5, 13, 2.5, 3, '#3a1a4a'); ell(g, 19.5, 13, 2.5, 3, '#3a1a4a');
      g.fillRect(13, 22, 2, 3); g.fillRect(17, 22, 2, 3);
    });
    makeArt('ic_arma', g => {
      spellDisc(g, '#401010');
      g.strokeStyle = '#f0a04a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(24, 5); g.lineTo(13, 18); g.stroke();
      g.strokeStyle = '#f8d060'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(27, 8); g.lineTo(17, 19); g.stroke();
      ell(g, 11, 21, 5, 5, '#f0a04a');
      ell(g, 10, 20, 2.5, 2.5, '#f8f0a0');
      g.strokeStyle = '#c86a2a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(5, 27); g.lineTo(27, 27); g.stroke();
    });

    // spellcraft cast: Xarthax, summons, totem
    makeArt('spellwright', g => {
      g.fillStyle = '#3a2a5a'; g.fillRect(9, 15, 14, 15);           // star-robe
      g.fillStyle = '#d0b040';
      [[11, 18], [19, 22], [14, 26]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
      ell(g, 16, 10, 5.5, 5.5, '#e0c0a0');
      g.fillStyle = '#d4d8de';                                       // wild white hair
      ell(g, 16, 5.5, 7, 4, '#d4d8de');
      g.fillRect(8, 5, 3, 8); g.fillRect(21, 5, 3, 8);
      g.fillStyle = '#c9a227';                                       // brass goggles
      g.fillRect(10, 8, 12, 3);
      ell(g, 12.5, 9.5, 2.5, 2.5, '#3ecfb0'); ell(g, 19.5, 9.5, 2.5, 2.5, '#3ecfb0');
    });
    makeArt('golem', g => {
      g.fillStyle = '#6a6e78';
      g.fillRect(9, 10, 14, 14);                                     // torso
      ell(g, 16, 7, 6, 5, '#7a7f8a');                                // head
      g.fillRect(4, 12, 5, 10); g.fillRect(23, 12, 5, 10);           // arms
      g.fillRect(10, 24, 5, 7); g.fillRect(17, 24, 5, 7);            // legs
      g.fillStyle = '#f0a04a'; ell(g, 13, 7, 1.5, 1.5, '#f0a04a'); ell(g, 19, 7, 1.5, 1.5, '#f0a04a');
      g.fillStyle = '#4d515c'; g.fillRect(11, 14, 10, 2);            // crack
    });
    makeArt('wisp', g => {
      ell(g, 16, 16, 9, 9, 'rgba(200,200,255,0.5)');
      ell(g, 16, 16, 5.5, 5.5, '#c8c8f0');
      ell(g, 14, 14, 2, 2, '#ffffff');
    });
    makeArt('totemArt', g => {
      g.fillStyle = '#6b4526'; g.fillRect(12, 6, 8, 24);
      g.fillStyle = '#8a6238'; g.fillRect(12, 6, 3, 24);
      g.fillStyle = '#c9a227'; g.fillRect(10, 8, 12, 3); g.fillRect(10, 18, 12, 3);
      ell(g, 16, 13, 2.5, 2.5, '#3ecfb0');
      tri(g, [10, 6, 16, 1, 22, 6], '#8a6238');
    });

    // coachman + carriage (the travel post)
    makeArt('coachman', g => {
      g.fillStyle = '#4a3a28'; g.fillRect(9, 15, 14, 15);            // driving coat
      g.fillStyle = '#6a5238'; g.fillRect(9, 15, 14, 3);
      ell(g, 16, 10, 5.5, 5.5, '#e0b48e');                          // face
      g.fillStyle = '#2a2018'; ell(g, 16, 6, 7, 3, '#2a2018');      // tricorne hat
      g.fillRect(10, 5, 12, 3);
      g.fillStyle = '#c9a227'; g.fillRect(9, 20, 14, 1);            // coat trim
      ell(g, 14, 10, 1, 1.2, '#2a2018'); ell(g, 18, 10, 1, 1.2, '#2a2018');
    });
    makeArt('carriage', g => {
      // horse
      g.fillStyle = '#5a4030'; g.fillRect(1, 16, 9, 7); ell(g, 3, 15, 3, 3, '#5a4030');
      g.fillStyle = '#3a2a1e'; g.fillRect(3, 22, 1.5, 6); g.fillRect(7, 22, 1.5, 6);
      // cabin
      g.fillStyle = '#7a4a2a'; g.fillRect(12, 10, 17, 13);
      g.fillStyle = '#5a3418'; g.fillRect(12, 10, 17, 3);
      g.fillStyle = '#a0c0d0'; g.fillRect(15, 14, 5, 5); g.fillRect(22, 14, 5, 5); // windows
      g.fillStyle = '#c9a227'; g.fillRect(12, 21, 17, 2);
      // wheels
      g.fillStyle = '#3a2a1a'; ell(g, 16, 26, 4, 4, '#3a2a1a'); ell(g, 25, 26, 4, 4, '#3a2a1a');
      g.fillStyle = '#6a5238'; ell(g, 16, 26, 1.5, 1.5, '#6a5238'); ell(g, 25, 26, 1.5, 1.5, '#6a5238');
    });

    // Oakhearth folk
    makeArt('lord', g => {
      g.fillStyle = '#6e2a34'; g.fillRect(9, 15, 14, 15);            // crimson doublet
      g.fillStyle = '#c4b498'; g.fillRect(9, 15, 14, 3);             // fur collar
      g.fillStyle = '#8a6a2a'; g.fillRect(9, 22, 14, 1.5);           // gold belt
      ell(g, 16, 10, 5.5, 5.5, '#e0c0a0');                           // face
      g.fillStyle = '#9a9fa8'; ell(g, 16, 5.5, 6, 3, '#9a9fa8');     // steel-grey hair
      g.strokeStyle = '#d0b040'; g.lineWidth = 1.8;                  // circlet
      g.beginPath(); g.moveTo(11, 6.5); g.lineTo(21, 6.5); g.stroke();
      ell(g, 14, 10, 1, 1.2, '#2a2018'); ell(g, 18, 10, 1, 1.2, '#2a2018');
      g.fillStyle = '#9a9fa8'; g.fillRect(13, 13.5, 6, 2);           // trim beard
    });
    makeArt('mage2', g => {
      g.fillStyle = '#2a4a7a'; g.fillRect(9, 14, 14, 16);            // guild-blue robe
      g.fillStyle = '#1e3658'; g.fillRect(9, 14, 3, 16);
      g.fillStyle = '#d0b040'; g.fillRect(9, 27, 14, 1.5);           // gold hem
      ell(g, 16, 9, 5.5, 5.5, '#e6c4a2');                            // face
      g.fillStyle = '#4a3a28'; ell(g, 16, 5, 6, 2.5, '#4a3a28');     // neat dark hair
      g.strokeStyle = '#c8ccd4'; g.lineWidth = 1.2;                  // spectacles
      g.beginPath(); g.arc(13.5, 9.5, 2, 0, Math.PI * 2); g.arc(18.5, 9.5, 2, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(15.5, 9.5); g.lineTo(16.5, 9.5); g.stroke();
      ell(g, 13.5, 9.5, 0.9, 1, '#2a2018'); ell(g, 18.5, 9.5, 0.9, 1, '#2a2018');
    });

    // Shardfields: crystal spires + the emberspawn that condense among them
    makeArt('shard', g => {
      tri(g, [16, 2, 9, 26, 23, 26], '#8a5fd0');
      tri(g, [16, 2, 16, 26, 23, 26], '#6a3fb0');   // shadow facet
      tri(g, [7, 12, 3, 27, 12, 27], '#a883e8');
      tri(g, [25, 14, 20, 27, 29, 27], '#7a4fc0');
      g.fillStyle = '#e8d8ff'; g.fillRect(14, 6, 2, 10); // glint
      g.save(); g.globalAlpha = 0.35; ell(g, 16, 28, 12, 3, '#5a3a8a'); g.restore();
    });
    makeArt('emberspawn', g => {
      const bd = g.createRadialGradient(30, 30, 4, 32, 36, 26);
      bd.addColorStop(0, '#5a3a30'); bd.addColorStop(1, '#2a1a16');
      g.fillStyle = bd; g.beginPath(); g.ellipse(32, 38, 19, 17, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff7020'; g.lineWidth = 2.2; g.lineCap = 'round'; // magma cracks
      g.beginPath(); g.moveTo(20, 34); g.lineTo(28, 40); g.lineTo(24, 48); g.stroke();
      g.beginPath(); g.moveTo(42, 30); g.lineTo(37, 40); g.lineTo(44, 46); g.stroke();
      g.beginPath(); g.moveTo(30, 22); g.lineTo(33, 30); g.stroke();
      g.fillStyle = '#ffb040'; ell(g, 26, 28, 3, 2.6, '#ffb040'); ell(g, 39, 28, 3, 2.6, '#ffb040');
      ell(g, 25, 27, 1.2, 1.2, '#fff0c0'); ell(g, 38, 27, 1.2, 1.2, '#fff0c0');
      g.fillStyle = '#ff5010'; g.beginPath(); g.ellipse(32, 43, 6, 3, 0, 0, Math.PI); g.fill(); // maw
      g.save(); g.globalAlpha = 0.45; ell(g, 32, 56, 16, 3, '#ff7020'); g.restore();
    }, 64);

    this.applyAssetOverrides(); // real assets (if any) replace painters here

    // register everything the Phaser UI needs as textures
    ['panel_ui', 'panel_hud', 'slot',
     'pt_roderick', 'pt_wren', 'pt_serena', 'pt_malwick',
     'it_sword', 'it_bsword', 'it_bow', 'it_leather', 'it_chain', 'it_hpot', 'it_mpot', 'it_gem', 'it_blade',
     'ic_cleave', 'ic_dshot', 'ic_heal', 'ic_fire', 'ic_frost', 'ic_fly',
     'ic_firebolt', 'ic_ringfire', 'ic_spark', 'ic_clap', 'ic_icebolt', 'ic_wwalk',
     'ic_rock', 'ic_stone', 'ic_roots', 'ic_regen', 'ic_gheal', 'ic_bless',
     'ic_lash', 'ic_raise', 'ic_sunray', 'ic_prism', 'ic_hour', 'ic_drain', 'ic_curse', 'ic_arma',
    ].forEach(k => this.textures.addCanvas(k, ART[k]));

    // spec spells with 'rune_*' icons get auto-painted school runes
    for (const [sid, sp] of Object.entries(SPELLS)) {
      if (sp.icon && sp.icon.startsWith('rune_') && !this.textures.exists(sp.icon)) {
        makeRuneIcon(sp.icon, sp.school, sp.name);
        this.textures.addCanvas(sp.icon, ART[sp.icon]);
      }
    }

    this.scene.start('World');
  }
}

class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  create() {
    // resume a saved journey if one exists. Each zone stores its own seed +
    // gone-list in GameData.zoneState, so every map regrows exactly as you left it.
    this.save = null;
    try { this.save = JSON.parse(localStorage.getItem('emberfall-save')); } catch (e) {}
    if (this.save && this.save.v !== 3) {
      // migrate any older save: keep the party's progress, regrow the world fresh
      // (spawn order shifted across versions, so old per-map gone-lists can't carry)
      this.save = {
        v: 3, gold: this.save.gold, inventory: this.save.inventory,
        flags: this.save.flags, quests: this.save.quests, party: this.save.party,
        crafted: this.save.crafted, zone: 'embervale', zoneState: {},
      };
      this._migrated = true;
    }
    if (this.save) {
      const s = this.save;
      GameData.gold = Math.max(s.gold, 500); // test-mode floor: never stranded broke
      GameData.inventory = s.inventory;
      GameData.flags = s.flags;
      GameData.quests = s.quests;
      if (Array.isArray(s.crafted)) GameData.craftedSpells = s.crafted;
      // newer builds ship bigger starting grimoires + mana pools — capture the
      // fresh defaults, then union them into the saved heroes (idempotent)
      const freshSpells = GameData.party.map(h => h.spells.slice());
      const freshMp = GameData.party.map(h => h.maxMp);
      s.party.forEach((sp, i) => Object.assign(GameData.party[i], sp));
      GameData.party.forEach((h, i) => {
        for (const id of freshSpells[i]) if (!h.spells.includes(id)) h.spells.push(id);
        if (h.maxMp < freshMp[i]) { h.maxMp = freshMp[i]; h.mp = freshMp[i]; }
        if (h.level < TEST_LEVEL) levelHeroTo(h, TEST_LEVEL); // test-mode veterans
        if (!h.skillRank) h.skillRank = {};
      });
      GameData.zone = s.zone || 'embervale';
      GameData.zoneState = s.zoneState || {};
      // quests added after this save was written default to fresh
      if (!GameData.quests.wolfcull) GameData.quests.wolfcull = 'available';
      if (GameData.flags.wolfKills === undefined) GameData.flags.wolfKills = 0;
      if (!ZONES[GameData.zone]) GameData.zone = 'embervale';
    }

    this.loadZoneData(GameData.zone);

    // real-3D view: three.js canvas underneath, this Phaser canvas (transparent)
    // draws every UI element on top
    this.game.canvas.style.position = 'relative';
    this.game.canvas.style.zIndex = '1';
    R3D.init(document.getElementById('game'), this.zoneWorldDesc());
    R3D.syncSize(this.game.canvas);
    this.scale.on('resize', () => R3D.syncSize(this.game.canvas));

    this.hpBars = this.add.graphics().setDepth(950);
    this.crosshair = this.add.text(480, 255, '+', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffffff',
      stroke: '#0a0c12', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(951);

    const [spx, spy] = this.spawnPoint();
    this.px = spx; this.py = spy;
    this.ensureStandable();
    this.angle = 0; // radians; 0 = east
    this.pitch = 0; // vertical look, radians
    this.eyeZ = 0.5;      // camera height above local terrain (0.5 = on foot)
    this.flying = false;  // the Fly spell
    this.landing = false;
    this.flyCaster = -1;
    this.flyDrainAt = 0;

    // party buffs (expiry timestamps; effect sizes are fixed per spell)
    this.buffs = {
      atkUntil: 0, defUntil: 0, hasteUntil: 0, regenUntil: 0, waterwalkUntil: 0,
      dodgeUntil: 0, reflectUntil: 0, ghostUntil: 0, deathlessUntil: 0,
    };
    this.regenNext = 0;
    this.sinkNext = 0;
    this._buffStr = '';
    this.tempWalls = []; // conjured stone (Bulwark etc.) — restored on expiry

    // player-crafted spells: re-register specs + rune icons
    for (const spec of GameData.craftedSpells) {
      SPELLS[spec.id] = spec;
      if (!this.textures.exists(spec.icon)) {
        makeRuneIcon(spec.icon, spec.school, spec.name);
        this.textures.addCanvas(spec.icon, ART[spec.icon]);
      }
    }

    // v3 saves don't store position/flight — you always resume standing at the
    // saved zone's spawn point (set above via spawnPoint()), never mid-air.
    this.dialogOpen = false;
    this.nearVillager = null;
    this.dead = false;
    this.target = null;
    this.hitFlashUntil = 0;
    this.invulnUntil = 0;
    this.fountainCd = 0;

    this.keys = this.input.keyboard.addKeys('W,A,S,D,Q,E,M,R,X,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,PAGE_UP,PAGE_DOWN');
    this.input.keyboard.on('keydown-M', () => { this.mmContainer.visible = !this.mmContainer.visible; });
    this.input.keyboard.on('keydown-T', () => {
      if (!this.dead && !this.dialogOpen && !this.sbOpen && !this.invOpen && !this.shopOpen && !this.wmOpen && this.nearVillager) {
        this.openDialogue(this.nearVillager);
      }
    });

    // click: grab mouse-look if not locked, and swing at whatever's in your sights
    this.input.on('pointerdown', () => {
      if (this.dialogOpen || this.dead || this.sbOpen || this.invOpen || this.shopOpen || this.wmOpen) return;
      if (document.pointerLockElement !== this.game.canvas) this.game.canvas.requestPointerLock();
      this.partyAttack(this.time.now);
    });
    this._mouseMove = ev => {
      if (document.pointerLockElement === this.game.canvas && !this.dialogOpen && !this.dead) {
        this.angle += ev.movementX * 0.0032;
        this.pitch = clamp(this.pitch - ev.movementY * 0.0021, -0.9, 0.9); // radians now
      }
    };
    document.addEventListener('mousemove', this._mouseMove);

    // F = action, same as a mouse click (fullscreen lives on the browser's F11)
    this.input.keyboard.on('keydown-F', () => this.partyAttack(this.time.now));

    this.time.addEvent({ delay: 650, loop: true, callback: () => this.wanderEnemies() });
    this.time.addEvent({ delay: 10000, loop: true, callback: () => this.saveGame() });
    this.input.keyboard.on('keydown-N', () => {
      if (this.dialogOpen || this.sbOpen || this.invOpen || this.shopOpen || this.wmOpen) return;
      if (this.newGameArm && this.time.now < this.newGameArm) {
        localStorage.removeItem('emberfall-save');
        location.reload();
      } else {
        this.newGameArm = this.time.now + 2500;
        this.toast('Press N again to abandon this journey and begin anew.');
      }
    });

    this.questText = this.add.text(12, 470, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#9ad8ff',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 2 },
    }).setDepth(1000);

    this.buffText = this.add.text(948, 470, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#8ae8b0',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 2 },
    }).setOrigin(1, 0).setDepth(1000).setAlpha(0.95);

    this.buildMinimap();
    this.buildHUD();
    this.buildSpellbook();
    this.buildInventoryUI();
    this.buildShopUI();
    this.input.keyboard.on('keydown-B', () => {
      if (this.dialogOpen || this.dead) return;
      if (this.shopOpen) this.closeShop();
      if (this.wmOpen) this.closeWorldMap();
      if (this.sbOpen) this.closeSpellbook(); else this.openSpellbook();
    });
    this.input.keyboard.on('keydown-I', () => {
      if (this.dialogOpen || this.dead) return;
      if (this.shopOpen) this.closeShop();
      if (this.wmOpen) this.closeWorldMap();
      if (this.invOpen) this.closeInventory(); else this.openInventory();
    });
    this.wmOpen = false;
    this.wmItems = [];
    this.input.keyboard.on('keydown-V', () => {
      if (this.dialogOpen || this.dead) return;
      if (this.wmOpen) this.closeWorldMap(); else this.openWorldMap();
    });
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.sbOpen) this.closeSpellbook();
      if (this.invOpen) this.closeInventory();
      if (this.shopOpen) this.closeShop();
      if (this.wmOpen) this.closeWorldMap();
    });

    this.compass = this.add.text(480, 8, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#d8c26a',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 0).setDepth(1000);

    this.targetText = this.add.text(480, 36, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffb3a0',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 0).setDepth(1000).setAlpha(0);

    this.dmgVignette = this.add.rectangle(0, 0, 960, 510, 0xaa1111)
      .setOrigin(0).setDepth(900).setAlpha(0);

    this.toastText = this.add.text(480, 466, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffe9a0',
      backgroundColor: 'rgba(0,0,0,0.65)', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(1001).setAlpha(0);

    this.talkHint = this.add.text(480, 432, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#9ad8ff',
      backgroundColor: 'rgba(0,0,0,0.65)', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(1001).setAlpha(0);

    this.toast(this._migrated
      ? 'The vale has shifted since your last visit — your party and goods endure.'
      : this.save
        ? 'Your journey resumes. Progress saves itself; N twice begins anew.'
        : 'Welcome to Emberfall. The gate lies east — monsters prowl beyond the palisade!');
  }

  saveGame() {
    if (this.dead) return;
    // fold the current zone's live gone-list back into zoneState before saving
    GameData.zoneState[GameData.zone] = { seed: this.worldSeed, gone: [...this.goneUids] };
    const party = GameData.party.map(h => ({
      level: h.level, xp: h.xp, hp: h.hp, maxHp: h.maxHp, mp: h.mp, maxMp: h.maxMp,
      atk: h.atk, def: h.def, spells: h.spells.slice(), quick: h.quick,
      weapon: h.weapon, armor: h.armor, readyAt: 0,
      skillRank: h.skillRank || {},
    }));
    const s = {
      v: 3,
      gold: GameData.gold, inventory: GameData.inventory,
      flags: GameData.flags, quests: GameData.quests,
      party, crafted: GameData.craftedSpells,
      zone: GameData.zone, zoneState: GameData.zoneState,
    };
    try { localStorage.setItem('emberfall-save', JSON.stringify(s)); } catch (e) {}
  }

  // ---------- zones & travel (design/WORLD.md) ----------

  spawnPoint() { return this.zone.home ? [START.x, START.y] : this.zone.arrive.slice(); }

  // if the spawn/arrival square is blocked (an NPC drifted there, a prop, a
  // tree), sidestep to the nearest standable spot instead of being wedged
  ensureStandable() {
    if (this.canStand(this.px, this.py)) return;
    for (let r = 0.6; r < 5; r += 0.45) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
        const nx = this.px + Math.cos(a) * r, ny = this.py + Math.sin(a) * r;
        if (this.canStand(nx, ny)) { this.px = nx; this.py = ny; return; }
      }
    }
  }

  // this zone's authored settlements (home = the Emberfall list)
  zoneSetts() { return this.zone.home ? SETTLEMENTS : (this.zone.settlements || []); }

  loadZoneData(zoneId) {
    GameData.zone = zoneId;
    this.zone = ZONES[zoneId];
    const st = GameData.zoneState[zoneId] ||
      (GameData.zoneState[zoneId] = { seed: (Math.random() * 1e9) >>> 0, gone: [] });
    this.worldSeed = st.seed;
    setSeed(this.worldSeed);
    this.goneUids = new Set(st.gone);
    this.buildMap();
    this.buildEntities();
    this.entities = this.entities.filter(e => !this.goneUids.has(e.uid));
  }

  zoneWorldDesc() {
    return {
      map: this.map, mapW: MAP_W, mapH: MAP_H,
      heights: this.heights, terrainH: (x, y) => this.terrainH(x, y),
      doors: this.doors,
      buildings: this.zone.home ? BUILDINGS.map(b => ({
        x1: VILLAGE.x1 + b.x1, y1: VILLAGE.y1 + b.y1,
        x2: VILLAGE.x1 + b.x2, y2: VILLAGE.y1 + b.y2, h: 1.25, color: b.color,
      })) : (this.zone.buildings || []).map(b => {
        const st = this.zoneSetts()[b.st || 0];
        return { x1: st.x1 + b.x1, y1: st.y1 + b.y1, x2: st.x1 + b.x2, y2: st.y1 + b.y2, h: b.h || 1.25, color: b.color };
      }),
      bridges: this.bridgeCells, bridgeH: BRIDGE_H,
      bridgeHAt: x => this.bridgeHAt(x),
      groundAt: (x, y) => this.onBridge(x, y) ? this.bridgeHAt(x) : this.terrainH(x, y),
      palette: this.zone.palette || null,
    };
  }

  travelTo(zoneId) {
    if (zoneId === GameData.zone || !ZONES[zoneId]) return;
    // stash the zone we're leaving, regrow the destination, rebuild the 3D scene
    GameData.zoneState[GameData.zone] = { seed: this.worldSeed, gone: [...this.goneUids] };
    this.cameras.main.fadeOut(300, 6, 8, 14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.loadZoneData(zoneId);
      R3D.buildZone(this.zoneWorldDesc());
      this.buildMinimap();
      const [ax, ay] = this.zone.arrive;
      this.px = ax; this.py = ay; this.angle = 0; this.pitch = 0;
      this.eyeZ = 0.5; this.flying = false; this.landing = false; this.flyZ = undefined;
      this.ensureStandable();
      this.target = null;
      this.tempWalls = [];
      this.invulnUntil = this.time.now + 2000;
      // the road's rest: travel fully restores the living and rouses the fallen
      GameData.party.forEach(hh => {
        if (hh.hp <= 0) hh.hp = Math.ceil(hh.maxHp / 2);
        else hh.hp = hh.maxHp;
        hh.mp = hh.maxMp;
        hh.readyAt = 0;
      });
      this.saveGame();
      this.refreshHUD();
      this.cameras.main.fadeIn(300, 6, 8, 14);
      this.toast(`The coach arrives at ${this.zone.name} — the road's rest restores the party.`);
    });
  }

  // ---------- map & entities ----------

  buildMap() {
    this.map = [];
    for (let y = 0; y < MAP_H; y++) this.map.push(new Array(MAP_W).fill(T_GRASS));

    for (let x = 0; x < MAP_W; x++) { this.map[0][x] = T_ROCK; this.map[MAP_H - 1][x] = T_ROCK; }
    for (let y = 0; y < MAP_H; y++) { this.map[y][0] = T_ROCK; this.map[y][MAP_W - 1] = T_ROCK; }

    this.doors = [];
    this.bridgeSet = new Set();
    this.bridgeCells = [];
    this.bridgeSpan = null;

    if (this.zone.home) this.buildHomeMap();
    else if (this.zone.town) this.buildTownMap();
    else this.buildWildMap();

    this.buildHeights();
  }

  // any zone's authored settlements get stamped the same way
  stampSettlements() {
    for (const s of this.zoneSetts()) {
      s.layout.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          this.map[s.y1 + ry][s.x1 + rx] = CHAR_TILE[row[rx]] || T_GRASS;
          if (row[rx] === 'D') this.doors.push({ x: s.x1 + rx, y: s.y1 + ry, open: false });
        }
      });
    }
  }

  buildTownMap() {
    // walled town on open ground — the stamp carries everything
    this.stampSettlements();
  }

  buildWildMap() {
    // a themed wilderness — plus any authored landmark (Xarthax's tower)
    this.stampSettlements();
    const [ax, ay] = this.zone.arrive;
    const blobs = this.zone.marsh
      ? Array.from({ length: 14 }, () => [gri(5, MAP_W - 6), gri(5, MAP_H - 6), gri(2, 5), gri(2, 4)])
      : [[64, 20, 7, 5], [40, 54, 6, 4]];
    for (const [cx, cy, rx, ry] of blobs) {
      if (this.zone.marsh && Math.hypot(cx - ax, cy - ay) < 10) continue; // the coach clearing stays dry
      for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.map[y][x] = T_WATER;
      }
    }
  }

  buildHomeMap() {
    // (hills are real terrain now — see buildHeights)

    // lakes: open water you can see (and shoot) across, but not cross
    for (const [cx, cy, rx, ry] of [[70, 14, 8, 5], [26, 58, 6, 4], [80, 55, 7, 5]]) {
      for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.map[y][x] = T_WATER;
      }
    }

    // the river: winds north-south through the middle of the vale
    for (let y = 1; y < MAP_H - 1; y++) {
      const cx = 48 + Math.round(Math.sin(y * 0.15) * 5);
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        if (x > 1 && x < MAP_W - 1) this.map[y][x] = T_WATER;
      }
    }

    // stamp the authored village + camp over whatever the wilderness generated
    this.stampSettlements();

    // the east road: a clear corridor from the village gate to Eastmarch's,
    // bridging the river and winding through the hills (stops at the camp's west wall).
    // River cells under the road keep their water; a plank deck (bridgeSet) spans
    // them so the river flows on unbroken beneath the crossing.
    const roadY = VILLAGE.y1 + 8; // the gate row
    for (let x = VILLAGE.x2 + 1; x < SETTLEMENTS[1].x1 && x < MAP_W - 1; x++) {
      for (let y = roadY - 1; y <= roadY + 1; y++) {
        const t = this.map[y][x];
        if (t === T_WATER) this.bridgeSet.add(x + ',' + y); // deck over the river; water stays
        else if (y === roadY) this.map[y][x] = T_DIRT;
        else if (t !== T_GRASS && t !== T_COBBLE) this.map[y][x] = T_GRASS;
      }
    }
    this.bridgeCells = [...this.bridgeSet].map(s => s.split(',').map(Number));
    if (this.bridgeCells.length) {
      const xs = this.bridgeCells.map(c => c[0]);
      this.bridgeSpan = { x1: Math.min(...xs), x2: Math.max(...xs) };
    } else this.bridgeSpan = null;
  }

  // ---------- terrain (the actual hills) ----------

  buildHeights() {
    const W1 = MAP_W + 1, H1 = MAP_H + 1;
    const h = [];
    for (let y = 0; y < H1; y++) h.push(new Float32Array(W1));

    // gaussian mounds are the hills; a rising rim walls in the vale
    // (gri/grand are seeded — the same save regrows the same vale)
    const mounds = [];
    let tries = 0;
    while (mounds.length < 26 && tries++ < 300) {
      const mx = gri(6, MAP_W - 6), my = gri(5, MAP_H - 5);
      if (this.inVillage(mx, my, 9)) continue;
      mounds.push([mx, my, 3.5 + grand() * 5, 0.9 + grand() * 1.9]);
    }
    for (let y = 0; y < H1; y++) {
      for (let x = 0; x < W1; x++) {
        let v = 0;
        for (const [mx, my, r, amp] of mounds) {
          const d2 = ((x - mx) * (x - mx) + (y - my) * (y - my)) / (r * r);
          if (d2 < 5) v += amp * Math.exp(-d2 * 1.5);
        }
        const eb = Math.min(x, y, MAP_W - x, MAP_H - y);
        if (eb < 5) v += (5 - eb) * (5 - eb) * 0.30; // mountain rim
        h[y][x] = v;
      }
    }

    // every authored settlement sits on a leveled shelf; fade outward
    for (const st of this.zoneSetts()) {
      for (let y = 0; y < H1; y++) {
        for (let x = 0; x < W1; x++) {
          const dx = Math.max(st.x1 - x, 0, x - (st.x2 + 1));
          const dy = Math.max(st.y1 - y, 0, y - (st.y2 + 1));
          const d = Math.hypot(dx, dy);
          if (d < 5) h[y][x] *= d / 5;
        }
      }
    }
    if (this.zone.home) {
      // keep the east road a gentle valley route
      const roadY = VILLAGE.y1 + 8;
      for (let y = 0; y < H1; y++) {
        for (let x = 0; x < W1; x++) {
          if (x >= VILLAGE.x2 && x <= 84) {
            const d = Math.abs(y - (roadY + 0.5));
            if (d < 4) h[y][x] *= 0.25 + 0.75 * (d / 4);
          }
        }
      }
    }
    if (!this.zone.home) {
      // every travelled zone: level a clearing around the coach arrival point
      const [ax, ay] = this.zone.arrive;
      for (let y = 0; y < H1; y++) {
        for (let x = 0; x < W1; x++) {
          const d = Math.hypot(x - ax, y - ay);
          if (d < 7) h[y][x] *= Math.min(1, d / 7);
        }
      }
    }
    // carve river and lake beds below water level
    for (let y = 0; y < H1; y++) {
      for (let x = 0; x < W1; x++) {
        for (const [cx, cy] of [[x, y], [x - 1, y], [x, y - 1], [x - 1, y - 1]]) {
          if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H && this.map[cy][cx] === T_WATER) {
            h[y][x] = Math.min(h[y][x], -0.9);
            break;
          }
        }
      }
    }
    // two smoothing passes for the rolling look
    for (let pass = 0; pass < 2; pass++) {
      const s = [];
      for (let y = 0; y < H1; y++) s.push(Float32Array.from(h[y]));
      for (let y = 1; y < H1 - 1; y++) {
        for (let x = 1; x < W1 - 1; x++) {
          h[y][x] = (s[y][x] * 4 + s[y - 1][x] + s[y + 1][x] + s[y][x - 1] + s[y][x + 1]) / 8;
        }
      }
    }

    // earthen abutments (after smoothing, so they stay crisp): the banks ramp
    // up to meet the bridge deck ends flush — no floating bridge, no gap
    if (this.zone.home && this.bridgeSpan) {
      const roadY = VILLAGE.y1 + 8;
      for (const [vx, f] of [[this.bridgeSpan.x1, 1], [this.bridgeSpan.x1 - 1, 0.55],
                             [this.bridgeSpan.x2 + 1, 1], [this.bridgeSpan.x2 + 2, 0.55]]) {
        if (vx < 0 || vx >= W1) continue;
        for (let vy = roadY - 1; vy <= roadY + 2 && vy < H1; vy++) {
          h[vy][vx] = Math.max(h[vy][vx], BRIDGE_H * f);
        }
      }
    }
    this.heights = h;
  }

  terrainH(x, y) {
    const gx = clamp(x, 0, MAP_W - 0.001), gy = clamp(y, 0, MAP_H - 0.001);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const h = this.heights;
    return h[y0][x0] * (1 - fx) * (1 - fy) + h[y0][x0 + 1] * fx * (1 - fy) +
           h[y0 + 1][x0] * (1 - fx) * fy + h[y0 + 1][x0 + 1] * fx * fy;
  }

  slopeAt(x, y) {
    const d = 0.45;
    return Math.max(
      Math.abs(this.terrainH(x + d, y) - this.terrainH(x - d, y)),
      Math.abs(this.terrainH(x, y + d) - this.terrainH(x, y - d)));
  }

  // true inside (or within pad of) any walled settlement — the monster sanctuary
  inVillage(x, y, pad = 0) {
    // sanctuary test — monsters never enter: any settlement stamp, plus the
    // coach clearing in every travelled zone (never land in a bear's lap)
    if (this.zone && !this.zone.home) {
      const [ax, ay] = this.zone.arrive;
      if (Math.hypot(x - ax, y - ay) < 4 + pad) return true;
    }
    const setts = this.zone ? this.zoneSetts() : SETTLEMENTS;
    return setts.some(s =>
      x >= s.x1 - pad && x <= s.x2 + 1 + pad &&
      y >= s.y1 - pad && y <= s.y2 + 1 + pad);
  }

  buildEntities() {
    this.entities = [];
    let uidCounter = 0; // creation order is seeded-deterministic, so uids are stable per save
    const add = (kind, type, gx, gy) => {
      const e = {
        kind, type, art: type, gx, gy,
        x: gx + 0.5, y: gy + 0.5,
        vDiv: SPRITE_META[type].vDiv,
        uid: uidCounter++,
      };
      if (kind === 'enemy') {
        const t = ENEMY_TYPES[type];
        Object.assign(e, {
          hp: t.hp, maxHp: t.hp, atk: t.atk, def: t.def, xp: t.xp, gold: t.gold,
          speed: t.speed, cd: t.cd, nextAtk: 0, aggro: false,
        });
      }
      this.entities.push(e);
      return e;
    };

    // a villager-kind entity pushed with a fixed out-of-band uid (like Xarthax) —
    // consumes no counter uid, so it never shifts other entities' gone-lists
    const pushNPC = (cfg, gx, gy, uid) => {
      this.entities.push({
        kind: 'villager', type: cfg.art, art: cfg.art, gx, gy,
        x: gx + 0.5, y: gy + 0.5, vDiv: SPRITE_META[cfg.art].vDiv, uid,
        name: cfg.name, villager: cfg, chat: [],
      });
    };

    // forest regions — oak and pine woods with clearings, plus scattered loners.
    // Wild zones (Pinereach) are dense and pine-heavy.
    const treeOk = (x, y) =>
      x >= 2 && y >= 2 && x < MAP_W - 2 && y < MAP_H - 2 &&
      this.map[y][x] === T_GRASS && !this.inVillage(x, y, 2) && !this.entityAt(x, y);
    const dense = this.zone.dense;
    const regions = dense ? 15 : 9, loners = dense ? 140 : 70, pineBias = dense ? 0.8 : 0.4;
    for (let f = 0; f < regions; f++) {
      const fx = gri(8, MAP_W - 9), fy = gri(6, MAP_H - 7);
      const r = gri(4, dense ? 8 : 7), pineWood = grand() < pineBias;
      const tries = Math.floor(r * r * (dense ? 2.2 : 1.6));
      for (let i = 0; i < tries; i++) {
        const a = grand() * Math.PI * 2, rr = grand() * r;
        const x = Math.round(fx + Math.cos(a) * rr), y = Math.round(fy + Math.sin(a) * rr);
        if (!treeOk(x, y)) continue;
        const main = grand() < 0.85;
        add('tree', pineWood === main ? 'pine' : 'tree', x, y);
      }
    }
    for (let i = 0; i < loners; i++) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (treeOk(x, y)) add('tree', grand() < (dense ? 0.25 : 0.7) ? 'tree' : 'pine', x, y);
    }

    // a coach post stands in every travelled zone (fixed uids 999900/999901),
    // two tiles ASIDE from the arrival point — never on it (you'd spawn
    // inside Jori and be wedged in place)
    const [cax, cay] = this.zone.arrive;
    const cpx = Math.round(cax - 0.5) - 2, cpy = Math.round(cay - 0.5);
    pushNPC(COACHMAN, cpx, cpy, 999900);
    this.entities.push({
      kind: 'prop', type: 'carriage', art: 'carriage',
      gx: cpx + 1, gy: cpy, x: cpx + 1.5, y: cpy + 0.5,
      vDiv: SPRITE_META.carriage.vDiv, uid: 999901,
    });

    if (this.zone.town) { this.buildTownEntities(add); return; }
    if (!this.zone.home) { this.buildWildEntities(add); return; }

    // furniture & street dressing (coordinates relative to the village stamp)
    const vx = VILLAGE.x1, vy = VILLAGE.y1;
    add('prop', 'anvil', vx + 9, vy + 3);
    add('prop', 'barrel', vx + 3, vy + 10);
    add('prop', 'crate', vx + 10, vy + 10);
    add('prop', 'crate', vx + 12, vy + 10);
    add('prop', 'barrel', vx + 1, vy + 7);
    add('prop', 'crate', vx + 1, vy + 8);
    const smoke = add('decor', 'smoke', vx + 11, vy + 2); // above the smithy chimney
    smoke.zOff = 1.85;

    // props straight from the settlement layouts (single source of truth)
    const CHAR_PROP = { U: 'fountain', W: 'well', L: 'lamp', K: 'campfire', X: 'tent' };
    for (const s of SETTLEMENTS) {
      s.layout.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const kind = CHAR_PROP[row[rx]];
          const gx = s.x1 + rx, gy = s.y1 + ry;
          if (kind === 'fountain') add('fountain', 'fountain', gx, gy);
          else if (kind === 'campfire') {
            add('prop', 'campfire', gx, gy);
            const fire = add('decor', 'flame', gx, gy); // flickers via R3D opacity pulse
            fire.zOff = 0.3;
          } else if (kind) add('prop', kind, gx, gy);
        }
      });
    }

    for (const v of VILLAGERS) {
      const st = SETTLEMENTS[v.st || 0];
      const e = add('villager', v.art, st.x1 + v.spot[0], st.y1 + v.spot[1]);
      e.name = v.name;
      e.villager = v;
      e.chat = [];
    }

    let placed = 0, guard = 0;
    while (placed < 14 && guard++ < 2500) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (this.map[y][x] === T_GRASS && !this.inVillage(x, y, 2) &&
          dist(x, y, START.x, START.y) > 14 && !this.entityAt(x, y)) {
        add('chest', 'chest', x, y); placed++;
      }
    }

    guard = 0;
    let enemies = 0;
    while (enemies < 40 && guard++ < 5000) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (this.map[y][x] !== T_GRASS || this.inVillage(x, y, 4) || this.entityAt(x, y)) continue;
      const d = dist(x, y, START.x, START.y);
      const nearVillage = d < 22;
      if (enemies < 8 && !nearVillage) continue; // first few are guaranteed easy foes near the walls
      // deep wilderness: cave bears prowl the far woods (seeded roll — one add()
      // per iteration, so spawn count and uid order are unchanged)
      const far = nearVillage ? 'slime' : d < 52 ? 'goblin' : (grand() < 0.35 ? 'bear' : 'wolf');
      add('enemy', far, x, y);
      enemies++;
    }

    // Xarthax the Spellwright takes his corner table at the Stoat. Manual push
    // with a fixed out-of-band uid: he consumes no counter uid, so save
    // gone-lists stay stable no matter what spawns around him.
    this.entities.push({
      kind: 'villager', type: XARTHAX.art, art: XARTHAX.art,
      gx: VILLAGE.x1 + XARTHAX.spot[0], gy: VILLAGE.y1 + XARTHAX.spot[1],
      x: VILLAGE.x1 + XARTHAX.spot[0] + 0.5, y: VILLAGE.y1 + XARTHAX.spot[1] + 0.5,
      vDiv: SPRITE_META[XARTHAX.art].vDiv, uid: 999999,
      name: XARTHAX.name, villager: XARTHAX, chat: [],
    });

    // Bram's stolen blade: a goblin camp far east, across the river ford.
    // Skip entirely once the blade is claimed (migrated saves regrow the world,
    // and a second blade would be nonsense). Last spawn block, so uids stay stable.
    if (GameData.flags.hasLostBlade || GameData.quests.lostblade === 'done') return;
    let sx = 76, sy = VILLAGE.y1 + 8, swordGuard = 0;
    while (swordGuard++ < 500 &&
           (this.map[sy][sx] !== T_GRASS || this.inVillage(sx, sy, 1) || this.entityAt(sx, sy))) {
      sx = 70 + gri(0, 16); sy = 28 + gri(0, 18);
    }
    add('item', 'sword', sx, sy);
    let guards = 0;
    for (const [dx, dy] of [[2, 0], [-2, 1], [0, 2], [1, -2], [-1, -1], [2, 2]]) {
      if (guards >= 3) break;
      const gx2 = sx + dx, gy2 = sy + dy;
      if (gx2 > 1 && gy2 > 1 && gx2 < MAP_W - 2 && gy2 < MAP_H - 2 &&
          this.map[gy2][gx2] === T_GRASS && !this.inVillage(gx2, gy2, 1) && !this.entityAt(gx2, gy2)) {
        add('enemy', 'goblin', gx2, gy2);
        guards++;
      }
    }
  }

  // wild-zone contents: chests in the woods, the zone's own beasts prowling,
  // plus landmark props/dwellers (Xarthax at his Shardfields tower)
  buildWildEntities(add) {
    const [ax, ay] = this.zone.arrive;
    const CHAR_PROP = { U: 'fountain', W: 'well', L: 'lamp', K: 'campfire', X: 'tent' };
    for (const s of this.zoneSetts()) {
      s.layout.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const kind = CHAR_PROP[row[rx]];
          if (kind === 'fountain') add('fountain', 'fountain', s.x1 + rx, s.y1 + ry);
          else if (kind) add('prop', kind, s.x1 + rx, s.y1 + ry);
        }
      });
    }
    for (const v of (this.zone.villagers || [])) {
      const st = this.zoneSetts()[v.st || 0];
      const e = add('villager', v.art, st.x1 + v.spot[0], st.y1 + v.spot[1]);
      e.name = v.name;
      e.villager = v;
      e.chat = [];
    }
    // ember-shard spires litter crystal country
    for (let i = 0; i < (this.zone.crystals || 0); i++) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (this.map[y][x] === T_GRASS && !this.inVillage(x, y, 1) && !this.entityAt(x, y)) {
        add('prop', 'shard', x, y);
      }
    }
    let placed = 0, guard = 0;
    while (placed < 12 && guard++ < 2500) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (this.map[y][x] === T_GRASS && !this.inVillage(x, y, 3) &&
          dist(x, y, ax, ay) > 10 && !this.entityAt(x, y)) {
        add('chest', 'chest', x, y); placed++;
      }
    }
    const table = this.zone.enemies || [['wolf', 0.5], ['bear', 0.82], ['goblin', 1]];
    let enemies = 0; guard = 0;
    while (enemies < 34 && guard++ < 6000) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (this.map[y][x] !== T_GRASS || this.inVillage(x, y, 6) || this.entityAt(x, y)) continue;
      const roll = grand();
      let pick = table[table.length - 1][0];
      for (const [t2, p] of table) { if (roll < p) { pick = t2; break; } }
      const e = add('enemy', pick, x, y);
      if (pick === 'wisp') e.zOff = 0.35; // wisps drift above the mire
      enemies++;
    }
  }

  // town contents: layout props, the townsfolk, a few chests beyond the walls.
  // No monsters — towns are sanctuary throughout.
  buildTownEntities(add) {
    const CHAR_PROP = { U: 'fountain', W: 'well', L: 'lamp', K: 'campfire', X: 'tent' };
    for (const s of this.zoneSetts()) {
      s.layout.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const kind = CHAR_PROP[row[rx]];
          const gx = s.x1 + rx, gy = s.y1 + ry;
          if (kind === 'fountain') add('fountain', 'fountain', gx, gy);
          else if (kind) add('prop', kind, gx, gy);
        }
      });
    }
    for (const v of (this.zone.villagers || [])) {
      const st = this.zoneSetts()[v.st || 0];
      const e = add('villager', v.art, st.x1 + v.spot[0], st.y1 + v.spot[1]);
      e.name = v.name;
      e.villager = v;
      e.chat = [];
      if (v.roam) { e.roam = v.roam; e.homeGx = e.gx; e.homeGy = e.gy; } // city folk drift about
    }
    let placed = 0, guard = 0;
    while (placed < 4 && guard++ < 1500) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (this.map[y][x] === T_GRASS && !this.inVillage(x, y, 2) && !this.entityAt(x, y)) {
        add('chest', 'chest', x, y); placed++;
      }
    }
  }

  entityAt(gx, gy) { return this.entities.find(e => e.gx === gx && e.gy === gy); }

  onBridge(x, y) { return this.bridgeSet && this.bridgeSet.has(Math.floor(x) + ',' + Math.floor(y)); }

  // the deck arches over the river: BRIDGE_H at the abutments, rising mid-span
  bridgeHAt(x) {
    if (!this.bridgeSpan) return BRIDGE_H;
    const t = clamp((x - this.bridgeSpan.x1) / (this.bridgeSpan.x2 + 1 - this.bridgeSpan.x1), 0, 1);
    return BRIDGE_H + Math.sin(t * Math.PI) * 0.55;
  }

  walkableAt(gx, gy, allowWater) {
    if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) return false;
    if (this.bridgeSet && this.bridgeSet.has(gx + ',' + gy)) return true; // plank deck
    const t = this.map[gy][gx];
    return t <= T_COBBLE || t === T_WOOD || (allowWater && t === T_WATER);
  }

  // ---------- movement & collision ----------

  canStand(x, y) {
    const r = 0.28;
    // Water Walk (or already sinking mid-river) lets the party tread water
    // (buffs may not exist yet — spawn placement runs early in create)
    const aw = (this.buffs && this.time.now < this.buffs.waterwalkUntil) || this._onWater;
    if (!(this.walkableAt(Math.floor(x - r), Math.floor(y - r), aw) &&
          this.walkableAt(Math.floor(x + r), Math.floor(y - r), aw) &&
          this.walkableAt(Math.floor(x - r), Math.floor(y + r), aw) &&
          this.walkableAt(Math.floor(x + r), Math.floor(y + r), aw))) return false;
    // the bridge deck is flat planks over a carved riverbed — skip the slope test
    if (!aw && !this.onBridge(x, y) && this.slopeAt(x, y) > 0.85) return false;
    for (const e of this.entities) {
      if ((e.kind === 'fountain' || e.kind === 'villager') && Math.hypot(e.x - x, e.y - y) < 0.55) return false;
      if (e.kind === 'prop' && Math.hypot(e.x - x, e.y - y) < 0.45) return false;
      if (e.kind === 'tree' && Math.hypot(e.x - x, e.y - y) < 0.38) return false;
      if (e.kind === 'enemy' && Math.hypot(e.x - x, e.y - y) < 0.42) return false;
    }
    return true;
  }

  lineOfSight(x0, y0, x1, y1, h0, h1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d * 3);
    if (h0 === undefined) h0 = this.terrainH(x0, y0) + 0.5;
    if (h1 === undefined) h1 = this.terrainH(x1, y1) + 0.5;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x0 + (x1 - x0) * t, sy = y0 + (y1 - y0) * t;
      const cx = Math.floor(sx), cy = Math.floor(sy);
      if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return false;
      if (this.map[cy][cx] >= 5) return false;                              // walls block sight
      if (this.terrainH(sx, sy) + 0.35 > h0 + (h1 - h0) * t) return false;  // so do hills
    }
    return true;
  }

  enemyCanStand(x, y, self) {
    const r = 0.3;
    if (!(this.walkableAt(Math.floor(x - r), Math.floor(y - r)) &&
          this.walkableAt(Math.floor(x + r), Math.floor(y - r)) &&
          this.walkableAt(Math.floor(x - r), Math.floor(y + r)) &&
          this.walkableAt(Math.floor(x + r), Math.floor(y + r)))) return false;
    if (this.slopeAt(x, y) > 0.85) return false;
    if (this.inVillage(x, y, 0.4)) return false; // monsters never enter the village
    for (const e of this.entities) {
      if (e === self) continue;
      if ((e.kind === 'fountain' || e.kind === 'villager' || e.kind === 'prop') && Math.hypot(e.x - x, e.y - y) < 0.5) return false;
      if (e.kind === 'tree' && Math.hypot(e.x - x, e.y - y) < 0.4) return false;
      if (e.kind === 'enemy' && Math.hypot(e.x - x, e.y - y) < 0.45) return false;
    }
    return true;
  }

  wallHeightAt(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) return 99;
    const t = this.map[gy][gx];
    return t >= 5 ? (WALL_HEIGHT[t] || 1) : 0;
  }

  // height above the ground beneath the party (flying uses absolute altitude)
  agl() {
    return this.flying && this.flyZ !== undefined
      ? this.flyZ - this.terrainH(this.px, this.py)
      : this.eyeZ;
  }

  canFly(x, y) {
    // the winds die at the mountain rim — no leaving the vale
    if (x < 2.5 || y < 2.5 || x > MAP_W - 2.5 || y > MAP_H - 2.5) return false;
    const feetAbs = (this.camZ || this.terrainH(this.px, this.py) + this.eyeZ) - 0.45;
    const r = 0.3;
    for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
      const wt = this.wallHeightAt(Math.floor(cx), Math.floor(cy));
      if (wt > 0 && wt < 90 && this.terrainH(cx, cy) + wt > feetAbs) return false; // building in the way
      if (this.terrainH(cx, cy) > feetAbs) return false;                           // hillside in the way
    }
    return true;
  }

  minEyeAt(x, y) {
    let m = 0.5;
    const r = 0.3;
    for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
      const gx = Math.floor(cx), gy = Math.floor(cy);
      if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) { m = Math.max(m, 2.1); continue; }
      const t = this.map[gy][gx];
      if (t >= 5) m = Math.max(m, (WALL_HEIGHT[t] || 1) + 0.5);
      else if (t === T_WATER) m = Math.max(m, 0.85); // you may hover over water, never land on it
    }
    return m;
  }

  wanderEnemies() {
    if (this.dialogOpen || this.dead) return;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const e of this.entities) {
      if (e.kind !== 'enemy' || e.aggro) continue;
      if (Math.random() < 0.55) continue;
      const choices = Phaser.Utils.Array.Shuffle(dirs.slice());
      for (const [dx, dy] of choices) {
        const nx = e.gx + dx, ny = e.gy + dy;
        if (!this.walkableAt(nx, ny)) continue;
        if (this.entityAt(nx, ny)) continue;
        if (this.inVillage(nx + 0.5, ny + 0.5, 1)) continue;
        e.gx = nx; e.gy = ny;
        break;
      }
    }
    // townsfolk with a roam radius drift around their haunt — a living city
    for (const e of this.entities) {
      if (e.kind !== 'villager' || !e.roam) continue;
      if (Math.random() < 0.6) continue;
      const choices = Phaser.Utils.Array.Shuffle(dirs.slice());
      for (const [dx, dy] of choices) {
        const nx = e.gx + dx, ny = e.gy + dy;
        if (Math.abs(nx - e.homeGx) > e.roam || Math.abs(ny - e.homeGy) > e.roam) continue;
        if (!this.walkableAt(nx, ny) || this.entityAt(nx, ny)) continue;
        if (Math.hypot(nx + 0.5 - this.px, ny + 0.5 - this.py) < 1.2) continue; // don't shove the party
        e.gx = nx; e.gy = ny;
        break;
      }
    }
  }

  // ---------- main loop ----------

  update(time, delta) {
    const dt = Math.min(delta, 100) / 1000;
    const live = !this.dialogOpen && !this.dead;

    if (live) {
      const k = this.keys;
      if (k.LEFT.isDown) this.angle -= 2.6 * dt;
      if (k.RIGHT.isDown) this.angle += 2.6 * dt;
    }
    const dirX = Math.cos(this.angle), dirY = Math.sin(this.angle);

    if (live) {
      const k = this.keys;
      let mx = 0, my = 0;
      if (k.W.isDown || k.UP.isDown) { mx += dirX; my += dirY; }
      if (k.S.isDown || k.DOWN.isDown) { mx -= dirX; my -= dirY; }
      if (k.A.isDown || k.Q.isDown) { mx += dirY; my -= dirX; }
      if (k.D.isDown || k.E.isDown) { mx -= dirY; my += dirX; }
      if (mx || my) {
        const len = Math.hypot(mx, my);
        const speed = this.flying ? 9.5 : 3.1; // the wind carries you SWIFTLY
        const nx = this.px + (mx / len) * speed * dt;
        const ny = this.py + (my / len) * speed * dt;
        if (this.flying) {
          if (this.canFly(nx, this.py)) this.px = nx;
          if (this.canFly(this.px, ny)) this.py = ny;
        } else {
          if (this.canStand(nx, this.py)) this.px = nx;
          if (this.canStand(this.px, ny)) this.py = ny;
        }
      }

      // flight: R/X (or PgUp/PgDn, as in MM7) to rise and dive. flyZ is an
      // ABSOLUTE altitude — you hold your height over hills and valleys alike,
      // instead of contour-following the terrain.
      if (this.flying) {
        const rise = (k.R.isDown || k.PAGE_UP.isDown) ? 1 : 0;
        const dive = (k.X.isDown || k.PAGE_DOWN.isDown) ? 1 : 0;
        if (this.flyZ === undefined) this.flyZ = this.terrainH(this.px, this.py) + this.eyeZ;
        let target = this.flyZ + (rise - dive) * 6.5 * dt;
        if (this.landing) target = this.flyZ - 6.5 * dt;
        const ground = this.terrainH(this.px, this.py);
        const minZ = this.minEyeAt(this.px, this.py); // local floor (walls, water hover)
        this.flyZ = clamp(target, ground + Math.max(0.5, minZ), 30);
        const agl = this.flyZ - ground; // height above the ground below you
        if (this.landing && minZ > 0.5 && agl <= minZ + 0.02) {
          this.landing = false;
          this.toast('No solid ground below!');
        }
        if ((this.landing || dive) && agl <= 0.505 && minZ <= 0.5) {
          if (this.slopeAt(this.px, this.py) < 0.9) {
            this.flying = false; this.landing = false;
            this.eyeZ = 0.5; this.flyZ = undefined;
            this.toast('You touch down.');
            this.refreshHUD();
          } else if (this.landing) {
            this.landing = false;
            this.toast('Too steep to land here!');
          }
        }
        if (this.flying && time > this.flyDrainAt) {
          this.flyDrainAt = time + 4000;
          const c = GameData.party[this.flyCaster];
          if (!c || c.hp <= 0 || c.mp <= 0) {
            this.landing = true;
            this.toast('The spell falters — you sink toward the ground!');
          } else {
            c.mp -= 1;
            this.refreshHUD();
          }
        }
      } else if (this.eyeZ > 0.5) {
        this.eyeZ = Math.max(0.5, this.eyeZ - 1.5 * dt);
      }

      // combat input
      const K = Phaser.Input.Keyboard;
      if (K.JustDown(k.SPACE)) this.partyAttack(time);
      if (K.JustDown(k.ONE)) this.castSkill(0, time);
      if (K.JustDown(k.TWO)) this.castSkill(1, time);
      if (K.JustDown(k.THREE)) this.castSkill(2, time);
      if (K.JustDown(k.FOUR)) this.castSkill(3, time);

      // enemy AI: hunt when close and visible, otherwise drift about
      // (iterate a copy — burning foes can die and splice mid-loop)
      for (const e of [...this.entities]) {
        if (e.kind !== 'enemy' || e.hp <= 0) continue;
        // burning/poison ticks (any DoT; strength set by the spell)
        if (e.burnUntil && time < e.burnUntil && time > (e.burnNext || 0)) {
          e.burnNext = time + 1000;
          this.damageEnemy(e, e.burnPerSec || 3);
          if (e.hp <= 0) continue;
        }
        if (time < (e.sleepUntil || 0)) continue; // dreaming (damage wakes it)
        // charmed foes turn on their own kind
        if (time < (e.charmUntil || 0)) {
          let cb = null, cbd = 8;
          for (const f of this.entities) {
            if (f.kind !== 'enemy' || f === e || f.hp <= 0) continue;
            const d2 = Math.hypot(f.x - e.x, f.y - e.y);
            if (d2 < cbd) { cbd = d2; cb = f; }
          }
          if (cb) {
            if (cbd > 1.1) {
              const step = e.speed * dt;
              const nx = e.x + (cb.x - e.x) / cbd * step;
              const ny = e.y + (cb.y - e.y) / cbd * step;
              if (this.enemyCanStand(nx, e.y, e)) e.x = nx;
              if (this.enemyCanStand(e.x, ny, e)) e.y = ny;
              e.gx = Math.floor(e.x); e.gy = Math.floor(e.y);
            } else if (time > e.nextAtk) {
              e.nextAtk = time + e.cd;
              this.damageEnemy(cb, Math.max(1, e.atk + ri(-1, 2) - this.enemyDef(cb)));
            }
          }
          continue; // ignores the party while charmed
        }
        const pd = Math.hypot(this.px - e.x, this.py - e.y);
        e.aggro = pd < 7 && this.lineOfSight(e.x, e.y, this.px, this.py);
        if (e.aggro) {
          const rooted = time < (e.rootUntil || 0);
          if (pd > 1.15) {
            if (!rooted) {
              const step = (time < (e.slowUntil || 0) ? e.speed * 0.35 : e.speed) * dt;
              const nx = e.x + (this.px - e.x) / pd * step;
              const ny = e.y + (this.py - e.y) / pd * step;
              if (this.enemyCanStand(nx, e.y, e)) e.x = nx;
              if (this.enemyCanStand(e.x, ny, e)) e.y = ny;
              // only adopt a new home cell outside the village — the idle
              // glide is unchecked, so a cell inside would pull them through the walls
              const cgx = Math.floor(e.x), cgy = Math.floor(e.y);
              if (!this.inVillage(cgx + 0.5, cgy + 0.5, 0.4)) { e.gx = cgx; e.gy = cgy; }
            }
          } else if (time > e.nextAtk && this.agl() < 1.05) { // can't claw what flies
            e.nextAtk = time + e.cd;
            this.enemyStrike(e);
          }
        } else {
          const txc = e.gx + 0.5, tyc = e.gy + 0.5;
          const dx = txc - e.x, dy = tyc - e.y, d = Math.hypot(dx, dy);
          if (d > 0.01) {
            const s = Math.min(d, 2.2 * dt);
            e.x += (dx / d) * s; e.y += (dy / d) * s;
          }
        }
      }

      // roaming townsfolk glide gently toward their next spot
      for (const e of this.entities) {
        if (e.kind !== 'villager' || !e.roam) continue;
        const tx = e.gx + 0.5, ty = e.gy + 0.5;
        const dv = Math.hypot(tx - e.x, ty - e.y);
        if (dv > 0.02) {
          const step = Math.min(dv, 0.85 * dt);
          e.x += (tx - e.x) / dv * step;
          e.y += (ty - e.y) / dv * step;
        }
      }

      // summoned allies hunt the nearest enemy
      for (const a of [...this.entities]) {
        if (a.kind !== 'ally') continue;
        if (time > a.until) {
          FX.burst(a.x, this.terrainH(a.x, a.y) + 0.5, a.y, '#c8ccd4', 10);
          this.entities.splice(this.entities.indexOf(a), 1);
          continue;
        }
        let best = null, bd = 9;
        for (const f of this.entities) {
          if (f.kind !== 'enemy' || f.hp <= 0) continue;
          const d2 = Math.hypot(f.x - a.x, f.y - a.y);
          if (d2 < bd) { bd = d2; best = f; }
        }
        if (!best) { // heel: drift back toward the party
          const dp = Math.hypot(this.px - a.x, this.py - a.y);
          if (dp > 2.5) {
            const step = a.speed * dt;
            const nx = a.x + (this.px - a.x) / dp * step, ny = a.y + (this.py - a.y) / dp * step;
            if (this.enemyCanStand(nx, a.y, a)) a.x = nx;
            if (this.enemyCanStand(a.x, ny, a)) a.y = ny;
          }
          continue;
        }
        if (bd > 1.1) {
          const step = a.speed * dt;
          const nx = a.x + (best.x - a.x) / bd * step, ny = a.y + (best.y - a.y) / bd * step;
          if (this.enemyCanStand(nx, a.y, a)) a.x = nx;
          if (this.enemyCanStand(a.x, ny, a)) a.y = ny;
          a.gx = Math.floor(a.x); a.gy = Math.floor(a.y);
        } else if (time > a.nextAtk) {
          a.nextAtk = time + a.cd;
          FX.burst(best.x, this.terrainH(best.x, best.y) + 0.5, best.y, '#c8ccd4', 5, { scale: 0.16 });
          this.damageEnemy(best, Math.max(1, a.atk + ri(0, 3) - this.enemyDef(best)));
        }
      }

      // totems pulse their effects
      for (const t2 of [...this.entities]) {
        if (t2.kind !== 'totem') continue;
        if (time > t2.until) {
          FX.burst(t2.x, this.terrainH(t2.x, t2.y) + 0.5, t2.y, t2.spec.fx.color, 8);
          this.entities.splice(this.entities.indexOf(t2), 1);
          continue;
        }
        if (time > (t2.nextPulse || 0)) {
          t2.nextPulse = time + 2000;
          const vic = this.enemiesNear(t2.x, t2.y, t2.spec.r || 4);
          const partyNear = Math.hypot(this.px - t2.x, this.py - t2.y) < (t2.spec.r || 4) + 1;
          for (const ef of t2.spec.effects) {
            if (['damage', 'dot', 'control', 'hex', 'knockback'].includes(ef.kind)) {
              if (vic.length) {
                const scaled = ef.kind === 'damage' ? { ...ef, amount: Math.ceil((ef.amount || 4) / 2) } : ef;
                this.applyPrimitive(t2.heroIdx, t2.spec, scaled, vic, null, time);
              }
            } else if ((ef.kind === 'heal' || ef.kind === 'buff') && partyNear) {
              const scaled = ef.kind === 'heal' ? { ...ef, amount: Math.ceil((ef.amount || 6) / 3) } : ef;
              this.applyPrimitive(t2.heroIdx, t2.spec, scaled, [], null, time);
            }
          }
          FX.ring(t2.x, this.terrainH(t2.x, t2.y) + 0.15, t2.y, t2.spec.fx.color, t2.spec.r || 4, 10);
        }
      }

      // conjured walls crumble on schedule
      for (let i = this.tempWalls.length - 1; i >= 0; i--) {
        const tw = this.tempWalls[i];
        if (time > tw.until) {
          this.map[tw.y][tw.x] = tw.prev;
          R3D.removeTempWall(tw.mesh);
          FX.burst(tw.x + 0.5, this.terrainH(tw.x + 0.5, tw.y + 0.5) + 0.6, tw.y + 0.5, '#b0985a', 8);
          this.tempWalls.splice(i, 1);
        }
      }

      // buff upkeep: regeneration ticks, water-walk sinking, HUD readout
      this._onWater = !this.onBridge(this.px, this.py) &&
        (this.map[Math.floor(this.py)] || [])[Math.floor(this.px)] === T_WATER;
      if (time < this.buffs.regenUntil && time > this.regenNext) {
        this.regenNext = time + 2000;
        let healed = false;
        for (const h2 of GameData.party) {
          if (h2.hp > 0 && h2.hp < h2.maxHp) { h2.hp = Math.min(h2.maxHp, h2.hp + 3); healed = true; }
        }
        if (healed) this.refreshHUD();
      }
      if (this._onWater && time >= this.buffs.waterwalkUntil && !this.flying && time > this.sinkNext) {
        this.sinkNext = time + 1000;
        GameData.party.forEach(h2 => { if (h2.hp > 0) h2.hp = Math.max(0, h2.hp - 2); });
        this.toast('You are sinking! Make for the shore!');
        this.refreshHUD();
        if (GameData.party.every(h2 => h2.hp <= 0)) { this.partyWipe(); return; }
      }
      const bl = [];
      if (time < this.buffs.atkUntil) bl.push('BLESS ' + Math.ceil((this.buffs.atkUntil - time) / 1000));
      if (time < this.buffs.defUntil) bl.push('STONE ' + Math.ceil((this.buffs.defUntil - time) / 1000));
      if (time < this.buffs.hasteUntil) bl.push('HASTE ' + Math.ceil((this.buffs.hasteUntil - time) / 1000));
      if (time < this.buffs.regenUntil) bl.push('REGEN ' + Math.ceil((this.buffs.regenUntil - time) / 1000));
      if (time < this.buffs.waterwalkUntil) bl.push('WWALK ' + Math.ceil((this.buffs.waterwalkUntil - time) / 1000));
      if (time < this.buffs.dodgeUntil) bl.push('DODGE ' + Math.ceil((this.buffs.dodgeUntil - time) / 1000));
      if (time < this.buffs.reflectUntil) bl.push('AEGIS ' + Math.ceil((this.buffs.reflectUntil - time) / 1000));
      if (time < this.buffs.ghostUntil) bl.push('GHOST ' + Math.ceil((this.buffs.ghostUntil - time) / 1000));
      if (time < this.buffs.deathlessUntil) bl.push('DEATHLESS ' + Math.ceil((this.buffs.deathlessUntil - time) / 1000));
      const bs = bl.join('  ');
      if (bs !== this._buffStr) { this._buffStr = bs; this.buffText.setText(bs); }

      const grounded = this.agl() < 0.7;

      // doors swing open as you approach and shut behind you
      if (grounded) for (const d of this.doors) {
        const dd = Math.hypot(d.x + 0.5 - this.px, d.y + 0.5 - this.py);
        if (!d.open && dd < 1.2) { this.map[d.y][d.x] = T_WOOD; d.open = true; }
        else if (d.open && dd > 2.4) { this.map[d.y][d.x] = T_DOOR; d.open = false; }
      }

      // interactions (only with your boots on the ground)
      const looted = [];
      const picked = [];
      this.nearVillager = null;
      let nearVillagerDist = 1.5;
      if (grounded) for (const e of this.entities) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (e.kind === 'chest' && d < 0.75) looted.push(e);
        if (e.kind === 'item' && d < 0.8) picked.push(e);
        if (e.kind === 'villager' && d < nearVillagerDist) { this.nearVillager = e; nearVillagerDist = d; }
        if (e.kind === 'fountain' && d < 1.0 && time > this.fountainCd) {
          if (GameData.party.some(h => h.hp < h.maxHp || h.mp < h.maxMp)) {
            GameData.party.forEach(h => { h.hp = h.maxHp; h.mp = h.maxMp; });
            this.toast('The fountain restores the party!');
            this.refreshHUD();
          }
          this.fountainCd = time + 4000;
        }
      }
      for (const c of looted) {
        const gold = ri(12, 35);
        GameData.gold += gold;
        this.goneUids.add(c.uid);
        this.entities.splice(this.entities.indexOf(c), 1);
        let itemMsg = '';
        if (Math.random() < 0.75) {
          const far = dist(c.x, c.y, START.x, START.y) > 40;
          const table = far
            ? ['broadsword', 'chain', 'emerald', 'hpotion', 'mpotion', 'emerald']
            : ['shortsword', 'leather', 'hpotion', 'hpotion', 'mpotion', 'emerald'];
          const id = table[ri(0, table.length - 1)];
          if (invAdd(id)) itemMsg = ` + ${ITEM_TYPES[id].name}`;
        }
        // rare finds: spell scrolls (doom itself only hides in the deep east)
        if (Math.random() < 0.14) {
          const far = dist(c.x, c.y, START.x, START.y) > 40;
          const pool = Object.keys(SPELLS).filter(sid =>
            SPELLS[sid].school !== 'martial' && sid !== 'fly' &&
            (far || sid !== 'armageddon') &&
            !GameData.party.some(h2 => h2.spells.includes(sid)));
          if (pool.length) {
            const sid = 'scroll_' + pool[ri(0, pool.length - 1)];
            if (invAdd(sid)) itemMsg += ` + ${ITEM_TYPES[sid].name}`;
          }
        }
        this.toast(`You found a chest! +${gold} gold${itemMsg}`);
        this.refreshHUD();
        this.saveGame();
      }
      for (const it of picked) {
        this.goneUids.add(it.uid);
        this.entities.splice(this.entities.indexOf(it), 1);
        GameData.flags.hasLostBlade = true;
        if (GameData.quests.lostblade !== 'done') GameData.quests.lostblade = 'found';
        invAdd('lostblade');
        this.toast('You recover a masterwork blade! Bram will want to see this.');
        this.refreshHUD();
        this.saveGame();
      }

      if (this.nearVillager) {
        this.talkHint.setText(`[T] Talk to ${this.nearVillager.name}`).setAlpha(1);
      } else {
        this.talkHint.setAlpha(0);
      }

      this.pickTarget();
    }

    // render the 3D view. Flying = absolute altitude; afoot = tread the bridge
    // deck / water surface, never the riverbed.
    const gz = this.onBridge(this.px, this.py) ? this.bridgeHAt(this.px)
      : this._onWater ? Math.max(this.terrainH(this.px, this.py), -0.24)
      : this.terrainH(this.px, this.py);
    this.camZ = this.flying && this.flyZ !== undefined ? this.flyZ : gz + this.eyeZ;
    R3D.render({
      px: this.px, py: this.py, camZ: this.camZ,
      angle: this.angle, pitch: this.pitch, time,
      entities: this.entities,
    });
    this.updateHpBars();
    this.crosshair.setColor(time < this.hitFlashUntil ? '#ffd75e' : '#ffffff');

    this.updateMinimap();
    const oct = Math.round(((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4)) % 8;
    this.compass.setText(['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][oct]);

    if (this.target) {
      this.targetText.setText(`${ENEMY_TYPES[this.target.type].name}  ${this.target.hp}/${this.target.maxHp}`).setAlpha(1);
    } else {
      this.targetText.setAlpha(0);
    }

    GameData.party.forEach((h, i) => {
      const ready = h.hp > 0 && time >= h.readyAt && h.mp >= SPELLS[h.quick].cost;
      const r = this.hudRows[i];
      if (r.skReady !== ready) { r.skReady = ready; r.sk.setColor(ready ? '#c8b060' : '#4a5064'); }
    });
  }

  // ---------- real-time combat ----------

  pickTarget() {
    let best = null, bestD = 14;
    for (const e of this.entities) {
      if (e.kind !== 'enemy') continue;
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < 0.2 || d >= bestD) continue;
      const p = R3D.project(e.x, this.terrainH(e.x, e.y) + 0.45, e.y);
      if (!p || !p.visible) continue;
      if (Math.abs(p.x - 480) > 200 || Math.abs(p.y - 255) > 200) continue; // roughly in your sights
      if (!this.lineOfSight(this.px, this.py, e.x, e.y, this.camZ)) continue;
      best = e; bestD = d;
    }
    this.target = best;
  }

  updateHpBars() {
    const g = this.hpBars;
    g.clear();
    for (const e of this.entities) {
      if (e.kind !== 'enemy' || (e.hp >= e.maxHp && e !== this.target)) continue;
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d > 24) continue;
      if (!this.lineOfSight(this.px, this.py, e.x, e.y, this.camZ)) continue;
      const hgt = 1 / (e.vDiv || 1);
      const p = R3D.project(e.x, this.terrainH(e.x, e.y) + hgt + 0.12, e.y);
      if (!p || !p.visible) continue;
      const bw = clamp(340 / d, 16, 84);
      const bx = p.x - bw / 2, by = p.y - 6;
      g.fillStyle(0x2a0d10, 1);
      g.fillRect(bx, by, bw, 6);
      g.fillStyle(e === this.target ? 0xff5a4a : 0xb03535, 1);
      g.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 6);
      if (e === this.target) {
        g.lineStyle(2, 0xffd75e, 1);
        g.strokeRect(bx - 2, by - 2, bw + 4, 10);
      }
    }
  }

  partyAttack(time) {
    if (this.dead || this.dialogOpen || this.sbOpen || this.invOpen || this.shopOpen || this.wmOpen) return;
    const t = this.target;
    if (!t) {
      if (time > (this._attackMsgCd || 0)) { this.toast('No monster in your sights.'); this._attackMsgCd = time + 1500; }
      return;
    }
    const d = Math.hypot(t.x - this.px, t.y - this.py, this.agl() - 0.5); // altitude counts
    let fired = 0;
    const volleyColors = { Roderick: '#e8e8f0', Wren: '#e8d8a0', Serena: '#f0f0ff', Malwick: '#c080ff' };
    GameData.party.forEach((h, hi) => {
      if (h.hp <= 0 || time < h.readyAt || d > h.range || t.hp <= 0) return;
      h.readyAt = time + h.rec * this.hasteMul();
      fired++;
      const ghost = time < this.buffs.ghostUntil ? 3 : 0; // Ghost Blades: spectral true damage
      if (FX.ready) {
        const az = this.terrainH(t.x, t.y) + 0.5;
        if (h.range > 3) {
          // ranged heroes loose visible missiles, spread across the party line
          const sideX = Math.cos(this.angle + Math.PI / 2) * (hi - 1.5) * 0.22;
          const sideY = Math.sin(this.angle + Math.PI / 2) * (hi - 1.5) * 0.22;
          FX.bolt(this.px + sideX, this.camZ - 0.2, this.py + sideY, t.x, az, t.y,
            volleyColors[h.name] || '#e8e8e8', { scale: 0.22, burst: 5, speed: 20 });
        } else {
          FX.burst(t.x, az, t.y, volleyColors[h.name] || '#e8e8e8', 8, { scale: 0.2 });
        }
      }
      this.damageEnemy(t, Math.max(1, heroAtk(h) + this.buffAtk() + h.level + ri(0, 3) - this.enemyDef(t)) + ghost);
    });
    if (!fired && time > (this._attackMsgCd || 0)) {
      this.toast(d > 2.2 ? 'Too far for Roderick — the others are recovering...' : 'The party is recovering...');
      this._attackMsgCd = time + 1200;
    }
  }

  // ---------- buffs & spell helpers ----------

  buffAtk() { return this.time.now < this.buffs.atkUntil ? 2 : 0; }
  buffDef() { return this.time.now < this.buffs.defUntil ? 3 : 0; }
  hasteMul() { return this.time.now < this.buffs.hasteUntil ? 0.65 : 1; }

  enemiesNear(cx, cy, r) {
    return this.entities.filter(e => e.kind === 'enemy' && Math.hypot(e.x - cx, e.y - cy) < r);
  }

  knockback(e, dist) {
    const dx = e.x - this.px, dy = e.y - this.py;
    const d = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < Math.ceil(dist / 0.3); i++) {
      const nx = e.x + (dx / d) * 0.3, ny = e.y + (dy / d) * 0.3;
      if (!this.enemyCanStand(nx, ny, e)) break;
      e.x = nx; e.y = ny;
    }
    e.gx = Math.floor(e.x); e.gy = Math.floor(e.y);
  }

  // generic spell visuals, driven by SPELLS[id].fx = {type, color, r} —
  // adding a new spell's look is data in the registry, not code here
  spellFX(spellId, t) {
    const sp = SPELLS[spellId];
    const fx = sp && sp.fx;
    if (!fx || !FX.ready) return;
    if (sp.shape === 'projectile') return; // the executor owns its own missile
    const fz = this.camZ - 0.15;
    const from = [this.px + Math.cos(this.angle) * 0.4, fz, this.py + Math.sin(this.angle) * 0.4];
    const at = t ? [t.x, this.terrainH(t.x, t.y) + 0.5, t.y] : null;
    switch (fx.type) {
      case 'bolt': if (at) FX.bolt(from[0], from[1], from[2], at[0], at[1], at[2], fx.color); break;
      case 'beam': if (at) FX.beam(from[0], from[1], from[2], at[0], at[1], at[2], fx.color); break;
      case 'nova': FX.ring(this.px, this.terrainH(this.px, this.py) + 0.2, this.py, fx.color, fx.r || 4); break;
      case 'self': FX.burst(this.px, this.camZ - 0.35, this.py, fx.color, 16, { grav: 1.2, speed: 1.4, life: 0.7 }); break;
    }
  }

  // ---------- spec-spell plumbing (src/spellcraft.js drives these) ----------

  enemyDef(e) {
    return Math.max(0, e.def - (this.time.now < (e.hexUntil || 0) ? (e.hexAmount || 2) : 0));
  }

  // guild training pays off: each rank in a school = +25% spell potency
  rankMul(h, school) {
    return 1 + 0.25 * ((h && h.skillRank && h.skillRank[school]) || 0);
  }

  castFromSpec(idx, spec, target, time) {
    return applyEffects(this, idx, spec, target, time);
  }

  applyPrimitive(heroIdx, spec, ef, victims, target, time) {
    const h = GameData.party[heroIdx] || GameData.party[0];
    const rk = this.rankMul(h, spec.school); // trained schools hit harder
    switch (ef.kind) {
      case 'damage':
        victims.forEach(v => this.damageEnemy(v, Math.max(1, Math.round(((ef.amount || 4) + h.level) * rk) - (ef.true ? 0 : this.enemyDef(v)))));
        break;
      case 'dot':
        victims.forEach(v => {
          v.burnUntil = time + (ef.secs || 4) * 1000;
          v.burnNext = time + 1000;
          v.burnPerSec = Math.round((ef.perSec || 3) * rk);
          v.burnHop = !!ef.hop;
        });
        break;
      case 'heal': {
        const living = GameData.party.filter(x => x.hp > 0);
        const targets = ef.party ? living
          : [living.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b))];
        const amt = Math.round((ef.amount || 8) * rk);
        targets.forEach(x => {
          x.hp = Math.min(x.maxHp, x.hp + amt);
          this.floatText(12 + GameData.party.indexOf(x) * 236 + 113, 545, `+${amt}`, '#80ff9a');
        });
        break;
      }
      case 'buff': {
        const key = { atk: 'atkUntil', def: 'defUntil', haste: 'hasteUntil', dodge: 'dodgeUntil', reflect: 'reflectUntil', ghost: 'ghostUntil', deathless: 'deathlessUntil' }[ef.stat];
        if (key) this.buffs[key] = time + (ef.secs || 12) * 1000;
        break;
      }
      case 'control':
        victims.forEach(v => {
          const ms = (ef.secs || 3) * 1000;
          if (ef.c === 'root') v.rootUntil = time + ms;
          else if (ef.c === 'slow') v.slowUntil = time + ms;
          else if (ef.c === 'sleep') v.sleepUntil = time + ms;
          else if (ef.c === 'daze') v.nextAtk = Math.max(v.nextAtk, time + ms);
          else if (ef.c === 'charm') v.charmUntil = time + ms;
        });
        break;
      case 'knockback': victims.forEach(v => this.knockback(v, ef.amount || 2)); break;
      case 'summon': this.summonAlly(ef.type === 'golem' ? 'golem' : 'wisp', ef.secs || 20); break;
      case 'drain': {
        const amt = Math.round((ef.amount || 8) * rk);
        victims.forEach(v => this.damageEnemy(v, Math.max(1, amt)));
        h.hp = Math.min(h.maxHp, h.hp + amt);
        this.floatText(12 + heroIdx * 236 + 113, 545, `+${amt}`, '#c83a5a');
        break;
      }
      case 'hex':
        victims.forEach(v => { v.hexUntil = time + (ef.secs || 8) * 1000; v.hexAmount = ef.amount || 2; });
        break;
      case 'blink': {
        let bx = this.px, by = this.py;
        if (ef.behind && target) {
          const a = Math.atan2(target.y - this.py, target.x - this.px);
          const cx = target.x + Math.cos(a) * 1.2, cy = target.y + Math.sin(a) * 1.2;
          if (this.canStand(cx, cy)) { bx = cx; by = cy; }
        } else {
          const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
          for (let d = ef.dist || 6; d > 0.5; d -= 0.5) {
            const cx = this.px + dx * d, cy = this.py + dy * d;
            if (this.canStand(cx, cy)) { bx = cx; by = cy; break; }
          }
        }
        FX.burst(this.px, this.camZ - 0.3, this.py, spec.fx.color, 10);
        this.px = bx; this.py = by;
        FX.burst(bx, this.terrainH(bx, by) + 0.5, by, spec.fx.color, 12);
        break;
      }
      case 'wall': {
        const perpA = this.angle + Math.PI / 2;
        const cx2 = this.px + Math.cos(this.angle) * 2.2, cy2 = this.py + Math.sin(this.angle) * 2.2;
        const half = Math.floor((ef.len || 3) / 2);
        for (let i = -half; i <= half; i++) {
          const wx = Math.floor(cx2 + Math.cos(perpA) * i), wy = Math.floor(cy2 + Math.sin(perpA) * i);
          if (!this.walkableAt(wx, wy) || this.inVillage(wx, wy, 0)) continue;
          if (Math.floor(this.px) === wx && Math.floor(this.py) === wy) continue;
          if (this.tempWalls.some(t2 => t2.x === wx && t2.y === wy)) continue;
          const prev = this.map[wy][wx];
          this.map[wy][wx] = T_STONE;
          this.tempWalls.push({ x: wx, y: wy, prev, until: time + (ef.secs || 10) * 1000, mesh: R3D.addTempWall(wx, wy) });
        }
        break;
      }
      case 'recall': {
        this.flying = false; this.landing = false; this.eyeZ = 0.5; this.pitch = 0; this.flyZ = undefined;
        const [rx, ry] = this.spawnPoint();
        this.px = rx; this.py = ry;
        this.ensureStandable();
        this.toast('The world folds — you stand at safe ground.');
        break;
      }
      case 'execute':
        victims.forEach(v => this.damageEnemy(v, Math.max(1, Math.round((v.maxHp - v.hp) * (ef.factor || 0.4)))));
        break;
      case 'mpgain': {
        const hpc = ef.hpcost || 0;
        if (h.hp <= hpc) { this.toast('Not enough life to trade!'); break; }
        if (hpc) {
          h.hp -= hpc;
          this.floatText(12 + heroIdx * 236 + 113, 545, `-${hpc}`, '#ff8080');
        }
        h.mp = Math.min(h.maxMp, h.mp + (ef.amount || 10));
        break;
      }
      case 'spikes': {
        const cx3 = target ? target.x : this.px, cy3 = target ? target.y : this.py;
        for (let i = 0; i < (ef.count || 6); i++) {
          this.time.delayedCall(i * 240, () => {
            const a = Math.random() * Math.PI * 2, rr = Math.random() * (ef.r || 4);
            const sx = cx3 + Math.cos(a) * rr, sy = cy3 + Math.sin(a) * rr;
            const gz = this.terrainH(sx, sy);
            FX.burst(sx, gz + 0.4, sy, spec.fx.color, 8, { speed: 3, grav: -6 });
            this.enemiesNear(sx, sy, 1.1).forEach(v => this.damageEnemy(v, Math.max(1, Math.round((ef.amount || 6) * rk) - this.enemyDef(v))));
          });
        }
        break;
      }
    }
  }

  summonAlly(type, secs) {
    if (this.entities.filter(e => e.kind === 'ally').length >= 2) {
      this.toast('The weave supports only two servants at once.');
      return;
    }
    let ax = this.px + Math.cos(this.angle + 0.9) * 1.4;
    let ay = this.py + Math.sin(this.angle + 0.9) * 1.4;
    if (!this.canStand(ax, ay)) { ax = this.px; ay = this.py; }
    const stats = type === 'golem'
      ? { atk: 12, speed: 2.0, cd: 1200 }
      : { atk: 6, speed: 3.2, cd: 900 };
    this.entities.push({
      kind: 'ally', type, art: type, gx: Math.floor(ax), gy: Math.floor(ay),
      x: ax, y: ay, vDiv: SPRITE_META[type].vDiv, uid: -1000 - this.entities.length,
      ...stats, nextAtk: 0, until: this.time.now + secs * 1000,
    });
    FX.burst(ax, this.terrainH(ax, ay) + 0.6, ay, '#c8ccd4', 14);
  }

  placeTotem(spec, time, heroIdx) {
    const tx = this.px + Math.cos(this.angle) * 1.4, ty = this.py + Math.sin(this.angle) * 1.4;
    this.entities.push({
      kind: 'totem', type: 'totemArt', art: 'totemArt',
      gx: Math.floor(tx), gy: Math.floor(ty), x: tx, y: ty,
      vDiv: SPRITE_META.totemArt.vDiv, uid: -5000 - this.entities.length,
      spec, heroIdx: heroIdx || 0, until: time + (spec.secs || 15) * 1000, nextPulse: 0,
    });
  }

  registerCraftedSpell(spec, learner) {
    if (typeof spec.cost !== 'number') { // defensive: never register a costless spell
      const v = validateSpellSpec(spec);
      spec.cost = v.cost || 6;
    }
    spec.id = 'crafted_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4);
    spec.icon = 'rune_' + spec.id;
    spec.crafted = true;
    SPELLS[spec.id] = spec;
    makeRuneIcon(spec.icon, spec.school, spec.name);
    this.textures.addCanvas(spec.icon, ART[spec.icon]);
    GameData.craftedSpells.push(spec);
    learner.spells.push(spec.id);
    learner.quick = spec.id;
    this.refreshHUD();
    this.toast(`${learner.name} learns ${spec.name}! (woven — key ${GameData.party.indexOf(learner) + 1})`);
    this.saveGame();
  }

  castSkill(idx, time) {
    if (this.dead || this.dialogOpen || this.sbOpen || this.invOpen || this.shopOpen || this.wmOpen) return;
    const h = GameData.party[idx];
    if (!h || h.hp <= 0) return;
    if (h.quick === 'fly' && this.flying) { // landing is always free
      this.landing = true;
      this.toast('You angle down to land...');
      return;
    }
    if (time < h.readyAt) return;
    const spell = SPELLS[h.quick];
    if (h.mp < spell.cost) { this.toast(`${h.name} lacks the mana for ${spell.name}!`); return; }
    const t = this.target;
    const tDist = t ? Math.hypot(t.x - this.px, t.y - this.py, this.agl() - 0.5) : Infinity;
    let ok = false;

    switch (h.quick) {
      case 'cleave': {
        const victims = this.entities.filter(e => e.kind === 'enemy' && Math.hypot(e.x - this.px, e.y - this.py, this.agl() - 0.5) < 2.6);
        if (!victims.length) { this.toast('No foes within reach of the cleave!'); return; }
        victims.forEach(v => this.damageEnemy(v, Math.max(1, Math.round(heroAtk(h) * 0.7) + this.buffAtk() + h.level + ri(0, 2) - this.enemyDef(v))));
        ok = true;
        break;
      }
      case 'doubleshot': {
        if (!t || tDist > 9) { this.toast('No target in bow range!'); return; }
        this.damageEnemy(t, Math.max(1, Math.round(heroAtk(h) * 0.8) + this.buffAtk() + h.level + ri(0, 2) - this.enemyDef(t)));
        this.time.delayedCall(160, () => {
          if (t.hp > 0 && this.entities.includes(t)) {
            this.damageEnemy(t, Math.max(1, Math.round(heroAtk(h) * 0.8) + this.buffAtk() + h.level + ri(0, 2) - this.enemyDef(t)));
          }
        });
        ok = true;
        break;
      }
      case 'heal': {
        const living = GameData.party.filter(x => x.hp > 0);
        const target = living.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
        const amt = 14 + h.level * 3;
        target.hp = Math.min(target.maxHp, target.hp + amt);
        this.floatText(12 + GameData.party.indexOf(target) * 236 + 113, 545, `+${amt}`, '#80ff9a');
        ok = true;
        break;
      }
      case 'fireball': {
        if (!t || tDist > 8) { this.toast('No target for the fireball!'); return; }
        this.cameras.main.flash(120, 255, 140, 40);
        if (FX.ready) FX.ring(t.x, this.terrainH(t.x, t.y) + 0.2, t.y, '#ff7020', 2.2);
        const victims = this.entities.filter(e => e.kind === 'enemy' && Math.hypot(e.x - t.x, e.y - t.y) < 2);
        victims.forEach(v => this.damageEnemy(v, Math.max(1, 9 + h.level * 3 + ri(0, 3) - this.enemyDef(v))));
        ok = true;
        break;
      }
      case 'fly': {
        this.flying = true;
        this.landing = false;
        this.flyCaster = idx;
        this.flyDrainAt = time + 4000;
        this.flyZ = this.terrainH(this.px, this.py) + 0.75; // lift off (absolute altitude)

        this.toast('The party takes wing! R/X (or PgUp/PgDn) to rise and dive — cast Fly again to land.');
        ok = true;
        break;
      }
      case 'frostnova': {
        const victims = this.entities.filter(e => e.kind === 'enemy' && Math.hypot(e.x - this.px, e.y - this.py, this.agl() - 0.5) < 3.5);
        if (!victims.length) { this.toast('No foes near enough to freeze!'); return; }
        this.cameras.main.flash(140, 120, 180, 255);
        victims.forEach(v => {
          this.damageEnemy(v, Math.max(1, 7 + h.level * 2));
          v.slowUntil = time + 2600;
          v.nextAtk = Math.max(v.nextAtk, time + 1800);
        });
        ok = true;
        break;
      }

      // ---- fire ----
      case 'firebolt': {
        if (!t || tDist > 8) { this.toast('No target in range!'); return; }
        this.damageEnemy(t, Math.max(1, 6 + h.level * 2 + ri(0, 2) - this.enemyDef(t)));
        if (t.hp > 0) { t.burnUntil = time + 4000; t.burnNext = time + 1000; }
        ok = true;
        break;
      }
      case 'ringfire': {
        const victims = this.enemiesNear(this.px, this.py, 4);
        if (!victims.length) { this.toast('No foes near enough to burn!'); return; }
        this.cameras.main.flash(160, 255, 110, 20);
        victims.forEach(v => {
          this.damageEnemy(v, Math.max(1, 8 + h.level * 2 + ri(0, 3) - this.enemyDef(v)));
          if (v.hp > 0) { v.burnUntil = time + 4000; v.burnNext = time + 1000; }
        });
        ok = true;
        break;
      }

      // ---- air ----
      case 'spark': {
        if (!t || tDist > 9) { this.toast('No target in range!'); return; }
        this.cameras.main.flash(80, 200, 230, 255);
        const dmg = 5 + h.level * 2 + ri(0, 3);
        this.damageEnemy(t, Math.max(1, dmg - this.enemyDef(t)));
        const chained = this.enemiesNear(t.x, t.y, 3).filter(v => v !== t && v.hp > 0).slice(0, 2);
        chained.forEach(v => {
          if (FX.ready) {
            FX.beam(t.x, this.terrainH(t.x, t.y) + 0.6, t.y,
              v.x, this.terrainH(v.x, v.y) + 0.6, v.y, '#a0e0ff');
          }
          this.damageEnemy(v, Math.max(1, Math.round(dmg * 0.6) - this.enemyDef(v)));
        });
        ok = true;
        break;
      }
      case 'thunderclap': {
        const victims = this.enemiesNear(this.px, this.py, 4);
        if (!victims.length) { this.toast('No foes near enough!'); return; }
        this.cameras.main.shake(160, 0.008);
        victims.forEach(v => {
          this.damageEnemy(v, Math.max(1, 4 + h.level + ri(0, 2)));
          if (v.hp > 0) {
            this.knockback(v, 2.5);
            v.nextAtk = Math.max(v.nextAtk, time + 2500);
          }
        });
        ok = true;
        break;
      }

      // ---- water ----
      case 'icebolt': {
        if (!t || tDist > 9) { this.toast('No target in range!'); return; }
        this.damageEnemy(t, Math.max(1, 6 + h.level * 2 + ri(0, 2) - this.enemyDef(t)));
        if (t.hp > 0) t.slowUntil = time + 3000;
        ok = true;
        break;
      }
      case 'waterwalk': {
        this.buffs.waterwalkUntil = time + 25000;
        this.toast('The party may tread water awhile — mind the timer!');
        ok = true;
        break;
      }

      // ---- earth ----
      case 'rockblast': {
        if (!t || tDist > 8) { this.toast('No target in range!'); return; }
        this.damageEnemy(t, Math.max(1, 8 + h.level * 3 + ri(0, 3) - this.enemyDef(t)));
        if (t.hp > 0) this.knockback(t, 2);
        ok = true;
        break;
      }
      case 'stoneskin': {
        this.buffs.defUntil = time + 30000;
        this.toast("The party's skin turns to stone: +3 DEF awhile.");
        ok = true;
        break;
      }
      case 'roots': {
        const victims = this.enemiesNear(this.px, this.py, 5);
        if (!victims.length) { this.toast('No foes near enough!'); return; }
        victims.forEach(v => { v.rootUntil = time + 3500; });
        this.toast(`Roots erupt — ${victims.length} foe${victims.length > 1 ? 's' : ''} held fast!`);
        ok = true;
        break;
      }

      // ---- body ----
      case 'regen': {
        this.buffs.regenUntil = time + 20000;
        this.regenNext = 0;
        this.toast("The party's wounds begin to knit closed.");
        ok = true;
        break;
      }
      case 'greatheal': {
        const amt = 18 + h.level * 4;
        GameData.party.forEach((x, i) => {
          if (x.hp > 0 && x.hp < x.maxHp) {
            x.hp = Math.min(x.maxHp, x.hp + amt);
            this.floatText(12 + i * 236 + 113, 545, `+${amt}`, '#80ff9a');
          }
        });
        ok = true;
        break;
      }

      // ---- spirit ----
      case 'bless': {
        this.buffs.atkUntil = time + 30000;
        this.toast('The party is blessed: +2 ATK awhile.');
        ok = true;
        break;
      }
      case 'spiritlash': {
        if (!t || tDist > 8) { this.toast('No target in range!'); return; }
        this.damageEnemy(t, 10 + h.level * 3 + ri(0, 2)); // no armor can turn it
        ok = true;
        break;
      }
      case 'raisedead': {
        const fallen = GameData.party.find(x => x.hp <= 0);
        if (!fallen) { this.toast('No one needs raising, gods be thanked.'); return; }
        fallen.hp = Math.ceil(fallen.maxHp * 0.35);
        this.floatText(12 + GameData.party.indexOf(fallen) * 236 + 113, 545, 'RISE', '#e8e8f8');
        this.toast(`${fallen.name} staggers back to their feet!`);
        ok = true;
        break;
      }

      // ---- light ----
      case 'sunray': {
        if (!t || tDist > 10) { this.toast('No target in range!'); return; }
        this.cameras.main.flash(100, 255, 240, 160);
        this.damageEnemy(t, Math.max(1, 14 + h.level * 4 + ri(0, 4) - this.enemyDef(t)));
        if (t.hp > 0) t.nextAtk = Math.max(t.nextAtk, time + 3000);
        ok = true;
        break;
      }
      case 'prismatic': {
        const victims = this.enemiesNear(this.px, this.py, 9)
          .filter(v => this.lineOfSight(this.px, this.py, v.x, v.y, this.camZ));
        if (!victims.length) { this.toast('No foes in sight!'); return; }
        this.cameras.main.flash(180, 255, 255, 255);
        victims.forEach(v => this.damageEnemy(v, Math.max(1, 9 + h.level * 3 + ri(0, 3) - this.enemyDef(v))));
        GameData.party.forEach(x => { if (x.hp > 0) x.hp = Math.min(x.maxHp, x.hp + 6); });
        ok = true;
        break;
      }
      case 'hourofpower': {
        this.buffs.atkUntil = time + 15000;
        this.buffs.defUntil = time + 15000;
        this.buffs.hasteUntil = time + 15000;
        this.cameras.main.flash(150, 255, 230, 140);
        this.toast('HOUR OF POWER! Blessed, stone-skinned, and swift.');
        ok = true;
        break;
      }

      // ---- dark ----
      case 'drain': {
        if (!t || tDist > 8) { this.toast('No target in range!'); return; }
        const dmg = 8 + h.level * 3 + ri(0, 2);
        this.damageEnemy(t, dmg);
        h.hp = Math.min(h.maxHp, h.hp + dmg);
        this.floatText(12 + idx * 236 + 113, 545, `+${dmg}`, '#c83a5a');
        ok = true;
        break;
      }
      case 'curse': {
        if (!t || tDist > 9) { this.toast('No target in range!'); return; }
        t.curseUntil = time + 8000;
        t.slowUntil = time + 8000;
        const p = this.projectEntity(t);
        if (p) this.floatText(p.x, p.y, 'CURSED', '#c8a8e0');
        ok = true;
        break;
      }
      case 'armageddon': {
        this.cameras.main.flash(400, 255, 60, 30);
        this.cameras.main.shake(500, 0.012);
        const all = this.entities.filter(x => x.kind === 'enemy');
        all.forEach(v => {
          if (FX.ready) {
            const vz = this.terrainH(v.x, v.y);
            FX.bolt(v.x + 1.5, vz + 7, v.y - 1, v.x, vz + 0.4, v.y, '#ff5020', { speed: 22, burst: 14, scale: 0.45 });
          }
          this.damageEnemy(v, 25 + h.level * 5);
        });
        GameData.party.forEach(x => { if (x.hp > 0) x.hp = Math.max(1, x.hp - 8); });
        this.toast(`ARMAGEDDON! The sky falls on ${all.length} monsters — and scorches the party.`);
        ok = true;
        break;
      }

      default: {
        // spec spells (data-authored or player-crafted) run through the executor
        if (spell.effects) {
          const res = this.castFromSpec(idx, spell, t, time);
          if (!res.ok) { if (res.msg) this.toast(res.msg); return; }
          ok = true;
        }
        break;
      }
    }

    if (ok) {
      this.spellFX(h.quick, t);
      h.mp -= spell.cost;
      h.readyAt = time + h.rec * 1.3 * this.hasteMul();
      this.refreshHUD();
    }
  }

  damageEnemy(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flinch = this.time.now + 160; // recoil pop + red flash (render3d)
    if (e.sleepUntil) e.sleepUntil = 0; // pain wakes the dreaming
    if (FX.ready) FX.burst(e.x, this.terrainH(e.x, e.y) + 0.55, e.y, '#ffcfa0', 6, { scale: 0.17, speed: 1.6, life: 0.35 });
    const p = this.projectEntity(e);
    if (p) this.floatText(p.x + ri(-16, 16), p.y, `-${dmg}`, '#ff9a80');
    this.hitFlashUntil = this.time.now + 130;
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const gold = ri(e.gold[0], e.gold[1]);
    GameData.gold += gold;
    const notes = this.grantXP(e.xp);
    this.goneUids.add(e.uid);
    // fade-and-sink death: mark 'dying' (AI/targeting/queries all skip it) and
    // remove after the animation. Rewards are granted now, so nothing's delayed.
    e.kind = 'dying';
    e.dying = this.time.now;
    this.time.delayedCall(680, () => {
      const i = this.entities.indexOf(e);
      if (i >= 0) this.entities.splice(i, 1);
    });
    if (this.target === e) this.target = null;
    // the Plague leaps to the nearest living thing
    if (e.burnHop && this.time.now < (e.burnUntil || 0)) {
      const next = this.enemiesNear(e.x, e.y, 4).filter(v => v.hp > 0)[0];
      if (next) {
        next.burnUntil = e.burnUntil;
        next.burnNext = this.time.now + 600;
        next.burnPerSec = e.burnPerSec;
        next.burnHop = true;
        if (FX.ready) FX.beam(e.x, this.terrainH(e.x, e.y) + 0.6, e.y, next.x, this.terrainH(next.x, next.y) + 0.6, next.y, '#80c030');
      }
    }
    let dropMsg = '';
    if (Math.random() < 0.22) {
      const id = e.type === 'wolf'
        ? (Math.random() < 0.5 ? 'emerald' : 'hpotion')
        : (Math.random() < 0.5 ? 'hpotion' : 'mpotion');
      if (invAdd(id)) dropMsg = `, ${ITEM_TYPES[id].name}`;
    }
    this.toast(`${ENEMY_TYPES[e.type].name} slain! +${e.xp} XP, +${gold} gold${dropMsg}` + (notes.length ? ' — ' + notes.join(' ') : ''));
    // Lord Aldric's charge: count dire wolves while the cull is on
    if (e.type === 'wolf' && GameData.quests.wolfcull === 'active') {
      GameData.flags.wolfKills = (GameData.flags.wolfKills || 0) + 1;
      if (GameData.flags.wolfKills >= QUESTS.wolfcull.need) {
        GameData.quests.wolfcull = 'ready';
        this.toast(`That makes ${QUESTS.wolfcull.need} — return to Lord Aldric at Oakhearth!`);
      } else {
        this.toast(`Wolf culled (${GameData.flags.wolfKills}/${QUESTS.wolfcull.need}) — Aldric pays well.`);
      }
    }
    if (!this.entities.some(x => x.kind === 'enemy')) {
      this.time.delayedCall(1500, () => this.toast('The vale is at peace... you cleared every monster!'));
    }
    this.refreshHUD();
    this.saveGame();
  }

  enemyStrike(e) {
    e.lunge = this.time.now + 220; // hop toward the party (render3d)
    if (this.time.now < this.invulnUntil) return;
    const targets = GameData.party.filter(h => h.hp > 0);
    if (!targets.length) return;
    const h = targets[ri(0, targets.length - 1)];
    if (this.time.now < this.buffs.dodgeUntil && Math.random() < 0.25) {
      this.floatText(12 + GameData.party.indexOf(h) * 236 + 113, 545, 'MISS', '#c8e8ff');
      return;
    }
    const atkVal = this.time.now < (e.curseUntil || 0) ? Math.ceil(e.atk / 2) : e.atk;
    const dmg = Math.max(1, atkVal + ri(-1, 2) - heroDef(h) - this.buffDef());
    if (this.time.now < this.buffs.reflectUntil) this.damageEnemy(e, Math.max(1, Math.round(dmg * 0.3)));
    h.hp = Math.max(0, h.hp - dmg);
    this.floatText(12 + GameData.party.indexOf(h) * 236 + 113, 545, `-${dmg}`, '#ff8080');
    this.tweens.add({ targets: this.dmgVignette, alpha: { from: 0.32, to: 0 }, duration: 300 });
    this.cameras.main.shake(80, 0.003);
    this.refreshHUD();
    if (h.hp === 0) this.toast(`${h.name} falls!`);
    if (GameData.party.every(x => x.hp <= 0)) this.partyWipe();
  }

  partyWipe() {
    if (this.dead) return;
    this.dead = true;
    this.target = null;
    const shade = this.add.rectangle(0, 0, 960, 640, 0x000000, 0.75).setOrigin(0).setDepth(2000);
    const msg = this.add.text(480, 280, 'THE PARTY HAS FALLEN...', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ff8080',
    }).setOrigin(0.5).setDepth(2001);
    this.time.delayedCall(2200, () => {
      GameData.gold = Math.floor(GameData.gold / 2);
      GameData.party.forEach(h => { h.hp = Math.ceil(h.maxHp * 0.5); h.mp = h.maxMp; h.readyAt = 0; });
      const [dpx, dpy] = this.spawnPoint();
      this.px = dpx; this.py = dpy; this.angle = 0;
      this.pitch = 0; this.eyeZ = 0.5; this.flying = false; this.landing = false; this.flyZ = undefined;
      this.ensureStandable();
      this.invulnUntil = this.time.now + 3000;
      shade.destroy(); msg.destroy();
      this.dead = false;
      this.refreshHUD();
      this.toast('The party wakes at camp, lighter of purse...');
    });
  }

  // project an entity into HUD-space screen coords (for damage floaters)
  projectEntity(e) {
    const hgt = 1 / (e.vDiv || 1);
    const p = R3D.project(e.x, this.terrainH(e.x, e.y) + hgt + 0.15, e.y);
    if (!p) return null;
    return { x: clamp(p.x, 20, 940), y: Math.max(24, p.y) };
  }

  floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'monospace', fontSize: '17px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1500);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  // ---------- villager dialogue ----------

  openDialogue(v) {
    this.dialogOpen = true;
    this.talkHint.setAlpha(0);
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.keyboard.enabled = false;
    this.input.keyboard.disableGlobalCapture();
    Dialogue.openFor(v, this);
  }

  dialogueClosed() {
    this.dialogOpen = false;
    this.input.keyboard.enabled = true;
    this.input.keyboard.enableGlobalCapture();
    this.input.keyboard.resetKeys();
    this.invulnUntil = this.time.now + 800;
  }

  // ---------- spellbook ----------

  buildSpellbook() {
    this.sbOpen = false;
    this.sbItems = [];
    this.sbContainer = this.add.container(0, 0).setDepth(3000).setVisible(false);
    this.sbContainer.add(this.add.image(480, 250, 'panel_ui'));
    this.sbContainer.add(this.add.text(480, 54, '— SPELLBOOK —', {
      fontFamily: 'monospace', fontSize: '22px', color: '#3a2c14', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.sbContainer.add(this.add.text(480, 80, "click a spell to ready it on that hero's key  ·  B closes", {
      fontFamily: 'monospace', fontSize: '12px', color: '#6a5636',
    }).setOrigin(0.5));
  }

  openSpellbook() {
    if (this.invOpen) this.closeInventory();
    if (this.shopOpen) this.closeShop();
    this.sbOpen = true;
    if (this.sbSel === undefined) this.sbSel = 0;
    for (const t of this.sbItems) t.destroy();
    this.sbItems = [];
    const add = o => { this.sbItems.push(o.setDepth(3001)); return o; };

    // hero tabs down the left edge of the book
    GameData.party.forEach((h, i) => {
      const x = 148, y = 130 + i * 82;
      const sel = i === this.sbSel;
      const tab = add(this.add.rectangle(x, y, 100, 74, 0x8a6f28, sel ? 0.3 : 0.07)
        .setStrokeStyle(sel ? 3 : 1, sel ? 0xc9a227 : 0x6a5a38))
        .setInteractive({ useHandCursor: true });
      tab.on('pointerdown', () => { this.sbSel = i; this.openSpellbook(); });
      add(this.add.image(x - 20, y, 'pt_' + h.name.toLowerCase()).setDisplaySize(46, 46));
      add(this.add.text(x + 8, y - 16, h.name.slice(0, 8), {
        fontFamily: 'monospace', fontSize: '11px', color: '#3a2c14', fontStyle: 'bold',
      }));
      add(this.add.text(x + 8, y + 0, h.spells.length + (h.spells.length > 1 ? ' spells' : ' spell'), {
        fontFamily: 'monospace', fontSize: '9px', color: '#6a5636',
      }));
    });

    // the selected hero's page: one school at a time, tabbed across the top
    const h = GameData.party[this.sbSel];
    const bySchool = {};
    for (const id of h.spells) {
      const sc = SPELLS[id].school;
      (bySchool[sc] = bySchool[sc] || []).push(id);
    }
    const heroSchools = Object.keys(SCHOOLS).filter(sc => bySchool[sc]);
    if (!heroSchools.includes(this.sbSchool)) this.sbSchool = heroSchools[0];

    // school tabs (colored chips with counts)
    const tabW = Math.min(118, Math.floor(600 / Math.max(1, heroSchools.length)));
    heroSchools.forEach((sc, i) => {
      const tx = 230 + i * (tabW + 4) + tabW / 2, ty = 112;
      const sel = sc === this.sbSchool;
      const chipColor = Phaser.Display.Color.HexStringToColor(SCHOOLS[sc].color).color;
      const chip = add(this.add.rectangle(tx, ty, tabW, 26, chipColor, sel ? 0.42 : 0.10)
        .setStrokeStyle(sel ? 3 : 1, sel ? chipColor : 0x6a5a38))
        .setInteractive({ useHandCursor: true });
      chip.on('pointerdown', () => { this.sbSchool = sc; this.openSpellbook(); });
      add(this.add.text(tx, ty, `${SCHOOLS[sc].name} (${bySchool[sc].length})`, {
        fontFamily: 'monospace', fontSize: sel ? '11px' : '10px', fontStyle: 'bold',
        color: sel ? '#2a2014' : '#4a3c24',
      }).setOrigin(0.5));
    });

    // the chosen school's spells, roomy grid
    const known = bySchool[this.sbSchool] || [];
    add(this.add.text(224, 138, SCHOOLS[this.sbSchool].name.toUpperCase() + ' MAGIC', {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: SCHOOLS[this.sbSchool].color, stroke: '#2a2014', strokeThickness: 2,
    }));
    known.forEach((id, j) => {
      const sp = SPELLS[id];
      const cx = 224 + (j % 3) * 202, cy = 160 + Math.floor(j / 3) * 50;
      const readied = h.quick === id;
      const card = add(this.add.rectangle(cx + 94, cy + 21, 196, 44, readied ? 0x8a6f28 : 0x4a4032, readied ? 0.35 : 0.12)
        .setStrokeStyle(readied ? 3 : 1, readied ? 0xc9a227 : 0x6a5a38))
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => { h.quick = id; this.refreshHUD(); this.openSpellbook(); });
      add(this.add.image(cx + 20, cy + 21, sp.icon).setDisplaySize(30, 30));
      add(this.add.text(cx + 40, cy + 6, sp.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#3a2c14', fontStyle: 'bold',
      }));
      add(this.add.text(cx + 40, cy + 23, sp.cost + ' mp' + (readied ? '  · readied' : ''), {
        fontFamily: 'monospace', fontSize: '10px', color: readied ? '#8a6f28' : '#7a1f1f',
      }));
    });

    const canStudy = HERO_SCHOOLS[h.name].filter(s => s !== 'martial').map(s => SCHOOLS[s].name).join(', ');
    add(this.add.text(224, 448, canStudy
      ? `${h.name} may study: ${canStudy} — scrolls teach new spells`
      : `${h.name} trusts steel over sorcery.`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#6a5636',
    }));

    this.sbContainer.setVisible(true);
  }

  closeSpellbook() {
    this.sbOpen = false;
    this.sbContainer.setVisible(false);
    for (const t of this.sbItems) t.destroy();
    this.sbItems = [];
  }

  // ---------- the world map of Averron (V) ----------

  openWorldMap() {
    if (this.invOpen) this.closeInventory();
    if (this.shopOpen) this.closeShop();
    if (this.sbOpen) this.closeSpellbook();
    this.wmOpen = true;
    for (const t of this.wmItems) t.destroy();
    this.wmItems = [];
    const add = o => { this.wmItems.push(o.setDepth(3001)); return o; };
    add(this.add.rectangle(480, 258, 960, 640, 0x06080e, 0.62).setOrigin(0.5).setDepth(3000));
    add(this.add.image(480, 258, 'panel_ui').setDisplaySize(780, 470));
    add(this.add.text(480, 62, '— THE FRONTIER OF AVERRON —', {
      fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#7a1f1f',
    }).setOrigin(0.5));
    add(this.add.text(480, 84, 'travel by coach — speak to Jori at any post  ·  V closes', {
      fontFamily: 'monospace', fontSize: '10px', color: '#6a5636',
    }).setOrigin(0.5));

    const ox = 130, oy = 68; // worldPos space -> screen
    const g = add(this.add.graphics());
    // coach roads (dashed)
    const seen = new Set();
    for (const [from, routes] of Object.entries(TRAVEL)) {
      for (const r of routes) {
        const key = [from, r.to].sort().join('|');
        if (seen.has(key) || !ZONES[from].worldPos || !ZONES[r.to].worldPos) continue;
        seen.add(key);
        const a = ZONES[from].worldPos, b = ZONES[r.to].worldPos;
        const segs = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 14);
        g.lineStyle(3, 0x8a6f28, 0.75);
        for (let i = 0; i < segs; i += 2) {
          g.strokeLineShape(new Phaser.Geom.Line(
            ox + a[0] + (b[0] - a[0]) * (i / segs), oy + a[1] + (b[1] - a[1]) * (i / segs),
            ox + a[0] + (b[0] - a[0]) * Math.min(1, (i + 1) / segs), oy + a[1] + (b[1] - a[1]) * Math.min(1, (i + 1) / segs)));
        }
      }
    }
    // zone nodes: visited = inked in, unvisited = rumor
    for (const [id, z] of Object.entries(ZONES)) {
      if (!z.worldPos) continue;
      const [zx, zy] = [ox + z.worldPos[0], oy + z.worldPos[1]];
      const here = id === GameData.zone;
      const visited = !!GameData.zoneState[id];
      g.fillStyle(here ? 0xc9a227 : visited ? 0x6a5636 : 0x4a4032, 1);
      g.fillCircle(zx, zy, here ? 11 : 8);
      g.lineStyle(2, here ? 0x7a1f1f : 0x3a2c14, 1);
      g.strokeCircle(zx, zy, here ? 11 : 8);
      add(this.add.text(zx, zy + (here ? 18 : 14), z.name, {
        fontFamily: 'monospace', fontSize: here ? '13px' : '11px', fontStyle: 'bold',
        color: here ? '#7a1f1f' : visited ? '#3a2c14' : '#6a5a44',
      }).setOrigin(0.5, 0));
      if (here) {
        add(this.add.text(zx, zy - 26, '☆ you are here', {
          fontFamily: 'monospace', fontSize: '10px', color: '#7a1f1f', fontStyle: 'bold',
        }).setOrigin(0.5));
      }
      if (z.town) add(this.add.text(zx, zy - 4.5, '♜', { fontSize: '10px', color: '#f4f0e0' }).setOrigin(0.5));
    }
  }

  closeWorldMap() {
    this.wmOpen = false;
    for (const t of this.wmItems) t.destroy();
    this.wmItems = [];
  }

  // ---------- inventory (I) ----------

  buildInventoryUI() {
    this.invOpen = false;
    this.invSel = 0;
    this.invItems = [];
    this.invContainer = this.add.container(0, 0).setDepth(3000).setVisible(false);
    this.invContainer.add(this.add.image(480, 250, 'panel_ui'));
    this.invContainer.add(this.add.text(480, 54, '— PARTY GOODS —', {
      fontFamily: 'monospace', fontSize: '22px', color: '#3a2c14', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  openInventory() {
    if (this.sbOpen) this.closeSpellbook();
    this.invOpen = true;
    this.refreshInventory();
    this.invContainer.setVisible(true);
  }

  closeInventory() {
    this.invOpen = false;
    this.invContainer.setVisible(false);
    for (const o of this.invItems) o.destroy();
    this.invItems = [];
  }

  refreshInventory() {
    for (const o of this.invItems) o.destroy();
    this.invItems = [];
    if (!this.invOpen) return; // data changed while the panel was closed
    const add = o => { this.invItems.push(o.setDepth(3001)); return o; };

    GameData.party.forEach((h, i) => {
      const x = 168 + i * 158, y = 76;
      const sel = i === this.invSel;
      const frame = add(this.add.rectangle(x, y, 140, 128, 0x8a6f28, sel ? 0.25 : 0.06)
        .setOrigin(0.5, 0)
        .setStrokeStyle(sel ? 3 : 1, sel ? 0xc9a227 : 0x6a5a38))
        .setInteractive({ useHandCursor: true });
      frame.on('pointerdown', () => { this.invSel = i; this.refreshInventory(); });
      add(this.add.image(x - 32, y + 34, 'pt_' + h.name.toLowerCase()).setDisplaySize(52, 52));
      add(this.add.text(x + 2, y + 12, h.name, {
        fontFamily: 'monospace', fontSize: '12px', color: '#3a2c14', fontStyle: 'bold',
      }));
      add(this.add.text(x + 2, y + 30, `ATK ${heroAtk(h)}`, { fontFamily: 'monospace', fontSize: '11px', color: '#7a1f1f' }));
      add(this.add.text(x + 2, y + 46, `DEF ${heroDef(h)}`, { fontFamily: 'monospace', fontSize: '11px', color: '#28527a' }));
      [['weapon', x - 24], ['armor', x + 24]].forEach(([slot, sx]) => {
        const sy = y + 96;
        const cell = add(this.add.image(sx, sy, 'slot')).setInteractive({ useHandCursor: true });
        cell.on('pointerdown', () => this.unequip(i, slot));
        if (h[slot]) add(this.add.image(sx, sy, ITEM_TYPES[h[slot]].icon).setDisplaySize(30, 30));
        else add(this.add.text(sx, sy, slot === 'weapon' ? 'W' : 'A', {
          fontFamily: 'monospace', fontSize: '12px', color: '#6a5a38',
        }).setOrigin(0.5));
      });
    });

    const x0 = 314, y0 = 250, C = 42;
    GameData.inventory.forEach((id, idx) => {
      const gx = x0 + (idx % 8) * C, gy = y0 + Math.floor(idx / 8) * C;
      const cell = add(this.add.image(gx, gy, 'slot')).setInteractive({ useHandCursor: true });
      cell.on('pointerdown', () => this.clickItem(idx));
      if (id) add(this.add.image(gx, gy, ITEM_TYPES[id].icon).setDisplaySize(30, 30));
    });

    add(this.add.text(480, 428, `Gold: ${GameData.gold}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#7a5a10', fontStyle: 'bold',
    }).setOrigin(0.5));
    add(this.add.text(480, 452, 'pick a hero, then click gear to equip · potions heal that hero · gems sell · I closes', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6a5636',
    }).setOrigin(0.5));
  }

  clickItem(idx) {
    const id = GameData.inventory[idx];
    if (!id) return;
    const it = ITEM_TYPES[id];
    const h = GameData.party[this.invSel];
    if (it.kind === 'potion') {
      if (h.hp <= 0) { this.toast(`${h.name} is down — only the fountain can help.`); return; }
      if (it.heal) {
        if (h.hp >= h.maxHp) { this.toast(`${h.name} is already hale.`); return; }
        h.hp = Math.min(h.maxHp, h.hp + it.heal);
      }
      if (it.mana) {
        if (h.mp >= h.maxMp) { this.toast(`${h.name}'s mana brims already.`); return; }
        h.mp = Math.min(h.maxMp, h.mp + it.mana);
      }
      GameData.inventory[idx] = null;
      this.toast(`${h.name} drinks the ${it.name}.`);
    } else if (it.kind === 'weapon' || it.kind === 'armor') {
      const prev = h[it.kind];
      h[it.kind] = id;
      GameData.inventory[idx] = prev || null;
      this.toast(`${h.name} equips the ${it.name}.`);
    } else if (it.kind === 'valuable') {
      GameData.gold += it.gold;
      GameData.inventory[idx] = null;
      this.toast(`Marked for Odo's ledger: +${it.gold} gold.`);
    } else if (it.kind === 'scroll') {
      const sp = SPELLS[it.spell];
      const canLearn = x => x.hp > 0 && HERO_SCHOOLS[x.name].includes(sp.school) && !x.spells.includes(it.spell);
      const learner = canLearn(h) ? h : GameData.party.find(canLearn);
      if (!learner) {
        const knower = GameData.party.find(x => x.spells.includes(it.spell));
        this.toast(knower
          ? `${knower.name} already knows ${sp.name}.`
          : `None of the party can grasp ${SCHOOLS[sp.school].name} magic.`);
        return;
      }
      learner.spells.push(it.spell);
      learner.quick = it.spell;
      GameData.inventory[idx] = null;
      this.toast(`${learner.name} learns ${sp.name}! (${SCHOOLS[sp.school].name} magic — readied on their key)`);
      this.saveGame();
    } else {
      this.toast(`${it.name} — Bram will want to see this.`);
      return;
    }
    this.refreshHUD();
    this.refreshInventory();
  }

  unequip(heroIdx, slot) {
    const h = GameData.party[heroIdx];
    this.invSel = heroIdx;
    if (h[slot]) {
      const free = GameData.inventory.indexOf(null);
      if (free < 0) { this.toast('Your packs are full!'); return; }
      GameData.inventory[free] = h[slot];
      h[slot] = null;
      this.refreshHUD();
    }
    this.refreshInventory();
  }

  // ---------- Odo's shop ----------

  buildShopUI() {
    this.shopOpen = false;
    this.shopItems = [];
    this.shopContainer = this.add.container(0, 0).setDepth(3000).setVisible(false);
    this.shopContainer.add(this.add.image(480, 250, 'panel_ui'));
  }

  // any merchant can run a shop: pass their stock + name (defaults to Odo)
  openShop(stock, keeper) {
    if (this.sbOpen) this.closeSpellbook();
    if (this.invOpen) this.closeInventory();
    this.shopOpen = true;
    this.shopMode = 'wares';
    this.shopStock = stock || SHOP_STOCK;
    this.shopKeeper = keeper || 'Odo';
    this.refreshShop();
    this.shopContainer.setVisible(true);
  }

  // the guild hall: same panel, different business — train skill ranks
  openTraining() {
    if (this.sbOpen) this.closeSpellbook();
    if (this.invOpen) this.closeInventory();
    this.shopOpen = true;
    this.shopMode = 'train';
    this.refreshShop();
    this.shopContainer.setVisible(true);
  }

  trainRank(heroIdx, school) {
    const h = GameData.party[heroIdx];
    h.skillRank = h.skillRank || {};
    const rank = h.skillRank[school] || 0;
    if (rank >= 3) return;
    const cost = [100, 400, 1000][rank];
    if (GameData.gold < cost) { this.toast('Orwin sniffs: the guild does not extend credit.'); return; }
    GameData.gold -= cost;
    h.skillRank[school] = rank + 1;
    this.toast(`${h.name} advances to ${['Novice', 'Adept', 'Master'][rank]} of ${SCHOOLS[school].name} — spells +25% stronger!`);
    this.refreshHUD();
    this.refreshShop();
    this.saveGame();
  }

  closeShop() {
    this.shopOpen = false;
    this.shopContainer.setVisible(false);
    for (const o of this.shopItems) o.destroy();
    this.shopItems = [];
  }

  refreshShop() {
    for (const o of this.shopItems) o.destroy();
    this.shopItems = [];
    if (!this.shopOpen) return;
    const add = o => { this.shopItems.push(o.setDepth(3001)); return o; };

    if (this.shopMode === 'train') { this.refreshTraining(add); return; }

    add(this.add.text(480, 54, `— ${this.shopKeeper.toUpperCase()}'S WARES —`, {
      fontFamily: 'monospace', fontSize: '22px', color: '#3a2c14', fontStyle: 'bold',
    }).setOrigin(0.5));

    this.shopStock.forEach((id, i) => {
      const it = ITEM_TYPES[id];
      const col = i % 2, row = Math.floor(i / 2);
      const x = 300 + col * 360, y = 106 + row * 44;
      const afford = GameData.gold >= it.price;
      const box = add(this.add.rectangle(x, y, 336, 38, afford ? 0x8a6f28 : 0x4a4032, afford ? 0.14 : 0.08)
        .setStrokeStyle(1, afford ? 0x8a6f28 : 0x6a5a38))
        .setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.buyItem(id));
      add(this.add.image(x - 144, y, it.icon).setDisplaySize(26, 26));
      const stat = it.kind === 'scroll' ? `teaches ${SPELLS[it.spell].name}`
        : it.atk ? `+${it.atk} ATK` : it.def ? `+${it.def} DEF`
        : it.heal ? `heals ${it.heal}` : `restores ${it.mana} mp`;
      add(this.add.text(x - 124, y - 14, it.name, {
        fontFamily: 'monospace', fontSize: '12px', color: '#3a2c14', fontStyle: 'bold',
      }));
      add(this.add.text(x - 124, y + 2, stat, { fontFamily: 'monospace', fontSize: '10px', color: '#28527a' }));
      add(this.add.text(x + 158, y, it.price + 'g', {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
        color: afford ? '#7a5a10' : '#9a4040',
      }).setOrigin(1, 0.5));
    });

    add(this.add.text(480, 418, `Your gold: ${GameData.gold}`, {
      fontFamily: 'monospace', fontSize: '15px', color: '#7a5a10', fontStyle: 'bold',
    }).setOrigin(0.5));
    add(this.add.text(480, 442, 'click a ware to buy it · scrolls teach spells (use from your pack) · Esc closes', {
      fontFamily: 'monospace', fontSize: '10px', color: '#6a5636',
    }).setOrigin(0.5));
  }

  buyItem(id) {
    const it = ITEM_TYPES[id];
    if (GameData.gold < it.price) { this.toast(`${this.shopKeeper} tuts: not enough gold.`); return; }
    if (!invAdd(id)) { this.toast('Your packs are full!'); return; }
    GameData.gold -= it.price;
    this.toast(`Bought: ${it.name} for ${it.price} gold.`);
    this.refreshHUD();
    this.refreshShop();
    this.saveGame();
  }

  // the guild's ledger: every hero's schools, ranks as stars, click to train
  refreshTraining(add) {
    add(this.add.text(480, 54, '— THE GUILD OF THE NINE SCHOOLS —', {
      fontFamily: 'monospace', fontSize: '20px', color: '#3a2c14', fontStyle: 'bold',
    }).setOrigin(0.5));
    add(this.add.text(480, 76, 'each rank: +25% spell power in that school · Novice 100g · Adept 400g · Master 1000g', {
      fontFamily: 'monospace', fontSize: '10px', color: '#6a5636',
    }).setOrigin(0.5));

    GameData.party.forEach((h, hi) => {
      const y = 118 + hi * 82;
      add(this.add.image(160, y + 18, 'pt_' + h.name.toLowerCase()).setDisplaySize(44, 44));
      add(this.add.text(190, y - 2, h.name, {
        fontFamily: 'monospace', fontSize: '13px', color: '#3a2c14', fontStyle: 'bold',
      }));
      const schools = HERO_SCHOOLS[h.name].filter(s => s !== 'martial');
      if (!schools.length) {
        add(this.add.text(190, y + 18, 'trusts steel over sorcery', {
          fontFamily: 'monospace', fontSize: '10px', color: '#6a5636',
        }));
        return;
      }
      schools.forEach((sc, si) => {
        const x = 190 + (si % 5) * 128, ry = y + 16 + Math.floor(si / 5) * 30;
        const rank = (h.skillRank && h.skillRank[sc]) || 0;
        const maxed = rank >= 3;
        const cost = maxed ? 0 : [100, 400, 1000][rank];
        const afford = !maxed && GameData.gold >= cost;
        const chipColor = Phaser.Display.Color.HexStringToColor(SCHOOLS[sc].color).color;
        const chip = add(this.add.rectangle(x + 56, ry + 10, 118, 26, chipColor, afford ? 0.28 : 0.10)
          .setStrokeStyle(afford ? 2 : 1, afford ? chipColor : 0x6a5a38));
        if (afford) {
          chip.setInteractive({ useHandCursor: true });
          chip.on('pointerdown', () => this.trainRank(hi, sc));
        }
        add(this.add.text(x + 4, ry + 4, SCHOOLS[sc].name, {
          fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: '#3a2c14',
        }));
        add(this.add.text(x + 62, ry + 4, '★'.repeat(rank) + '☆'.repeat(3 - rank) + (maxed ? '' : ` ${cost}g`), {
          fontFamily: 'monospace', fontSize: '10px', color: maxed ? '#7a5a10' : afford ? '#28527a' : '#9a4040',
        }));
      });
    });

    add(this.add.text(480, 442, `Your gold: ${GameData.gold} · click an affordable school to train · Esc closes`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#7a5a10', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  // ---------- minimap ----------

  buildMinimap() {
    const S = 2;
    // idempotent: tear down a previous zone's map so travel can rebuild
    if (this.mmContainer) { this.mmContainer.destroy(); this.mmContainer = null; }
    if (this.textures.exists('mmap')) this.textures.remove('mmap');
    const tex = this.textures.createCanvas('mmap', MAP_W * S, MAP_H * S);
    const g = tex.getContext();
    const colors = {
      [T_DIRT]: '#7a5c34', [T_COBBLE]: '#8a8f98', [T_WATER]: '#2a5d8f',
      [T_WOOD]: '#8f6a42', [T_ROCK]: '#6a6e78', [T_FENCE]: '#8a6238', [T_TIMBER]: '#d8cfb8',
      [T_PLANK]: '#9a7248', [T_STONE]: '#9aa0aa', [T_DOOR]: '#6b4526',
      [T_TIMBER_WIN]: '#d8cfb8', [T_STONE_WIN]: '#9aa0aa', [T_PLANK_WIN]: '#9a7248',
      [T_SIGN_TAVERN]: '#d8cfb8', [T_SIGN_SMITH]: '#9aa0aa', [T_SIGN_TRADE]: '#9a7248',
      [T_BANNER]: '#d8cfb8', [T_CHIMNEY]: '#6a6e78', [T_CASTLE]: '#7a8290',
    };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = this.map[y][x];
      let c = this.onBridge(x, y) ? '#8a6238' : colors[t]; // bridge planks over the river
      if (c === undefined) {
        // grass: shade by elevation so the hills show on the map
        const e = clamp(this.terrainH(x + 0.5, y + 0.5) / 4.5, 0, 1);
        const rC = Math.round(0x2e + e * 0x38), gC = Math.round(0x5c + e * 0x42), bC = Math.round(0x2e + e * 0x1a);
        c = '#' + rC.toString(16).padStart(2, '0') + gC.toString(16).padStart(2, '0') + bC.toString(16).padStart(2, '0');
      }
      g.fillStyle = c;
      g.fillRect(x * S, y * S, S, S);
    }
    tex.refresh();

    const ox = 960 - MAP_W * S - 10;
    this.mmContainer = this.add.container(ox, 10).setDepth(1000);
    this.mmContainer.add(this.add.image(0, 0, 'mmap').setOrigin(0).setAlpha(0.85));
    this.mmDots = this.add.graphics();
    this.mmContainer.add(this.mmDots);
    this.mmScale = S;
  }

  updateMinimap() {
    if (!this.mmContainer.visible) return;
    const S = this.mmScale, g = this.mmDots;
    g.clear();
    for (const e of this.entities) {
      g.fillStyle(e.kind === 'enemy' ? (e.aggro ? 0xff2222 : 0xcc5555)
        : e.kind === 'chest' ? 0xffd75e
        : e.kind === 'item' ? 0xfff0a0
        : e.kind === 'villager' ? 0x9ad8ff
        : e.kind === 'tree' ? 0x1e4d22
        : e.kind === 'prop' ? 0x8a8f98 : 0x6fb0e8);
      g.fillRect(e.x * S - 1.5, e.y * S - 1.5, 3, 3);
    }
    const x = this.px * S, y = this.py * S, a = this.angle;
    g.fillStyle(0xffffff);
    g.fillTriangle(
      x + Math.cos(a) * 5, y + Math.sin(a) * 5,
      x + Math.cos(a + 2.5) * 3.5, y + Math.sin(a + 2.5) * 3.5,
      x + Math.cos(a - 2.5) * 3.5, y + Math.sin(a - 2.5) * 3.5);
  }

  // ---------- HUD ----------

  buildHUD() {
    this.add.image(0, 510, 'panel_hud').setOrigin(0).setDepth(999);
    this.hudRows = [];
    GameData.party.forEach((h, i) => {
      const x = 16 + i * 236, y = 522;
      const portrait = this.add.image(x, y, 'pt_' + h.name.toLowerCase()).setOrigin(0).setDisplaySize(58, 58).setDepth(1001);
      this.add.rectangle(x - 1, y - 1, 60, 60).setOrigin(0).setStrokeStyle(2, 0xc9a227).setDepth(1002);
      const name = this.add.text(x + 66, y - 2, '', { fontFamily: 'monospace', fontSize: '14px', color: '#f0e6c8' }).setDepth(1001);
      const hpBg = this.add.rectangle(x + 66, y + 22, 148, 10, 0x46151a).setOrigin(0, 0.5).setDepth(1001);
      const hpBar = this.add.rectangle(x + 66, y + 22, 148, 10, 0x3ecf5a).setOrigin(0, 0.5).setDepth(1002);
      const mpBg = this.add.rectangle(x + 66, y + 36, 148, 7, 0x141a3a).setOrigin(0, 0.5).setDepth(1001);
      const mpBar = this.add.rectangle(x + 66, y + 36, 148, 7, 0x4a86e8).setOrigin(0, 0.5).setDepth(1002);
      const hpText = this.add.text(x + 66, y + 44, '', { fontFamily: 'monospace', fontSize: '11px', color: '#b8a878' }).setDepth(1001);
      const sk = this.add.text(x, y + 62, '', { fontFamily: 'monospace', fontSize: '10px', color: '#c8b060' }).setDepth(1001);
      this.hudRows.push({ name, portrait, hpBar, mpBar, hpText, sk, skReady: true });
    });
    this.statusText = this.add.text(12, 492, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffd75e',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 2 },
    }).setDepth(1000);
    this.refreshHUD();
  }

  refreshHUD() {
    GameData.party.forEach((h, i) => {
      const r = this.hudRows[i];
      r.name.setText(`${h.name} Lv${h.level}`);
      r.name.setColor(h.hp <= 0 ? '#777777' : '#ffffff');
      r.hpBar.scaleX = Math.max(0, h.hp / h.maxHp);
      r.mpBar.scaleX = h.maxMp ? h.mp / h.maxMp : 0;
      r.hpText.setText(`HP ${h.hp}/${h.maxHp}  MP ${h.mp}/${h.maxMp}`);
      r.sk.setText(`[${i + 1}] ${SPELLS[h.quick].name} ${SPELLS[h.quick].cost}mp`);
      if (r.portrait) r.portrait.setTint(h.hp <= 0 ? 0x555566 : 0xffffff);
    });
    const foes = this.entities ? this.entities.filter(e => e.kind === 'enemy').length : 0;
    this.statusText.setText(`Gold: ${GameData.gold}   Foes left: ${foes}` +
      (this.flying ? '   |   FLYING (R/X rise-dive, cast Fly to land)' : ''));
    const q = GameData.quests.lostblade;
    const w2 = GameData.quests.wolfcull;
    const lines = [];
    if (q === 'available') lines.push('Bram the Smith looks troubled — visit the smithy');
    else if (q === 'active') lines.push('Quest: The Lost Blade — goblin camp east, across the river ford');
    else if (q === 'found') lines.push('Quest: The Lost Blade — return the blade to Bram');
    if (w2 === 'active') lines.push(`Quest: The Wolves of Pinereach — ${GameData.flags.wolfKills || 0}/${QUESTS.wolfcull.need} culled`);
    else if (w2 === 'ready') lines.push('Quest: The Wolves of Pinereach — report to Lord Aldric at Oakhearth');
    this.questText.setText(lines.join('\n'));
  }

  grantXP(amount) {
    const notes = [];
    GameData.party.forEach(h => {
      if (h.hp <= 0) return;
      h.xp += amount;
      while (h.xp >= xpForLevel(h.level)) {
        h.xp -= xpForLevel(h.level);
        h.level++;
        h.maxHp += 6; h.atk += 1;
        if (h.level % 2 === 0) h.def += 1;
        h.maxMp += (h.maxMp >= 12 ? 4 : 2);
        h.hp = h.maxHp; h.mp = h.maxMp;
        notes.push(`${h.name} is now level ${h.level}!`);
      }
    });
    return notes;
  }

  // ---------- quests ----------

  acceptQuest(id) {
    if (GameData.quests[id] !== 'available') return;
    GameData.quests[id] = 'active';
    this.toast(`Quest accepted: ${QUESTS[id].title}`);
    this.refreshHUD();
    this.saveGame();
  }

  completeQuest(id) {
    if (GameData.quests[id] === 'done') return;
    GameData.quests[id] = 'done';
    if (id === 'lostblade') {
      const mal = GameData.party[3];
      if (!mal.spells.includes('fly')) {
        mal.spells.push('fly');
        mal.quick = 'fly';
      }
      const bi = GameData.inventory.indexOf('lostblade');
      if (bi >= 0) GameData.inventory[bi] = null; // handed to Bram
      const notes = this.grantXP(60);
      this.toast('Quest complete! Malwick learns FLY — cast with 4, then R/X to rise and dive' +
        (notes.length ? ' — ' + notes.join(' ') : ''));
    } else if (id === 'wolfcull') {
      GameData.gold += 350;
      const scroll = invAdd('scroll_masshysteria');
      const notes = this.grantXP(90);
      this.toast('The wolves are culled! +350 gold' + (scroll ? ' and a guild scroll (Mass Hysteria)' : '') +
        (notes.length ? ' — ' + notes.join(' ') : ''));
    }
    this.refreshHUD();
    this.saveGame();
  }

  toast(msg) {
    this.toastText.setText(msg).setAlpha(1);
    if (this.toastTween) this.toastTween.stop();
    this.toastTween = this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2400, duration: 500 });
  }
}
