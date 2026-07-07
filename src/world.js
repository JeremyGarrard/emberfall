// BootScene: draws all art onto offscreen 32x32 canvases (walls + billboards).
// WorldScene: first-person exploration with REAL-TIME combat — crosshair
//   targeting, party attack volleys, hero skills on hotkeys, monsters that
//   chase and strike back — plus villagers, chests, fountain, minimap, HUD.

// floors (walk on / see across) vs walls (block rays; heights in raycast.js)
const T_GRASS = 0, T_DIRT = 1, T_COBBLE = 2, T_WATER = 3, T_WOOD = 4;
const T_ROCK = 5, T_FENCE = 6, T_TIMBER = 7, T_PLANK = 8, T_STONE = 9;
const T_DOOR = 10, T_TIMBER_WIN = 11, T_STONE_WIN = 12, T_PLANK_WIN = 13;
const T_SIGN_TAVERN = 14, T_SIGN_SMITH = 15, T_SIGN_TRADE = 16, T_BANNER = 17, T_CHIMNEY = 18;
const MAP_W = 96, MAP_H = 72;
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
  slime: { vDiv: 2.0 }, goblin: { vDiv: 1.45 }, wolf: { vDiv: 1.55 },
  chest: { vDiv: 2.3 }, fountain: { vDiv: 1.12 }, well: { vDiv: 1.5 }, lamp: { vDiv: 1.05 },
  tree: { vDiv: 0.85 }, pine: { vDiv: 0.8 }, sword: { vDiv: 1.9 },
  anvil: { vDiv: 2.4 }, barrel: { vDiv: 2.0 }, crate: { vDiv: 2.1 }, smoke: { vDiv: 1.5 },
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

    // -- monsters & props --
    makeArt('slime', g => {
      ell(g, 16, 22, 11, 8, '#35b06a');
      ell(g, 13, 18, 4, 3, '#57d489');
      ell(g, 12, 21, 2, 2.4, '#143d24');
      ell(g, 20, 21, 2, 2.4, '#143d24');
    });
    makeArt('goblin', g => {
      g.fillStyle = '#5f8f2f'; g.fillRect(10, 15, 12, 13);
      g.fillStyle = '#4a731f'; g.fillRect(10, 24, 12, 4);
      ell(g, 16, 10, 7, 7, '#6da036');
      tri(g, [6, 10, 10, 5, 10, 13], '#6da036');
      tri(g, [26, 10, 22, 5, 22, 13], '#6da036');
      ell(g, 13, 9, 1.6, 1.6, '#d94040');
      ell(g, 19, 9, 1.6, 1.6, '#d94040');
      g.fillStyle = '#e8e0c8'; g.fillRect(13, 14, 2, 2); g.fillRect(17, 14, 2, 2);
    });
    makeArt('wolf', g => {
      ell(g, 14, 22, 11, 6, '#6f7480');
      ell(g, 24, 17, 5.5, 5, '#7a8090');
      tri(g, [21, 10, 23, 16, 28, 12], '#6f7480');
      tri(g, [2, 18, 6, 23, 7, 16], '#6f7480');
      g.fillStyle = '#4d515c'; g.fillRect(8, 26, 3, 6); g.fillRect(18, 26, 3, 6);
      ell(g, 26, 16, 1.5, 1.5, '#d94040');
    });
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

    // -- portraits, 64px busts --
    makeArtWH('pt_roderick', 64, 64, g => {
      g.fillStyle = '#232833'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#5a616e'; g.fillRect(6, 50, 52, 14);        // pauldrons
      ell(g, 32, 38, 15, 17, '#e8c39e');                          // face
      g.fillStyle = '#8d9099';                                    // helm
      ell(g, 32, 20, 18, 13, '#8d9099');
      g.fillRect(14, 18, 36, 10);
      g.fillRect(29, 5, 6, 12);
      g.fillStyle = '#6a6f7a'; g.fillRect(14, 26, 36, 2);
      g.fillStyle = '#6b4a2e'; g.fillRect(21, 46, 22, 12);        // beard
      ell(g, 26, 36, 2.4, 3, '#232833'); ell(g, 38, 36, 2.4, 3, '#232833');
      g.fillStyle = '#c9976e'; g.fillRect(30, 38, 4, 6);          // nose
    });
    makeArtWH('pt_wren', 64, 64, g => {
      g.fillStyle = '#1f2b1f'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#3c5c34'; g.fillRect(8, 52, 48, 12);         // cloak
      ell(g, 32, 38, 13, 15, '#e0b48e');                          // face
      g.fillStyle = '#3c5c34';                                    // hood
      ell(g, 32, 22, 17, 14, '#3c5c34');
      g.fillRect(15, 20, 34, 8);
      tri(g, [15, 28, 20, 44, 15, 46], '#3c5c34');
      tri(g, [49, 28, 44, 44, 49, 46], '#3c5c34');
      g.fillStyle = '#d0b040'; tri(g, [44, 8, 52, 22, 46, 22]);   // feather
      ell(g, 27, 36, 2.2, 2.8, '#1f2b1f'); ell(g, 38, 36, 2.2, 2.8, '#1f2b1f');
      g.fillStyle = '#b88a60'; g.fillRect(31, 38, 3, 5);
    });
    makeArtWH('pt_serena', 64, 64, g => {
      g.fillStyle = '#2e2838'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#e8e4da'; g.fillRect(10, 52, 44, 12);        // robe
      ell(g, 32, 38, 13, 15, '#f0cca8');                          // face
      g.fillStyle = '#d9c26a';                                    // hair
      ell(g, 32, 24, 16, 13, '#d9c26a');
      g.fillRect(16, 24, 8, 26); g.fillRect(40, 24, 8, 26);
      g.strokeStyle = '#c9a227'; g.lineWidth = 3;                 // circlet
      g.beginPath(); g.moveTo(18, 20); g.lineTo(46, 20); g.stroke();
      ell(g, 32, 19, 2.5, 2.5, '#6fb0e8');
      ell(g, 27, 36, 2.2, 2.8, '#2e2838'); ell(g, 38, 36, 2.2, 2.8, '#2e2838');
      g.fillStyle = '#d8a888'; g.fillRect(31, 38, 3, 5);
    });
    makeArtWH('pt_malwick', 64, 64, g => {
      g.fillStyle = '#241f30'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#4a3a6a'; g.fillRect(8, 52, 48, 12);         // robe
      ell(g, 32, 40, 13, 14, '#e0c0a0');                          // face
      g.fillStyle = '#d4d8de'; g.fillRect(22, 48, 20, 14);        // gray beard
      ell(g, 32, 52, 10, 9, '#d4d8de');
      g.fillStyle = '#5a4088';                                    // wizard hat
      tri(g, [32, 2, 12, 30, 52, 30], '#5a4088');
      ell(g, 32, 30, 22, 5, '#5a4088');
      ell(g, 40, 14, 2, 2, '#d0b040');                            // star
      ell(g, 27, 38, 2.2, 2.6, '#241f30'); ell(g, 38, 38, 2.2, 2.6, '#241f30');
    });

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

    this.scene.start('World');
  }
}

class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  create() {
    // resume a saved journey if one exists: the stored seed regrows the very
    // same vale; looted chests and slain monsters stay gone (by uid)
    this.save = null;
    try { this.save = JSON.parse(localStorage.getItem('emberfall-save')); } catch (e) {}
    if (this.save && this.save.v === 1) {
      // v1 predates the Eastmarch camp: new spawns shifted entity uids, so the
      // old gone-list can't be trusted. Keep the party's progress; regrow the vale.
      this.save.seed = (Math.random() * 1e9) >>> 0;
      this.save.gone = [];
      this.save.px = START.x; this.save.py = START.y; this.save.angle = 0;
      this.save.flying = false; this.save.eyeZ = 0.5;
      this.save.v = 2;
      this._migrated = true;
    }
    if (this.save && this.save.v !== 2) this.save = null;
    this.worldSeed = this.save ? this.save.seed : (Math.random() * 1e9) >>> 0;
    setSeed(this.worldSeed);
    this.goneUids = new Set(this.save ? this.save.gone : []);
    if (this.save) {
      const s = this.save;
      GameData.gold = s.gold;
      GameData.inventory = s.inventory;
      GameData.flags = s.flags;
      GameData.quests = s.quests;
      s.party.forEach((sp, i) => Object.assign(GameData.party[i], sp));
    }

    this.buildMap();
    this.buildEntities();
    this.entities = this.entities.filter(e => !this.goneUids.has(e.uid));

    // real-3D view: three.js canvas underneath, this Phaser canvas (transparent)
    // draws every UI element on top
    this.game.canvas.style.position = 'relative';
    this.game.canvas.style.zIndex = '1';
    R3D.init(document.getElementById('game'), {
      map: this.map, mapW: MAP_W, mapH: MAP_H,
      heights: this.heights,
      terrainH: (x, y) => this.terrainH(x, y),
      doors: this.doors,
      buildings: BUILDINGS.map(b => ({
        x1: VILLAGE.x1 + b.x1, y1: VILLAGE.y1 + b.y1,
        x2: VILLAGE.x1 + b.x2, y2: VILLAGE.y1 + b.y2,
        h: 1.25, color: b.color,
      })),
    });
    R3D.syncSize(this.game.canvas);
    this.scale.on('resize', () => R3D.syncSize(this.game.canvas));

    this.hpBars = this.add.graphics().setDepth(950);
    this.crosshair = this.add.text(480, 255, '+', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffffff',
      stroke: '#0a0c12', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(951);

    this.px = START.x; this.py = START.y;
    this.angle = 0; // radians; 0 = east
    this.pitch = 0; // vertical look, radians
    this.eyeZ = 0.5;      // camera height above local terrain (0.5 = on foot)
    this.flying = false;  // the Fly spell
    this.landing = false;
    this.flyCaster = -1;
    this.flyDrainAt = 0;

    // party buffs (expiry timestamps; effect sizes are fixed per spell)
    this.buffs = { atkUntil: 0, defUntil: 0, hasteUntil: 0, regenUntil: 0, waterwalkUntil: 0 };
    this.regenNext = 0;
    this.sinkNext = 0;
    this._buffStr = '';

    if (this.save) {
      this.px = this.save.px; this.py = this.save.py; this.angle = this.save.angle || 0;
      this.flying = !!this.save.flying;
      this.eyeZ = this.save.eyeZ || 0.5;
      this.flyCaster = this.save.flyCaster != null ? this.save.flyCaster : -1;
    }
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
      if (!this.dead && !this.dialogOpen && !this.sbOpen && !this.invOpen && !this.shopOpen && this.nearVillager) {
        this.openDialogue(this.nearVillager);
      }
    });

    // click: grab mouse-look if not locked, and swing at whatever's in your sights
    this.input.on('pointerdown', () => {
      if (this.dialogOpen || this.dead || this.sbOpen || this.invOpen || this.shopOpen) return;
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
      if (this.dialogOpen || this.sbOpen || this.invOpen || this.shopOpen) return;
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
      if (this.sbOpen) this.closeSpellbook(); else this.openSpellbook();
    });
    this.input.keyboard.on('keydown-I', () => {
      if (this.dialogOpen || this.dead) return;
      if (this.shopOpen) this.closeShop();
      if (this.invOpen) this.closeInventory(); else this.openInventory();
    });
    this.input.keyboard.on('keydown-ESC', () => {
      if (this.sbOpen) this.closeSpellbook();
      if (this.invOpen) this.closeInventory();
      if (this.shopOpen) this.closeShop();
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
    const party = GameData.party.map(h => ({
      level: h.level, xp: h.xp, hp: h.hp, maxHp: h.maxHp, mp: h.mp, maxMp: h.maxMp,
      atk: h.atk, def: h.def, spells: h.spells.slice(), quick: h.quick,
      weapon: h.weapon, armor: h.armor, readyAt: 0,
    }));
    const s = {
      v: 2, seed: this.worldSeed, // v2 = Eastmarch-era uid ordering
      px: this.px, py: this.py, angle: this.angle,
      flying: this.flying, eyeZ: this.eyeZ, flyCaster: this.flyCaster,
      gold: GameData.gold, inventory: GameData.inventory,
      flags: GameData.flags, quests: GameData.quests,
      party, gone: [...this.goneUids],
    };
    try { localStorage.setItem('emberfall-save', JSON.stringify(s)); } catch (e) {}
  }

  // ---------- map & entities ----------

  buildMap() {
    this.map = [];
    for (let y = 0; y < MAP_H; y++) this.map.push(new Array(MAP_W).fill(T_GRASS));

    for (let x = 0; x < MAP_W; x++) { this.map[0][x] = T_ROCK; this.map[MAP_H - 1][x] = T_ROCK; }
    for (let y = 0; y < MAP_H; y++) { this.map[y][0] = T_ROCK; this.map[y][MAP_W - 1] = T_ROCK; }

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

    // stamp the authored village over whatever the wilderness generated
    const CHAR_TILE = {
      F: T_FENCE, T: T_TIMBER, V: T_TIMBER, S: T_STONE, B: T_PLANK,
      D: T_DOOR, n: T_TIMBER_WIN, m: T_STONE_WIN, o: T_PLANK_WIN,
      a: T_SIGN_TAVERN, b: T_SIGN_SMITH, c: T_SIGN_TRADE, h: T_BANNER, C: T_CHIMNEY,
      ':': T_COBBLE, ',': T_DIRT, '=': T_WOOD,
      K: T_DIRT, X: T_DIRT, // Eastmarch: campfire & tents stand on dirt (props supply the art)
    };
    this.doors = [];
    for (const s of SETTLEMENTS) {
      s.layout.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          this.map[s.y1 + ry][s.x1 + rx] = CHAR_TILE[row[rx]] || T_GRASS;
          if (row[rx] === 'D') this.doors.push({ x: s.x1 + rx, y: s.y1 + ry, open: false });
        }
      });
    }

    // the east road: a clear corridor from the village gate to Eastmarch's,
    // fording the river and winding through the hills (stops at the camp's west wall)
    const roadY = VILLAGE.y1 + 8; // the gate row
    for (let x = VILLAGE.x2 + 1; x < SETTLEMENTS[1].x1 && x < MAP_W - 1; x++) {
      for (let y = roadY - 1; y <= roadY + 1; y++) {
        const t = this.map[y][x];
        if (y === roadY) this.map[y][x] = T_DIRT;
        else if (t !== T_GRASS && t !== T_COBBLE) this.map[y][x] = T_GRASS;
      }
    }

    this.buildHeights();
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

    // each settlement sits on a leveled shelf; fade the flattening outward
    for (const st of SETTLEMENTS) {
      for (let y = 0; y < H1; y++) {
        for (let x = 0; x < W1; x++) {
          const dx = Math.max(st.x1 - x, 0, x - (st.x2 + 1));
          const dy = Math.max(st.y1 - y, 0, y - (st.y2 + 1));
          const d = Math.hypot(dx, dy);
          if (d < 5) h[y][x] *= d / 5;
        }
      }
    }
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
    return SETTLEMENTS.some(s =>
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

    // forest regions — oak and pine woods with clearings, plus scattered loners
    const treeOk = (x, y) =>
      x >= 2 && y >= 2 && x < MAP_W - 2 && y < MAP_H - 2 &&
      this.map[y][x] === T_GRASS && !this.inVillage(x, y, 2) && !this.entityAt(x, y);
    for (let f = 0; f < 9; f++) {
      const fx = gri(8, MAP_W - 9), fy = gri(6, MAP_H - 7);
      const r = gri(4, 7), pineWood = grand() < 0.4;
      const tries = Math.floor(r * r * 1.6);
      for (let i = 0; i < tries; i++) {
        const a = grand() * Math.PI * 2, rr = grand() * r;
        const x = Math.round(fx + Math.cos(a) * rr), y = Math.round(fy + Math.sin(a) * rr);
        if (!treeOk(x, y)) continue;
        const main = grand() < 0.85;
        add('tree', pineWood === main ? 'pine' : 'tree', x, y);
      }
    }
    for (let i = 0; i < 70; i++) {
      const x = gri(2, MAP_W - 3), y = gri(2, MAP_H - 3);
      if (treeOk(x, y)) add('tree', grand() < 0.7 ? 'tree' : 'pine', x, y);
    }

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
      add('enemy', nearVillage ? 'slime' : d < 52 ? 'goblin' : 'wolf', x, y);
      enemies++;
    }

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

  entityAt(gx, gy) { return this.entities.find(e => e.gx === gx && e.gy === gy); }

  walkableAt(gx, gy, allowWater) {
    if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) return false;
    const t = this.map[gy][gx];
    return t <= T_COBBLE || t === T_WOOD || (allowWater && t === T_WATER);
  }

  // ---------- movement & collision ----------

  canStand(x, y) {
    const r = 0.28;
    // Water Walk (or already sinking mid-river) lets the party tread water
    const aw = this.time.now < this.buffs.waterwalkUntil || this._onWater;
    if (!(this.walkableAt(Math.floor(x - r), Math.floor(y - r), aw) &&
          this.walkableAt(Math.floor(x + r), Math.floor(y - r), aw) &&
          this.walkableAt(Math.floor(x - r), Math.floor(y + r), aw) &&
          this.walkableAt(Math.floor(x + r), Math.floor(y + r), aw))) return false;
    if (!aw && this.slopeAt(x, y) > 0.85) return false; // too steep to climb
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
        const speed = this.flying ? 5.5 : 3.1; // the wind carries you swiftly
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

      // flight: R/X (or PgUp/PgDn, as in MM7) to rise and dive
      if (this.flying) {
        const rise = (k.R.isDown || k.PAGE_UP.isDown) ? 1 : 0;
        const dive = (k.X.isDown || k.PAGE_DOWN.isDown) ? 1 : 0;
        let target = this.eyeZ + (rise - dive) * 1.3 * dt;
        if (this.landing) target = this.eyeZ - 1.3 * dt;
        const minZ = this.minEyeAt(this.px, this.py);
        this.eyeZ = clamp(target, Math.max(0.5, minZ), 2.1);
        if (this.landing && minZ > 0.5 && this.eyeZ <= minZ + 0.02) {
          this.landing = false;
          this.toast('No solid ground below!');
        }
        if ((this.landing || dive) && this.eyeZ <= 0.505 && minZ <= 0.5) {
          if (this.slopeAt(this.px, this.py) < 0.9) {
            this.flying = false; this.landing = false; this.eyeZ = 0.5;
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
        // burning ticks (Fire school)
        if (e.burnUntil && time < e.burnUntil && time > (e.burnNext || 0)) {
          e.burnNext = time + 1000;
          this.damageEnemy(e, 3);
          if (e.hp <= 0) continue;
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
          } else if (time > e.nextAtk && this.eyeZ < 1.05) { // can't claw what flies
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

      // buff upkeep: regeneration ticks, water-walk sinking, HUD readout
      this._onWater = (this.map[Math.floor(this.py)] || [])[Math.floor(this.px)] === T_WATER;
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
      const bs = bl.join('  ');
      if (bs !== this._buffStr) { this._buffStr = bs; this.buffText.setText(bs); }

      const grounded = this.eyeZ < 0.7;

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

    // render the 3D view (tread the water surface, not the riverbed)
    const gz = this.terrainH(this.px, this.py);
    this.camZ = (this._onWater ? Math.max(gz, -0.24) : gz) + this.eyeZ;
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
    if (this.dead || this.dialogOpen || this.sbOpen || this.invOpen || this.shopOpen) return;
    const t = this.target;
    if (!t) {
      if (time > (this._attackMsgCd || 0)) { this.toast('No monster in your sights.'); this._attackMsgCd = time + 1500; }
      return;
    }
    const d = Math.hypot(t.x - this.px, t.y - this.py, this.eyeZ - 0.5); // altitude counts
    let fired = 0;
    const volleyColors = { Roderick: '#e8e8f0', Wren: '#e8d8a0', Serena: '#f0f0ff', Malwick: '#c080ff' };
    GameData.party.forEach((h, hi) => {
      if (h.hp <= 0 || time < h.readyAt || d > h.range || t.hp <= 0) return;
      h.readyAt = time + h.rec * this.hasteMul();
      fired++;
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
      this.damageEnemy(t, Math.max(1, heroAtk(h) + this.buffAtk() + h.level + ri(0, 3) - t.def));
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
    const fx = SPELLS[spellId] && SPELLS[spellId].fx;
    if (!fx || !FX.ready) return;
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

  castSkill(idx, time) {
    if (this.dead || this.dialogOpen || this.sbOpen || this.invOpen || this.shopOpen) return;
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
    const tDist = t ? Math.hypot(t.x - this.px, t.y - this.py, this.eyeZ - 0.5) : Infinity;
    let ok = false;

    switch (h.quick) {
      case 'cleave': {
        const victims = this.entities.filter(e => e.kind === 'enemy' && Math.hypot(e.x - this.px, e.y - this.py, this.eyeZ - 0.5) < 2.6);
        if (!victims.length) { this.toast('No foes within reach of the cleave!'); return; }
        victims.forEach(v => this.damageEnemy(v, Math.max(1, Math.round(heroAtk(h) * 0.7) + this.buffAtk() + h.level + ri(0, 2) - v.def)));
        ok = true;
        break;
      }
      case 'doubleshot': {
        if (!t || tDist > 9) { this.toast('No target in bow range!'); return; }
        this.damageEnemy(t, Math.max(1, Math.round(heroAtk(h) * 0.8) + this.buffAtk() + h.level + ri(0, 2) - t.def));
        this.time.delayedCall(160, () => {
          if (t.hp > 0 && this.entities.includes(t)) {
            this.damageEnemy(t, Math.max(1, Math.round(heroAtk(h) * 0.8) + this.buffAtk() + h.level + ri(0, 2) - t.def));
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
        victims.forEach(v => this.damageEnemy(v, Math.max(1, 9 + h.level * 3 + ri(0, 3) - v.def)));
        ok = true;
        break;
      }
      case 'fly': {
        this.flying = true;
        this.landing = false;
        this.flyCaster = idx;
        this.flyDrainAt = time + 4000;
        this.eyeZ = 0.75; // lift off

        this.toast('The party takes wing! R/X (or PgUp/PgDn) to rise and dive — cast Fly again to land.');
        ok = true;
        break;
      }
      case 'frostnova': {
        const victims = this.entities.filter(e => e.kind === 'enemy' && Math.hypot(e.x - this.px, e.y - this.py, this.eyeZ - 0.5) < 3.5);
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
        this.damageEnemy(t, Math.max(1, 6 + h.level * 2 + ri(0, 2) - t.def));
        if (t.hp > 0) { t.burnUntil = time + 4000; t.burnNext = time + 1000; }
        ok = true;
        break;
      }
      case 'ringfire': {
        const victims = this.enemiesNear(this.px, this.py, 4);
        if (!victims.length) { this.toast('No foes near enough to burn!'); return; }
        this.cameras.main.flash(160, 255, 110, 20);
        victims.forEach(v => {
          this.damageEnemy(v, Math.max(1, 8 + h.level * 2 + ri(0, 3) - v.def));
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
        this.damageEnemy(t, Math.max(1, dmg - t.def));
        const chained = this.enemiesNear(t.x, t.y, 3).filter(v => v !== t && v.hp > 0).slice(0, 2);
        chained.forEach(v => {
          if (FX.ready) {
            FX.beam(t.x, this.terrainH(t.x, t.y) + 0.6, t.y,
              v.x, this.terrainH(v.x, v.y) + 0.6, v.y, '#a0e0ff');
          }
          this.damageEnemy(v, Math.max(1, Math.round(dmg * 0.6) - v.def));
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
        this.damageEnemy(t, Math.max(1, 6 + h.level * 2 + ri(0, 2) - t.def));
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
        this.damageEnemy(t, Math.max(1, 8 + h.level * 3 + ri(0, 3) - t.def));
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
        this.damageEnemy(t, Math.max(1, 14 + h.level * 4 + ri(0, 4) - t.def));
        if (t.hp > 0) t.nextAtk = Math.max(t.nextAtk, time + 3000);
        ok = true;
        break;
      }
      case 'prismatic': {
        const victims = this.enemiesNear(this.px, this.py, 9)
          .filter(v => this.lineOfSight(this.px, this.py, v.x, v.y, this.camZ));
        if (!victims.length) { this.toast('No foes in sight!'); return; }
        this.cameras.main.flash(180, 255, 255, 255);
        victims.forEach(v => this.damageEnemy(v, Math.max(1, 9 + h.level * 3 + ri(0, 3) - v.def)));
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
    this.entities.splice(this.entities.indexOf(e), 1);
    if (this.target === e) this.target = null;
    let dropMsg = '';
    if (Math.random() < 0.22) {
      const id = e.type === 'wolf'
        ? (Math.random() < 0.5 ? 'emerald' : 'hpotion')
        : (Math.random() < 0.5 ? 'hpotion' : 'mpotion');
      if (invAdd(id)) dropMsg = `, ${ITEM_TYPES[id].name}`;
    }
    this.toast(`${ENEMY_TYPES[e.type].name} slain! +${e.xp} XP, +${gold} gold${dropMsg}` + (notes.length ? ' — ' + notes.join(' ') : ''));
    if (!this.entities.some(x => x.kind === 'enemy')) {
      this.time.delayedCall(1500, () => this.toast('The vale is at peace... you cleared every monster!'));
    }
    this.refreshHUD();
    this.saveGame();
  }

  enemyStrike(e) {
    if (this.time.now < this.invulnUntil) return;
    const targets = GameData.party.filter(h => h.hp > 0);
    if (!targets.length) return;
    const h = targets[ri(0, targets.length - 1)];
    const atkVal = this.time.now < (e.curseUntil || 0) ? Math.ceil(e.atk / 2) : e.atk;
    const dmg = Math.max(1, atkVal + ri(-1, 2) - heroDef(h) - this.buffDef());
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
      this.px = START.x; this.py = START.y; this.angle = 0;
      this.pitch = 0; this.eyeZ = 0.5; this.flying = false; this.landing = false;
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

    // the selected hero's page: spells grouped by school
    const h = GameData.party[this.sbSel];
    let py = 106;
    for (const sc of Object.keys(SCHOOLS)) {
      const known = h.spells.filter(id => SPELLS[id].school === sc);
      if (!known.length) continue;
      add(this.add.text(224, py, SCHOOLS[sc].name.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold',
        color: SCHOOLS[sc].color, stroke: '#2a2014', strokeThickness: 2,
      }));
      py += 18;
      known.forEach((id, j) => {
        const sp = SPELLS[id];
        const cx = 224 + (j % 3) * 202, cy = py + Math.floor(j / 3) * 46;
        const readied = h.quick === id;
        const card = add(this.add.rectangle(cx + 94, cy + 20, 196, 40, readied ? 0x8a6f28 : 0x4a4032, readied ? 0.35 : 0.12)
          .setStrokeStyle(readied ? 3 : 1, readied ? 0xc9a227 : 0x6a5a38))
          .setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => { h.quick = id; this.refreshHUD(); this.openSpellbook(); });
        add(this.add.image(cx + 18, cy + 20, sp.icon).setDisplaySize(28, 28));
        add(this.add.text(cx + 36, cy + 6, sp.name, {
          fontFamily: 'monospace', fontSize: '11px', color: '#3a2c14', fontStyle: 'bold',
        }));
        add(this.add.text(cx + 36, cy + 21, sp.cost + ' mp', {
          fontFamily: 'monospace', fontSize: '10px', color: '#7a1f1f',
        }));
      });
      py += Math.ceil(known.length / 3) * 46 + 8;
    }

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
    this.shopContainer.add(this.add.text(480, 54, "— ODO'S WARES —", {
      fontFamily: 'monospace', fontSize: '22px', color: '#3a2c14', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  openShop() {
    if (this.sbOpen) this.closeSpellbook();
    if (this.invOpen) this.closeInventory();
    this.shopOpen = true;
    this.refreshShop();
    this.shopContainer.setVisible(true);
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

    SHOP_STOCK.forEach((id, i) => {
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
    if (GameData.gold < it.price) { this.toast('Odo tuts: not enough gold.'); return; }
    if (!invAdd(id)) { this.toast('Your packs are full!'); return; }
    GameData.gold -= it.price;
    this.toast(`Bought: ${it.name} for ${it.price} gold.`);
    this.refreshHUD();
    this.refreshShop();
    this.saveGame();
  }

  // ---------- minimap ----------

  buildMinimap() {
    const S = 2;
    const tex = this.textures.createCanvas('mmap', MAP_W * S, MAP_H * S);
    const g = tex.getContext();
    const colors = {
      [T_DIRT]: '#7a5c34', [T_COBBLE]: '#8a8f98', [T_WATER]: '#2a5d8f',
      [T_WOOD]: '#8f6a42', [T_ROCK]: '#6a6e78', [T_FENCE]: '#8a6238', [T_TIMBER]: '#d8cfb8',
      [T_PLANK]: '#9a7248', [T_STONE]: '#9aa0aa', [T_DOOR]: '#6b4526',
      [T_TIMBER_WIN]: '#d8cfb8', [T_STONE_WIN]: '#9aa0aa', [T_PLANK_WIN]: '#9a7248',
      [T_SIGN_TAVERN]: '#d8cfb8', [T_SIGN_SMITH]: '#9aa0aa', [T_SIGN_TRADE]: '#9a7248',
      [T_BANNER]: '#d8cfb8', [T_CHIMNEY]: '#6a6e78',
    };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = this.map[y][x];
      let c = colors[t];
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
    this.questText.setText(
      q === 'available' ? 'Bram the Smith looks troubled — visit the smithy' :
      q === 'active' ? 'Quest: The Lost Blade — goblin camp east, across the river ford' :
      q === 'found' ? 'Quest: The Lost Blade — return the blade to Bram' : '');
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
    this.refreshHUD();
    this.saveGame();
  }

  toast(msg) {
    this.toastText.setText(msg).setAlpha(1);
    if (this.toastTween) this.toastTween.stop();
    this.toastTween = this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2400, duration: 500 });
  }
}
