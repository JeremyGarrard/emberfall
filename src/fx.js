// Fire-and-forget 3D effects: spell bolts, impact bursts, ground rings, beams.
// A pool of additive-blended sprites driven from R3D.render() each frame.
//
//   FX.bolt(sx,sy,sz, tx,ty,tz, color, opts)  travelling missile, bursts on arrival
//   FX.burst(x,y,z, color, n, opts)           radial particle pop
//   FX.ring(x,y,z, color, radius)             expanding ground ring (novas)
//   FX.beam(sx,sy,sz, tx,ty,tz, color)        instant line, quick fade
//
// Adding a spell visual is DATA, not code: set `fx: {type, color, r}` on the
// SPELLS entry (see data.js) and world.spellFX() does the rest.

const FX = {
  ready: false,

  init(scene) {
    this.scene = scene;
    this.parts = [];
    this.free = [];
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    this.tex = new THREE.CanvasTexture(c);
    this.lastT = 0;
    this.ready = true;
  },

  acquire(x, y, z, color, scale) {
    let p = this.free.pop();
    if (!p) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      p = { sprite: new THREE.Sprite(mat) };
      this.scene.add(p.sprite);
    }
    p.sprite.visible = true;
    p.sprite.material.color.set(color);
    p.sprite.material.opacity = 1;
    p.sprite.position.set(x, y, z);
    p.sprite.scale.set(scale, scale, 1);
    p.vx = 0; p.vy = 0; p.vz = 0;
    p.drag = 1; p.grav = 0;
    p.life = 0.5; p.age = 0;
    p.trail = null; p.onDie = null;
    this.parts.push(p);
    return p;
  },

  burst(x, y, z, color, n = 10, o = {}) {
    if (!this.ready) return;
    for (let i = 0; i < n; i++) {
      const p = this.acquire(x, y, z, color, o.scale || 0.22);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() - 0.3;
      const sp = (o.speed || 2.2) * (0.4 + Math.random() * 0.6);
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = up * sp;
      p.grav = o.grav !== undefined ? o.grav : -3;
      p.drag = 0.92;
      p.life = o.life || 0.5;
    }
  },

  bolt(sx, sy, sz, tx, ty, tz, color, o = {}) {
    if (!this.ready) return;
    const d = Math.hypot(tx - sx, ty - sy, tz - sz) || 0.1;
    const speed = o.speed || 16;
    const p = this.acquire(sx, sy, sz, color, o.scale || 0.3);
    p.vx = (tx - sx) / d * speed;
    p.vy = (ty - sy) / d * speed;
    p.vz = (tz - sz) / d * speed;
    p.life = d / speed;
    p.trail = color;
    if (o.noBurst !== true) p.onDie = () => this.burst(tx, ty, tz, color, o.burst || 10);
  },

  beam(sx, sy, sz, tx, ty, tz, color) {
    if (!this.ready) return;
    const n = Math.max(4, Math.floor(Math.hypot(tx - sx, ty - sy, tz - sz) * 2.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = this.acquire(sx + (tx - sx) * t, sy + (ty - sy) * t, sz + (tz - sz) * t, color, 0.24);
      p.life = 0.22 + t * 0.12;
    }
  },

  ring(x, y, z, color, radius = 4, n = 20) {
    if (!this.ready) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = this.acquire(x + Math.cos(a) * 0.4, y, z + Math.sin(a) * 0.4, color, 0.3);
      const sp = radius / 0.5;
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.drag = 0.86;
      p.life = 0.55;
    }
  },

  update(time) {
    if (!this.ready) return;
    const dt = Math.min((time - this.lastT) / 1000, 0.1) || 0.016;
    this.lastT = time;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age >= p.life) {
        const die = p.onDie;
        p.onDie = null;
        p.sprite.visible = false;
        this.parts.splice(i, 1);
        this.free.push(p);
        if (die) die();
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.sprite.material.opacity = 1 - p.age / p.life;
      if (p.trail && Math.random() < 0.7) {
        const q = this.acquire(p.sprite.position.x, p.sprite.position.y, p.sprite.position.z, p.trail, 0.15);
        q.life = 0.25;
      }
    }
  },
};
