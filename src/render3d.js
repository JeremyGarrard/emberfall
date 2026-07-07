// Real-3D renderer (three.js) — replaces the software raycaster so the vale
// can have ACTUAL terrain: a heightfield with rolling hills you walk over,
// carved riverbeds, a mountain rim, and buildings with real gabled roofs.
//
// world.js drives it: R3D.init(container, worldData) once, R3D.render(state)
// every frame. Boot (world.js) still paints all textures into ART/SKY canvases.

const ART = {};
const WALL_ART = {};
const WALL_ART_ALT = {}; // legacy raycaster variants; Boot still fills it, 3D path ignores it
const FLOOR_PIX = {}; // legacy from the raycaster; Boot still fills it, 3D path ignores it
let SKY = null;

// wall-piece heights in world units (village structures; the rock border is terrain now)
const WALL_HEIGHT = {
  5: 1.6, 6: 0.65, 7: 1.25, 8: 1.25, 9: 1.25,
  10: 1.25, 11: 1.25, 12: 1.25, 13: 1.25,
  14: 1.25, 15: 1.25, 16: 1.25, 17: 1.25,
  18: 1.9,
};

const R3D = {
  ready: false,

  init(container, world) {
    this.world = world; // { map, mapW, mapH, heights, terrainH(x,y), doors, buildings }

    const canvas = document.createElement('canvas');
    canvas.id = 'view3d';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.zIndex = '0';
    container.insertBefore(canvas, container.firstChild);
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setSize(960, 510, false);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc6d8ec, 10, 36);

    this.camera = new THREE.PerspectiveCamera(68, 960 / 510, 0.08, 140);

    // clear-afternoon light
    this.scene.add(new THREE.HemisphereLight(0xbfd8f8, 0x4a6a3a, 0.95));
    const sun = new THREE.DirectionalLight(0xfff2d8, 0.8);
    sun.position.set(-40, 60, -25);
    this.scene.add(sun);

    this.buildSky();
    this.buildTerrain();
    this.buildWater();
    this.buildWalls();
    this.buildRoofs();
    this.buildBridges();

    FX.init(this.scene);

    this.spriteMats = {};
    this.sprites = new Map();
    this.ready = true;
  },

  // ---------- static geometry ----------

  buildSky() {
    const tex = new THREE.CanvasTexture(SKY);
    tex.wrapS = THREE.RepeatWrapping;
    const geo = new THREE.SphereGeometry(90, 24, 10);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.skyMesh);
  },

  buildTerrain() {
    const { mapW, mapH, heights, map } = this.world;
    const W1 = mapW + 1, H1 = mapH + 1;
    const pos = [], col = [], idx = [], uv = [];
    for (let y = 0; y < H1; y++) {
      for (let x = 0; x < W1; x++) {
        const h = heights[y][x];
        pos.push(x, h, y);
        uv.push(x / 2, y / 2); // detail texture tiles every 2 units
        const tx = Math.min(x, mapW - 1), ty = Math.min(y, mapH - 1);
        let t = map[ty][tx];
        if (t >= 5) t = 0;
        let c;
        if (t === 1) c = [0.48, 0.36, 0.20];       // dirt road
        else if (t === 2) c = [0.54, 0.56, 0.60];  // cobbles
        else if (t === 4) c = [0.56, 0.42, 0.26];  // interior wood
        else if (t === 3) c = [0.24, 0.34, 0.28];  // lake/river bed
        else {
          // grass, shaded by elevation with a subtle patchwork
          const e = Math.max(0, Math.min(1, h / 4.5));
          const n = (((x * 7 + y * 13) % 5) - 2) * 0.014;
          c = [0.22 + e * 0.26 + n, 0.48 + e * 0.24 + n, 0.20 + e * 0.14];
        }
        col.push(c[0], c[1], c[2]);
      }
    }
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const a = y * W1 + x, b = a + 1, c2 = a + W1, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // near-white noise texture multiplies the vertex colors: ground detail
    // without shifting the hue of grass/dirt/cobble tints
    const detail = new THREE.CanvasTexture(ART.terrainNoise);
    detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, map: detail });
    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.terrainMesh);
  },

  buildWater() {
    const { map, mapW, mapH } = this.world;
    const wl = -0.22;
    const pos = [], idx = [];
    let n = 0;
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (map[y][x] !== 3) continue;
        pos.push(x, wl, y, x + 1, wl, y, x, wl, y + 1, x + 1, wl, y + 1);
        idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
        n += 4;
      }
    }
    if (!n) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshPhongMaterial({
      color: 0x2f6fa8, transparent: true, opacity: 0.78, shininess: 80, specular: 0x88aacc,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  },

  wallTex(key) {
    if (!this.wallTexes) this.wallTexes = {};
    if (!this.wallTexes[key]) {
      const tex = new THREE.CanvasTexture(ART[key]);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      this.wallTexes[key] = tex;
    }
    return this.wallTexes[key];
  },

  buildWalls() {
    const { map, mapW, mapH, doors, terrainH } = this.world;
    const doorSet = new Set(doors.map(d => d.x + ',' + d.y));
    this.doorMeshes = new Map();
    const TILE_ART = {
      6: 'fencewall', 7: 'timberwall', 8: 'plankwall', 9: 'rockwall',
      10: 'doorwall', 11: 'timberwin', 12: 'stonewin', 13: 'plankwin',
      14: 'signtavern', 15: 'signsmith', 16: 'signtrade', 17: 'bannerwall', 18: 'rockwall',
    };
    const mats = {};
    const matFor = key => {
      if (!mats[key]) mats[key] = new THREE.MeshLambertMaterial({ map: this.wallTex(key) });
      return mats[key];
    };
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const t = map[y][x];
        const isDoor = doorSet.has(x + ',' + y);
        if (!isDoor && (t < 6 || !TILE_ART[t])) continue; // rock border (5) is terrain now
        const key = isDoor ? 'doorwall' : TILE_ART[t];
        const h = WALL_HEIGHT[isDoor ? 10 : t] || 1.25;
        const ground = terrainH(x + 0.5, y + 0.5);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1), matFor(key));
        mesh.position.set(x + 0.5, ground + h / 2, y + 0.5);
        this.scene.add(mesh);
        if (isDoor) {
          const d = doors.find(dd => dd.x === x && dd.y === y);
          if (d) this.doorMeshes.set(d, mesh);
        }
      }
    }
  },

  buildBridges() {
    const cells = this.world.bridges;
    if (!cells || !cells.length) return;
    const deckH = this.world.bridgeH || 0.06;
    const plank = new THREE.MeshLambertMaterial({ map: this.wallTex('plankwall') });
    const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
    const grp = new THREE.Group();
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    for (const [x, y] of cells) {
      // plank deck
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.14, 1.02), plank);
      deck.position.set(x + 0.5, deckH, y + 0.5);
      grp.add(deck);
      // support posts plunging to the riverbed
      for (const [ox, oy] of [[0.12, 0.12], [0.88, 0.88]]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood);
        post.position.set(x + ox, deckH - 0.55, y + oy);
        grp.add(post);
      }
    }
    // railings along the two long edges of the span
    const horiz = (maxX - minX) >= (maxY - minY);
    for (const side of [0, 1]) {
      const rail = new THREE.Mesh(
        horiz ? new THREE.BoxGeometry((maxX - minX) + 1.1, 0.32, 0.1)
              : new THREE.BoxGeometry(0.1, 0.32, (maxY - minY) + 1.1), wood);
      if (horiz) rail.position.set((minX + maxX) / 2 + 0.5, deckH + 0.28, (side ? maxY + 0.98 : minY + 0.02));
      else rail.position.set((side ? maxX + 0.98 : minX + 0.02), deckH + 0.28, (minY + maxY) / 2 + 0.5);
      grp.add(rail);
    }
    this.scene.add(grp);
  },

  buildRoofs() {
    for (const b of this.world.buildings) {
      const o = 0.22;                       // eave overhang
      const x1 = b.x1 - o, x2 = b.x2 + 1 + o;
      const z1 = b.y1 - o, z2 = b.y2 + 1 + o;
      const eave = b.h + 0.02, peak = b.h + 0.75;
      const cz = (z1 + z2) / 2;
      const pos = [
        // north slope
        x1, eave, z1, x2, eave, z1, x2, peak, cz,
        x1, eave, z1, x2, peak, cz, x1, peak, cz,
        // south slope
        x2, eave, z2, x1, eave, z2, x1, peak, cz,
        x2, eave, z2, x1, peak, cz, x2, peak, cz,
        // gables
        x1, eave, z2, x1, eave, z1, x1, peak, cz,
        x2, eave, z1, x2, eave, z2, x2, peak, cz,
      ];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshPhongMaterial({ color: b.color, flatShading: true, shininess: 0, side: THREE.DoubleSide });
      this.scene.add(new THREE.Mesh(geo, mat));
    }
  },

  // ---------- entities ----------

  spriteMat(key) {
    if (!this.spriteMats[key]) {
      const tex = new THREE.CanvasTexture(ART[key]);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      this.spriteMats[key] = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.15 });
    }
    return this.spriteMats[key];
  },

  syncEntities(state) {
    const { entities, time, px, py } = state;
    const { terrainH } = this.world;
    const seen = new Set();
    const anim = k => k === 'enemy' || k === 'ally' || k === 'dying' || k === 'decor';
    for (const e of entities) {
      seen.add(e);
      let s = this.sprites.get(e);
      const hgt = 1 / (e.vDiv || 1);
      if (!s) {
        let mat = this.spriteMat(e.art);
        if (anim(e.kind)) mat = mat.clone(); // per-instance tint/opacity/scale
        s = new THREE.Sprite(mat);
        s.scale.set(hgt, hgt, 1);
        this.scene.add(s);
        this.sprites.set(e, s);
      }
      let ex = e.x, ez = e.y, sc = hgt, yOff = e.zOff || 0;

      if (e.kind === 'enemy' || e.kind === 'ally') {
        yOff += Math.sin(time * 0.005 + (e.uid || 0) * 1.7) * hgt * 0.04; // idle bob
        // hit flinch: brief scale-pop + red flash
        if (e.flinch && time < e.flinch) {
          const f = (e.flinch - time) / 160;
          sc = hgt * (1 + 0.2 * f);
          s.material.color.setRGB(1, 1 - 0.55 * f, 1 - 0.55 * f);
        } else if (s.material.color.r !== 1 || s.material.color.g !== 1) {
          s.material.color.setRGB(1, 1, 1);
        }
        // attack lunge: hop toward the party
        if (e.lunge && time < e.lunge) {
          const l = Math.sin(((e.lunge - time) / 220) * Math.PI) * 0.35;
          const d = Math.hypot(px - e.x, py - e.y) || 1;
          ex += (px - e.x) / d * l; ez += (py - e.y) / d * l;
        }
        s.material.opacity = 1;
      } else if (e.kind === 'dying') {
        const p = Math.min(1, (time - e.dying) / 650); // fade, sink, shrink, tip
        s.material.opacity = 1 - p;
        s.material.color.setRGB(1, 1 - 0.4 * p, 1 - 0.4 * p);
        sc = hgt * (1 - 0.35 * p);
        yOff -= p * hgt * 0.5;
      } else if (e.kind === 'decor') {
        s.material.opacity = 0.55 + 0.25 * Math.sin(time * 0.0012 + e.x * 3);
      }

      if (s.scale.x !== sc) s.scale.set(sc, sc, 1);
      s.position.set(ex, terrainH(e.x, e.y) + sc / 2 + yOff, ez);
    }
    for (const [e, s] of this.sprites) {
      if (!seen.has(e)) {
        this.scene.remove(s);
        this.sprites.delete(e);
      }
    }
  },

  // conjured walls (Bulwark etc.) — added/removed at runtime
  addTempWall(x, y) {
    const h = 1.2;
    const ground = this.world.terrainH(x + 0.5, y + 0.5);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, h, 1),
      new THREE.MeshLambertMaterial({ map: this.wallTex('rockwall') }));
    mesh.position.set(x + 0.5, ground + h / 2, y + 0.5);
    this.scene.add(mesh);
    return mesh;
  },

  removeTempWall(mesh) {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
  },

  // ---------- per frame ----------

  render(state) {
    if (!this.ready) return;
    this.camera.position.set(state.px, state.camZ, state.py);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    this.camera.lookAt(
      state.px + Math.cos(state.angle) * cp,
      state.camZ + sp,
      state.py + Math.sin(state.angle) * cp);
    this.syncEntities(state);
    FX.update(state.time);
    for (const [d, m] of this.doorMeshes) m.visible = !d.open;
    this.skyMesh.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  },

  // world point -> overlay UI coords (960x640 space; the 3D view is the top 510)
  project(x, y, z) {
    const dx = x - this.camera.position.x, dy = y - this.camera.position.y, dz = z - this.camera.position.z;
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    if (f.x * dx + f.y * dy + f.z * dz < 0.1) return null; // behind us
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * 960,
      y: (-v.y * 0.5 + 0.5) * 510,
      visible: Math.abs(v.x) < 1.4 && Math.abs(v.y) < 1.4,
    };
  },

  // mirror Phaser's letterboxed CSS box; the 3D canvas takes the top 510/640 of it
  syncSize(phCanvas) {
    const st = phCanvas.style, c = this.canvas.style;
    c.width = st.width;
    c.height = 'calc(' + st.height + ' * 0.796875)';
    c.marginLeft = st.marginLeft;
    c.marginTop = st.marginTop;
  },
};
