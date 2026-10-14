(() => {
  'use strict';

  const canvas = document.getElementById('room');
  const journey = document.getElementById('journey');
  if (!canvas || !journey) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search);
  const frozen = query.has('p') ? parseFloat(query.get('p')) : null;

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  const inOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const outCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const inCubic = (t) => Math.pow(clamp01(t), 3);
  const outBack = (t, k = 1.7) => { const x = clamp01(t) - 1; return 1 + (k + 1) * x * x * x + k * x * x; };
  const bump = (t, a, b, c, d) => inOut(seg(t, a, b)) * (1 - inOut(seg(t, c, d)));

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
  const rotZ = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rr = (a, b) => a + (b - a) * rand();

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const cmix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const COL = {
    ink: hex('#2B1D12'),
    line: hex('#1A110A'),
    paper: hex('#FBF3E4'),
    surface: [255, 255, 255],
    sticker: hex('#F2C14E'),
    tomato: hex('#E0533D'),
    wood: hex('#C9925B'),
    woodDark: hex('#A8723E'),
    muted: hex('#7A6450'),
    wall: hex('#2F2119'),
    wallLow: hex('#251912'),
    floor: hex('#24170F'),
    sage: hex('#6FA36B'),
    metal: hex('#1E1610'),
    brass: hex('#8A6A3C'),
  };
  const LIDS = {
    tomate: hex('#E0533D'), soleil: hex('#F2C14E'), ciel: hex('#4D96D9'),
    lavande: hex('#9B7FD9'), sauge: hex('#6FA36B'), rose: hex('#E68AA8'),
  };
  const PASTELS = ['#F9DDD5', '#FCE8B2', '#D6EBD3', '#DCE9F7', '#E8DFF8'].map(hex);
  const AVATAR = { 'Léa': hex('#B197FC'), 'Sam': hex('#8CC5F0'), 'Inès': hex('#F2C14E'), 'Noah': hex('#F9DDD5'), 'Max': hex('#2B1D12') };

  const dishes = {};
  for (const name of ['ramen', 'pizza', 'pancakes', 'wine', 'banhmi', 'tacos', 'icecream', 'bao', 'mezze', 'burger', 'sushi']) {
    const img = new Image();
    img.src = `img/dishes/${name}.webp`;
    dishes[name] = img;
  }
  const ready = (img) => img && img.complete && img.naturalWidth > 0;

  let W = 0, H = 0, dpr = 1;

  const cam = {
    eye: [0, 0, 0], r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, -1], focal: 1000, cx: 0, cy: 0, near: 0.6,
    set(eye, yaw, pitch, vfov, sx, sy) {
      this.eye = eye;
      this.f = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      this.r = [Math.cos(yaw), 0, -Math.sin(yaw)];
      const f = this.f, r = this.r;
      this.u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      this.focal = H / 2 / Math.tan(vfov / 2);
      this.cx = W / 2 + sx * W;
      this.cy = H / 2 + sy * H;
    },
    toCam(p) { const d = sub(p, this.eye); return [dot(d, this.r), dot(d, this.u), dot(d, this.f)]; },
    proj(c) { const s = this.focal / c[2]; return [this.cx + c[0] * s, this.cy - c[1] * s, s]; },
    P(p) { const c = this.toCam(p); return c[2] < this.near ? null : this.proj(c); },
    scale(p) { const z = this.toCam(p)[2]; return z > this.near ? this.focal / z : 0; },
    facing(p, n) { return dot(n, sub(this.eye, p)) > 0; },
  };

  function clipNear(poly, n) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ain = a[2] >= n, bin = b[2] >= n;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (n - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]);
      }
    }
    return out;
  }

  function screenPoly(pts) {
    const c = clipNear(pts.map((p) => cam.toCam(p)), cam.near);
    return c.length < 3 ? null : c.map((q) => cam.proj(q));
  }

  function screenSeg(a, b) {
    let ca = cam.toCam(a), cb = cam.toCam(b);
    const n = cam.near;
    if (ca[2] < n && cb[2] < n) return null;
    if (ca[2] < n) { const t = (n - ca[2]) / (cb[2] - ca[2]); ca = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, n]; }
    if (cb[2] < n) { const t = (n - cb[2]) / (ca[2] - cb[2]); cb = [cb[0] + (ca[0] - cb[0]) * t, cb[1] + (ca[1] - cb[1]) * t, n]; }
    return [cam.proj(ca), cam.proj(cb)];
  }

  function trace(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function hull(points) {
    const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const sprites = {};
  function sprite(name, rgb, soft = 0.45) {
    if (sprites[name]) return sprites[name];
    const s = document.createElement('canvas');
    s.width = s.height = 128;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, rgba(rgb, 1));
    grad.addColorStop(soft * 0.5, rgba(rgb, 0.55));
    grad.addColorStop(soft, rgba(rgb, 0.18));
    grad.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    sprites[name] = s;
    return s;
  }

  function glow(x, y, r, name, rgb, a, soft) {
    if (a <= 0.003 || r <= 0.5) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(sprite(name, rgb, soft), x - r, y - r, 2 * r, 2 * r);
    ctx.globalAlpha = 1;
  }

  const S = {
    p: 0, t: 0, glow: 0, exposure: 1, phone: 0,
    lamp: [112, 158, 70],
    lampBase: [112, 0, 70],
  };

  function lights() {
    return [
      { p: S.lamp, c: [1.0, 0.68, 0.4], i: 2.1, r: 120 },
      { p: [0, 192, 14], c: [1.0, 0.72, 0.45], i: 0.55, r: 85 },
      { p: S.mouth || [0, 186, 38], c: [1.0, 0.86, 0.6], i: S.glow * 2.6, r: 70 },
      { p: [64, 64, 97], c: [0.7, 0.8, 1.0], i: S.phone * 0.5, r: 30 },
    ];
  }
  let LIGHTS = lights();
  const AMB = [0.24, 0.19, 0.17];
  const MOON_DIR = norm([0.55, 0.25, -0.8]);

  function lightRGB(p, n) {
    let r = AMB[0], g = AMB[1], b = AMB[2];
    for (const L of LIGHTS) {
      if (L.i <= 0) continue;
      const d = sub(L.p, p);
      const dist = len(d) || 1;
      const ndl = n ? Math.max(0, dot(n, mul(d, 1 / dist))) * 0.7 + 0.3 : 1;
      const att = (L.i / (1 + (dist / L.r) * (dist / L.r))) * ndl;
      r += L.c[0] * att; g += L.c[1] * att; b += L.c[2] * att;
    }
    if (n) {
      const m = Math.max(0, -dot(n, MOON_DIR)) * 0.12;
      r += m * 0.5; g += m * 0.62; b += m * 0.95;
    }
    const e = S.exposure;
    return [r * e, g * e, b * e];
  }
  const lightLevel = (p) => { const l = lightRGB(p, null); return (l[0] + l[1] + l[2]) / 3; };
  const shade = (base, p, n) => { const l = lightRGB(p, n); return [Math.min(255, base[0] * l[0]), Math.min(255, base[1] * l[1]), Math.min(255, base[2] * l[2])]; };
  const darkness = (p) => clamp(1 - lightLevel(p) * 1.05, 0, 0.82);

  const strokeCol = rgba(COL.line, 1);

  function lw(p, cm) { return Math.max(0.6, Math.min(9, cm * cam.scale(p))); }

  function makeBox(c, s, color, o = {}) {
    const yaw = o.yaw || 0;
    const hx = s[0] / 2, hy = s[1] / 2, hz = s[2] / 2;
    const L = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
    const P = L.map((q) => add(c, rotY(q, yaw)));
    const faces = [
      [[4, 5, 6, 7], [0, 0, 1]], [[1, 0, 3, 2], [0, 0, -1]], [[5, 1, 2, 6], [1, 0, 0]],
      [[0, 4, 7, 3], [-1, 0, 0]], [[7, 6, 2, 3], [0, 1, 0]], [[0, 1, 5, 4], [0, -1, 0]],
    ].map(([idx, n]) => {
      const pts = idx.map((k) => P[k]);
      const cen = mul(pts.reduce(add, [0, 0, 0]), 0.25);
      return { pts, n: rotY(n, yaw), cen, top: n[1] === 1 };
    });
    return { kind: 'box', c, faces, color, top: o.top, ink: o.ink !== false, stroke: o.stroke || 0.45, emit: o.emit, key: o.key ?? c[2] };
  }

  function drawBox(b) {
    for (const f of b.faces) {
      if (!cam.facing(f.cen, f.n)) continue;
      const poly = screenPoly(f.pts);
      if (!poly) continue;
      const base = f.top && b.top ? b.top : b.color;
      trace(poly);
      ctx.fillStyle = b.emit ? rgba(base) : rgba(shade(base, f.cen, f.n));
      ctx.fill();
      if (b.ink) {
        ctx.lineWidth = lw(f.cen, b.stroke);
        ctx.strokeStyle = strokeCol;
        ctx.stroke();
      }
    }
  }

  function ringPoints(xf, r, y, segs) {
    const out = [];
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * TAU;
      out.push(xf([r * Math.sin(a), y, r * Math.cos(a)]));
    }
    return out;
  }

  function latheHull(xf, profile, segs) {
    const pts = [];
    for (const [r, y] of profile) {
      for (const p of ringPoints(xf, r, y, segs)) {
        const q = cam.P(p);
        if (!q) return null;
        pts.push(q);
      }
    }
    return hull(pts);
  }

  function hullGradient(h, cols) {
    let minX = Infinity, maxX = -Infinity, yAt = 0;
    for (const q of h) { if (q[0] < minX) { minX = q[0]; yAt = q[1]; } if (q[0] > maxX) maxX = q[0]; }
    const g = ctx.createLinearGradient(minX, yAt, maxX, yAt);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    return g;
  }

  function makeCyl(base, r, h, color, o = {}) {
    return { kind: 'cyl', base, r, r2: o.r2 ?? r, h, color, top: o.top || color, emit: o.emit, stroke: o.stroke || 0.4, key: o.key ?? base[2], noTop: o.noTop };
  }

  function drawCyl(c) {
    const xf = (q) => add(c.base, q);
    const prof = [[c.r, 0], [c.r2, c.h]];
    const h = latheHull(xf, prof, 28);
    if (!h) return;
    const mid = add(c.base, [0, c.h / 2, 0]);
    const side = sub(cam.eye, mid);
    side[1] = 0;
    const nC = norm(side);
    const nL = norm(sub(nC, mul(cam.r, 1.2)));
    const nR = norm(add(nC, mul(cam.r, 1.2)));
    trace(h);
    if (c.emit) ctx.fillStyle = rgba(c.color);
    else ctx.fillStyle = hullGradient(h, [rgba(shade(c.color, mid, nL)), rgba(shade(c.color, mid, nC)), rgba(shade(c.color, mid, nR))]);
    ctx.fill();
    ctx.lineWidth = lw(mid, c.stroke);
    ctx.strokeStyle = strokeCol;
    ctx.stroke();
    const topP = add(c.base, [0, c.h, 0]);
    if (!c.noTop && cam.eye[1] > topP[1]) {
      const ring = screenPoly(ringPoints(xf, c.r2, c.h, 28));
      if (ring) {
        trace(ring);
        ctx.fillStyle = c.emit ? rgba(c.top) : rgba(shade(c.top, topP, [0, 1, 0]));
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function makeGroup(parts, key) {
    return { kind: 'group', parts, key };
  }

  function drawAny(o) {
    if (o.kind === 'box') drawBox(o);
    else if (o.kind === 'cyl') drawCyl(o);
    else if (o.kind === 'group') {
      const sorted = o.parts.slice().sort((a, b) => depthOf(b) - depthOf(a));
      for (const p of sorted) drawAny(p);
    } else if (o.draw) o.draw();
  }

  function depthOf(o) {
    const c = o.kind === 'cyl' ? add(o.base, [0, o.h / 2, 0]) : o.c || o.anchor || [0, 0, 0];
    return cam.toCam(c)[2];
  }

  const JW = 17;
  const PLANKS = [120, 160];
  const tokenKinds = (n, s) => Array.from({ length: n }, (_, i) => ['ig', 'tt', 'yt', 'p0', 'p1', 'p2', 'p3', 'p4', 'ig', 'yt'][(i * 7 + s) % 10]);

  const jars = [
    { name: 'Recettes', emoji: '🍝', lid: 'soleil', x: -32, plank: 1, tokens: tokenKinds(9, 1) },
    { name: 'Restos', emoji: '🍜', lid: 'tomate', x: 0, plank: 1, target: true, tokens: ['pizza', 'pancakes', 'wine', 'banhmi', 'tacos', 'icecream', 'bao'] },
    { name: 'Week-end', emoji: '✈️', lid: 'ciel', x: 32, plank: 1, tokens: tokenKinds(5, 4) },
    { name: 'Séries', emoji: '🎬', lid: 'lavande', x: -30, plank: 0, tokens: tokenKinds(6, 2) },
    { name: 'Déco', emoji: '🛋️', lid: 'sauge', x: 2, plank: 0, tokens: tokenKinds(4, 6) },
    { name: 'Cadeaux', emoji: '🎁', lid: 'rose', x: 32, plank: 0, tokens: tokenKinds(3, 3) },
  ].map((j) => {
    const w = JW;
    const slots = [];
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      slots.push({
        lx: (col - 1) * 0.255 * w + rr(-0.02, 0.02) * w,
        ly: 0.07 * w + 0.1175 * w + row * 0.25 * w,
        lz: (col === 1 ? -0.09 : 0.07) * w + rr(-0.03, 0.03) * w,
        rot: rr(-12, 12) * DEG,
      });
    }
    return {
      ...j, w, y: PLANKS[j.plank], z: 12, dx: 0, dy: 0, dz: 0, spin: 0, squash: 0,
      lidS: { lift: 0, twist: 0, tiltX: 0, tiltZ: 0, off: [0, 0, 0], gone: false },
      slots, key: 12.5, extra: null,
    };
  });
  const target = jars.find((j) => j.target);

  function jarProfile(w) {
    const R = w / 2, gh = 1.32 * w, rb = 0.3 * w, rt = 0.25 * w, out = [];
    for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2); out.push([R - rb + rb * Math.cos(a), rb + rb * Math.sin(a)]); }
    for (let i = 0; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); out.push([R - rt + rt * Math.cos(a), gh - rt + rt * Math.sin(a)]); }
    out.push([0.26 * w, gh + 0.035 * w]);
    return out;
  }

  function drawToken(kind, x, y, size, rot, lineW) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const h = size / 2, r = size * 0.28;
    roundRect(-h, -h, size, size, r);
    const img = dishes[kind];
    if (img) {
      ctx.fillStyle = '#F9DDD5';
      ctx.fill();
      if (ready(img)) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(img, -h, -h, size, size);
        ctx.restore();
      }
    } else if (kind === 'ig') {
      const g = ctx.createLinearGradient(-h, h, h, -h);
      g.addColorStop(0, '#F9A825'); g.addColorStop(0.5, '#E1306C'); g.addColorStop(1, '#7B3FE4');
      ctx.fillStyle = g; ctx.fill();
      if (size > 22) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = size * 0.07; roundRect(-h * 0.5, -h * 0.5, h, h, h * 0.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.22, 0, TAU); ctx.stroke(); }
    } else if (kind === 'tt') {
      ctx.fillStyle = '#111'; ctx.fill();
      if (size > 22) { ctx.fillStyle = '#fff'; ctx.font = `800 ${size * 0.32}px "DM Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TT', 0, size * 0.02); }
    } else if (kind === 'yt') {
      ctx.fillStyle = '#E62117'; ctx.fill();
      if (size > 18) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-h * 0.25, -h * 0.32); ctx.lineTo(h * 0.38, 0); ctx.lineTo(-h * 0.25, h * 0.32); ctx.closePath(); ctx.fill(); }
    } else {
      const c = PASTELS[+kind.slice(1)] || PASTELS[0];
      ctx.fillStyle = rgba(c); ctx.fill();
    }
    roundRect(-h, -h, size, size, r);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = 'rgba(43,29,18,.6)';
    ctx.stroke();
    ctx.restore();
  }

  function jarXf(j) {
    const base = [j.x + j.dx, j.y + j.dy, j.z + j.dz];
    const sq = j.squash;
    return { base, xf: (q) => add(base, [q[0] * (1 + sq * 0.08), q[1] * (1 - sq * 0.08), q[2] * (1 + sq * 0.08)]) };
  }

  function drawJar(j) {
    const w = j.w, R = w / 2, gh = 1.32 * w;
    const { base, xf } = jarXf(j);
    const h = latheHull(xf, jarProfile(w), 30);
    if (!h) return;
    const center = add(base, [0, gh * 0.55, 0]);
    const s = cam.scale(center);
    const dark = Math.max(darkness(center), j.dim || 0);

    trace(h);
    ctx.fillStyle = 'rgba(214,232,228,0.10)';
    ctx.fill();

    ctx.save();
    trace(h);
    ctx.clip();
    const toks = [];
    j.tokens.forEach((kind, i) => {
      const sl = j.slots[i];
      if (!sl) return;
      const local = rotY([sl.lx, sl.ly + (j.jiggle ? j.jiggle(i) : 0), sl.lz], j.spin);
      toks.push({ kind, p: xf(local), rot: sl.rot });
    });
    if (j.extra && j.extra.inside) toks.push(j.extra);
    for (const t of toks) t.d = cam.toCam(t.p)[2];
    toks.sort((a, b) => b.d - a.d);
    for (const t of toks) {
      const q = cam.P(t.p);
      if (!q) continue;
      drawToken(t.kind, q[0], q[1], 0.235 * w * q[2], t.rot, Math.max(0.5, 0.017 * w * q[2]));
    }
    trace(h);
    ctx.fillStyle = `rgba(16,10,6,${dark})`;
    ctx.fill();
    if (j.glow > 0) {
      const g0 = cam.P(add(base, [0, gh * 0.6, 0]));
      if (g0) {
        ctx.globalCompositeOperation = 'lighter';
        glow(g0[0], g0[1], w * s * (0.8 + j.glow * 0.5), 'jarglow', [255, 205, 120], j.glow * 0.95, 0.6);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();

    trace(h);
    ctx.fillStyle = hullGradient(h, ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.13)']);
    ctx.fill();

    const view = Math.atan2(cam.eye[0] - base[0], cam.eye[2] - base[2]);
    const hi = (az, y0, y1, width, alpha) => {
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const y = lerp(y0, y1, k / 6);
        const q = cam.P(xf([R * 0.985 * Math.sin(az), y, R * 0.985 * Math.cos(az)]));
        if (!q) return;
        pts.push(q);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const q of pts) ctx.lineTo(q[0], q[1]);
      ctx.lineCap = 'round';
      ctx.lineWidth = width * w * s;
      ctx.strokeStyle = `rgba(255,250,240,${alpha})`;
      ctx.stroke();
    };
    const near = 1 - smooth(seg(S.p, 0.68, 0.78));
    hi(view - 0.78, gh * 0.4, gh * 0.74, 0.07, (0.62 - dark * 0.35) * near);
    hi(view + 0.95, gh * 0.22, gh * 0.4, 0.035, 0.22 * near);

    const lidOff = j.lidS.lift > 0.05 * w || j.lidS.gone;
    if (lidOff) {
      const mouth = screenPoly(ringPoints(xf, 0.26 * w, gh + 0.035 * w, 30));
      if (mouth) {
        trace(mouth);
        ctx.fillStyle = `rgba(28,18,10,${0.35 * (1 - j.glow)})`;
        ctx.fill();
        if (j.glow > 0) {
          ctx.fillStyle = `rgba(255,226,160,${j.glow * 0.22})`;
          ctx.fill();
          const mc = cam.P(xf([0, gh + 0.035 * w, 0]));
          if (mc) {
            ctx.save();
            trace(mouth);
            ctx.clip();
            ctx.globalCompositeOperation = 'lighter';
            glow(mc[0], mc[1], 0.3 * w * mc[2] * 1.3, 'mouthglow', [255, 200, 120], j.glow * 0.7, 0.7);
            ctx.restore();
          }
        }
        ctx.lineWidth = Math.max(0.6, 0.03 * w * s);
        ctx.strokeStyle = strokeCol;
        ctx.stroke();
      }
    }

    trace(h);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.7, 0.036 * w * s);
    ctx.strokeStyle = strokeCol;
    ctx.stroke();
    ctx.lineWidth = Math.max(0.4, 0.01 * w * s);
    ctx.strokeStyle = 'rgba(255,236,210,0.22)';
    ctx.stroke();

    drawLabel(j, base, xf, s, dark);
    if (j.extra && !j.extra.inside) {
      const q = cam.P(j.extra.p);
      if (q) drawToken(j.extra.kind, q[0], q[1], 0.235 * w * q[2], j.extra.rot, Math.max(0.5, 0.017 * w * q[2]));
    }
    if (!j.lidS.gone) drawLid(j, base, dark);
  }

  function drawLabel(j, base, xf, s, dark) {
    const w = j.w, R = w / 2, gh = 1.32 * w;
    const n = rotY([0, 0, 1], j.spin);
    const p0 = xf(add(rotY([0, gh * 0.6, 0], j.spin), mul(n, R * 1.02)));
    const vis = dot(n, norm(sub(cam.eye, p0)));
    if (vis < 0.08) return;
    const unit = w / 100;
    const q0 = cam.P(p0);
    const t = rotY([1, 0, 0], j.spin);
    const qa = cam.P(add(p0, mul(t, unit)));
    const qb = cam.P(add(p0, [0, -unit, 0]));
    if (!q0 || !qa || !qb) return;
    ctx.save();
    ctx.setTransform(dpr * (qa[0] - q0[0]), dpr * (qa[1] - q0[1]), dpr * (qb[0] - q0[0]), dpr * (qb[1] - q0[1]), dpr * q0[0], dpr * q0[1]);
    ctx.rotate(-3 * DEG);
    ctx.globalAlpha = clamp01((vis - 0.08) * 4);
    const label = `${j.name} ${j.emoji}`;
    ctx.font = '800 13.5px "DM Sans", sans-serif';
    const tw = Math.min(104, ctx.measureText(label).width);
    const bw = tw + 13, bh = 19;
    roundRect(-bw / 2, -bh / 2, bw, bh, 6);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = strokeCol;
    ctx.stroke();
    ctx.fillStyle = rgba(COL.ink);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1, 104);
    roundRect(-bw / 2, -bh / 2, bw, bh, 6);
    ctx.fillStyle = `rgba(16,10,6,${dark})`;
    ctx.fill();
    ctx.restore();
  }

  function drawLid(j, base, dark) {
    const w = j.w, L = j.lidS;
    const lr = 0.375 * w, lh = 0.17 * w, b = 0.028 * w;
    const pivot = add(base, [L.off[0], 1.29 * w + L.lift + L.off[1], L.off[2]]);
    const sq = j.squash;
    const xf = (q) => add(pivot, rotZ(rotX(rotY([q[0] * (1 + sq * 0.1), q[1] * (1 - sq * 0.15), q[2] * (1 + sq * 0.1)], L.twist), L.tiltX), L.tiltZ));
    const dirOnly = (q) => rotZ(rotX(rotY(q, L.twist), L.tiltX), L.tiltZ);
    const prof = [[lr - b, 0], [lr, b], [lr, lh - b], [lr - b, lh]];
    const h = latheHull(xf, prof, 32);
    if (!h) return;
    const c = xf([0, lh / 2, 0]);
    const s = cam.scale(c);
    const col = LIDS[j.lid];
    const side = sub(cam.eye, c);
    const nC = norm(side);
    const nL = norm(sub(nC, mul(cam.r, 1.3)));
    const nR = norm(add(nC, mul(cam.r, 1.3)));
    trace(h);
    ctx.fillStyle = hullGradient(h, [rgba(shade(col, c, nL)), rgba(shade(cmix(col, [255, 255, 255], 0.12), c, nC)), rgba(shade(col, c, nR))]);
    ctx.fill();
    ctx.lineWidth = Math.max(0.4, 0.012 * w * s);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(26,17,10,0.3)';
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU;
      const nl = dirOnly([Math.sin(a), 0, Math.cos(a)]);
      const p1 = xf([lr * Math.sin(a), lh * 0.22, lr * Math.cos(a)]);
      if (!cam.facing(p1, nl)) continue;
      const sg = screenSeg(p1, xf([lr * Math.sin(a), lh * 0.78, lr * Math.cos(a)]));
      if (!sg) continue;
      ctx.beginPath();
      ctx.moveTo(sg[0][0], sg[0][1]);
      ctx.lineTo(sg[1][0], sg[1][1]);
      ctx.stroke();
    }
    const nTop = dirOnly([0, 1, 0]);
    const topC = xf([0, lh, 0]);
    let top = null;
    if (cam.facing(topC, nTop)) {
      top = screenPoly(ringPoints(xf, lr - b, lh, 32));
      if (top) {
        trace(top);
        ctx.fillStyle = rgba(shade(cmix(col, [255, 255, 255], 0.22), topC, nTop));
        ctx.fill();
      }
    }
    trace(h);
    ctx.fillStyle = `rgba(16,10,6,${dark * 0.85})`;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.6, 0.032 * w * s);
    ctx.strokeStyle = strokeCol;
    ctx.stroke();
    if (top) {
      trace(top);
      ctx.lineWidth = Math.max(0.5, 0.022 * w * s);
      ctx.stroke();
    }
  }

  const objects = [];

  function addStatic() {
    for (const y of PLANKS) {
      objects.push(makeBox([0, y - 2, 12], [140, 4, 24], COL.wood, { top: hex('#D59C63'), key: 12, stroke: 0.4 }));
      for (const x of [-52, 52]) {
        objects.push(makeBox([x, y - 11, 1.2], [3, 14, 2.4], COL.metal, { key: 1 }));
        objects.push(makeBox([x, y - 5.5, 10], [3, 3, 18], COL.metal, { key: 5 }));
      }
    }
    objects.push(makeBox([0, 46, 0.8], [840, 1.5, 1.6], hex('#4A3424'), { key: 0.5, stroke: 0.3 }));
    objects.push(makeBox([0, 92, 1.2], [840, 2.5, 2.4], hex('#4E3726'), { key: 0.6, stroke: 0.3 }));
    objects.push(makeBox([0, 5, 1.4], [840, 10, 2.8], hex('#2E2016'), { key: 0.7, stroke: 0.3 }));

    const books = [[50.5, 4, 22, '#9B7FD9'], [55, 4.5, 19, '#6FA36B'], [59.6, 4.2, 23.5, '#E8DCC8'], [64, 3.6, 18, '#E0533D']];
    for (const [x, t, h, c] of books) objects.push(makeBox([x, 160 + h / 2, 12], [t, h, 15], hex(c), { key: 12.4, stroke: 0.35, top: hex('#F3E9D8') }));
    objects.push(makeCyl([-57, 120, 12], 5.5, 7.5, hex('#B5523A'), { r2: 6.4, key: 12.4, top: hex('#3A2A1A') }));
    objects.push({ kind: 'custom', key: 12.6, anchor: [-57, 130, 12], draw: drawSucculent });

    objects.push({ kind: 'custom', key: 0.9, anchor: [-108, 181, 1], draw: drawPoster });
    objects.push({ kind: 'custom', key: 0.95, anchor: [-200, 164, 1], draw: drawWindow });
    objects.push({ kind: 'custom', key: 8, anchor: [-258, 140, 8], draw: drawCurtain });
    objects.push({ kind: 'custom', key: 4, anchor: [0, 190, 4], draw: drawFairy });

    objects.push(makeGroup([
      makeCyl([112, 0, 70], 15, 2.4, COL.metal, { stroke: 0.35 }),
      makeCyl([112, 2.4, 70], 1.2, 144, COL.brass, { stroke: 0.3, noTop: true }),
    ], 70));
    objects.push({ kind: 'custom', key: 70.5, anchor: [112, 160, 70], draw: drawShade });

    const chair = (lc, ls, col, extra = {}) => {
      const yaw = -0.62;
      const C = [-124, 0, 206];
      return makeBox(add(C, rotY(lc, yaw)), ls, col, { yaw: yaw + (extra.yaw || 0), stroke: 0.6, top: extra.top });
    };
    const red = hex('#C2412D');
    objects.push(makeGroup([
      chair([0, 15, 0], [86, 24, 78], hex('#A8382A')),
      chair([0, 31, -6], [62, 10, 62], red, { top: hex('#D24A35') }),
      chair([0, 56, 32], [86, 66, 18], red, { top: hex('#D24A35') }),
      chair([-38, 39, 0], [12, 24, 78], red, { top: hex('#D24A35') }),
      chair([38, 39, 0], [12, 24, 78], red, { top: hex('#D24A35') }),
      chair([-8, 50, 19], [32, 26, 8], COL.sticker, { yaw: 0.2 }),
      chair([-36, 2, -32], [5, 4, 5], COL.metal),
      chair([36, 2, -32], [5, 4, 5], COL.metal),
    ], 214));

    objects.push(makeGroup([
      makeCyl([66, 0, 100], 13, 2, COL.metal, { stroke: 0.35 }),
      makeCyl([66, 2, 100], 2.2, 52, COL.woodDark, { stroke: 0.3, noTop: true }),
      makeCyl([66, 54, 100], 23, 3.5, COL.wood, { top: hex('#D59C63'), stroke: 0.4 }),
    ], 100));
    objects.push({ kind: 'custom', key: 101, anchor: [64, 58, 97], draw: drawPhone });
    objects.push(makeCyl([79, 57.5, 106], 4.4, 9.5, hex('#F3E9D8'), { key: 101.5, top: hex('#4A2B17'), stroke: 0.35 }));
    objects.push({ kind: 'custom', key: 102, anchor: [79, 70, 106], draw: drawSteam });

    objects.push(makeCyl([-196, 0, 118], 15, 30, hex('#B5523A'), { r2: 18, key: 118, top: hex('#2A1C12') }));
    objects.push({ kind: 'custom', key: 119, anchor: [-196, 70, 118], draw: drawPlant });
  }

  addStatic();

  const plantLeaves = [];
  {
    seed = 41;
    for (let i = 0; i < 11; i++) {
      const a = rr(0, TAU), tilt = rr(0.25, 0.95), length = rr(42, 78);
      plantLeaves.push({ a, tilt, length, width: rr(16, 26), h0: rr(26, 40), curl: rr(-0.3, 0.3) });
    }
  }

  function leafPoly(root, dir, side, length, width, curl) {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const along = add(root, mul(dir, length * t));
      along[1] -= length * 0.35 * t * t * (1 - curl);
      const wv = Math.sin(Math.PI * Math.pow(t, 0.8)) * width * 0.5;
      pts.push(add(along, mul(side, wv)));
    }
    for (let i = n - 1; i > 0; i--) {
      const t = i / n;
      const along = add(root, mul(dir, length * t));
      along[1] -= length * 0.35 * t * t * (1 - curl);
      const wv = Math.sin(Math.PI * Math.pow(t, 0.8)) * width * 0.5;
      pts.push(sub(along, mul(side, wv)));
    }
    return pts;
  }

  function drawPlant() {
    const base = [-196, 30, 118];
    const leaves = plantLeaves.map((L) => {
      const dir = norm([Math.cos(L.a) * Math.cos(L.tilt), Math.sin(L.tilt), Math.sin(L.a) * Math.cos(L.tilt)]);
      const side = norm([-Math.sin(L.a), 0, Math.cos(L.a)]);
      const root = add(base, [0, L.h0, 0]);
      const tip = add(root, mul(dir, L.length * 0.6));
      return { L, dir, side, root, d: cam.toCam(tip)[2] };
    });
    leaves.sort((a, b) => b.d - a.d);
    for (const { L, dir, side, root } of leaves) {
      const stem = screenSeg(base, root);
      if (stem) {
        ctx.beginPath(); ctx.moveTo(stem[0][0], stem[0][1]); ctx.lineTo(stem[1][0], stem[1][1]);
        ctx.lineWidth = lw(root, 1.2); ctx.strokeStyle = rgba(shade(hex('#3E6B3A'), root, null)); ctx.stroke();
      }
      const poly = screenPoly(leafPoly(root, dir, side, L.length, L.width, L.curl));
      if (!poly) continue;
      const mid = add(root, mul(dir, L.length * 0.5));
      const n = norm([side[1] * dir[2] - side[2] * dir[1], side[2] * dir[0] - side[0] * dir[2], side[0] * dir[1] - side[1] * dir[0]]);
      const nn = cam.facing(mid, n) ? n : mul(n, -1);
      trace(poly);
      ctx.fillStyle = rgba(shade(hex('#5E9A5A'), mid, nn));
      ctx.fill();
      ctx.lineWidth = lw(mid, 0.45);
      ctx.strokeStyle = strokeCol;
      ctx.stroke();
      const vein = screenSeg(root, add(root, mul(dir, L.length * 0.8)));
      if (vein) {
        ctx.beginPath(); ctx.moveTo(vein[0][0], vein[0][1]); ctx.lineTo(vein[1][0], vein[1][1]);
        ctx.lineWidth = lw(mid, 0.3); ctx.strokeStyle = 'rgba(20,12,6,0.35)'; ctx.stroke();
      }
    }
  }

  function drawSucculent() {
    const base = [-57, 127.5, 12];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.4;
      const dir = norm([Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6]);
      const side = norm([-Math.sin(a), 0, Math.cos(a)]);
      const poly = screenPoly(leafPoly(base, dir, side, 8.5, 4.5, 0.9));
      if (!poly) continue;
      const mid = add(base, mul(dir, 4));
      trace(poly);
      ctx.fillStyle = rgba(shade(hex('#7FB07A'), mid, dir));
      ctx.fill();
      ctx.lineWidth = lw(mid, 0.3);
      ctx.strokeStyle = strokeCol;
      ctx.stroke();
    }
  }

  function planeAffine(origin, ax, ay, unit) {
    const q0 = cam.P(origin), qa = cam.P(add(origin, mul(ax, unit))), qb = cam.P(add(origin, mul(ay, unit)));
    if (!q0 || !qa || !qb) return false;
    ctx.setTransform(dpr * (qa[0] - q0[0]), dpr * (qa[1] - q0[1]), dpr * (qb[0] - q0[0]), dpr * (qb[1] - q0[1]), dpr * q0[0], dpr * q0[1]);
    return true;
  }

  function drawPoster() {
    const frame = makeBox([-108, 181, 1.4], [46, 62, 2.8], hex('#1E1510'), { key: 0.9, stroke: 0.3 });
    drawBox(frame);
    const x0 = -127, x1 = -89, y0 = 154, y1 = 208, z = 2.85;
    const poly = screenPoly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
    if (!poly) return;
    const mid = [-108, 181, 3];
    trace(poly);
    ctx.fillStyle = rgba(shade(COL.sticker, mid, [0, 0, 1]));
    ctx.fill();
    ctx.save();
    if (planeAffine([-108, 188, z], [1, 0, 0], [0, -1, 0], 0.09)) {
      const light = lightRGB(mid, [0, 0, 1]);
      const k = Math.min(1, (light[0] + light[1] + light[2]) / 3);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 9;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(mul(COL.ink, Math.max(0.35, k)));
      ctx.fillStyle = rgba(mul([255, 250, 240], k));
      roundRect(-62, -70, 124, 150, 40);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgba(mul(COL.tomato, k));
      roundRect(-48, -104, 96, 32, 8);
      ctx.fill();
      ctx.stroke();
      const tk = [[-30, 52, '#E1306C'], [2, 54, '#FCE8B2'], [-14, 22, '#D6EBD3'], [26, 26, '#4D96D9']];
      ctx.lineWidth = 5;
      for (const [x, y, c] of tk) { ctx.fillStyle = rgba(mul(hex(c), k)); roundRect(x - 13, y - 13, 26, 26, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = rgba(mul(COL.ink, Math.max(0.35, k)));
      ctx.font = '800 44px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('bocal', 0, 140);
    }
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const WIN = { x0: -240, x1: -160, y0: 100, y1: 228 };
  const stars = [];
  const buildings = [];
  {
    seed = 99;
    for (let i = 0; i < 60; i++) stars.push([rr(-3600, -800), rr(500, 2200), -4200, rr(0.4, 1.2), rr(0, TAU)]);
    let x = -1900;
    while (x < -300) {
      const w = rr(90, 210), h = rr(70, 280);
      const lit = [];
      for (let yy = 30; yy < h - 20; yy += 34) for (let xx = 18; xx < w - 18; xx += 30) if (rand() < 0.32) lit.push([xx, yy, rand()]);
      buildings.push({ x, w, h, lit, d: rr(-1100, -800) });
      x += w + rr(-20, 30);
    }
  }

  function drawWindow() {
    const { x0, x1, y0, y1 } = WIN;
    const hole = screenPoly([[x0, y0, 0.05], [x1, y0, 0.05], [x1, y1, 0.05], [x0, y1, 0.05]]);
    if (hole) {
      ctx.save();
      trace(hole);
      ctx.clip();
      const top = cam.P([-1500, 1400, -3000]), bot = cam.P([-1500, 0, -3000]);
      const g = ctx.createLinearGradient(0, top ? top[1] : 0, 0, bot ? bot[1] : H);
      g.addColorStop(0, '#0B1226');
      g.addColorStop(0.6, '#1A2847');
      g.addColorStop(1, '#3A3F5C');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const [x, y, z, sz, ph] of stars) {
        const q = cam.P([x, y, z]);
        if (!q) continue;
        const a = 0.45 + 0.4 * Math.sin(S.t * 1.3 + ph);
        ctx.fillStyle = `rgba(255,248,230,${a})`;
        ctx.beginPath();
        ctx.arc(q[0], q[1], Math.max(0.6, sz * q[2] * 3), 0, TAU);
        ctx.fill();
      }
      const moon = cam.P([-2300, 1500, -4000]);
      if (moon) {
        const r = 70 * moon[2];
        ctx.globalCompositeOperation = 'lighter';
        glow(moon[0], moon[1], r * 5, 'moon', [150, 170, 230], 0.35, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#F6EED8';
        ctx.beginPath(); ctx.arc(moon[0], moon[1], r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(200,190,160,0.5)';
        ctx.beginPath(); ctx.arc(moon[0] - r * 0.3, moon[1] - r * 0.15, r * 0.22, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(moon[0] + r * 0.25, moon[1] + r * 0.3, r * 0.14, 0, TAU); ctx.fill();
      }
      for (const b of buildings) {
        const poly = screenPoly([[b.x, -400, b.d], [b.x + b.w, -400, b.d], [b.x + b.w, b.h, b.d], [b.x, b.h, b.d]]);
        if (!poly) continue;
        trace(poly);
        ctx.fillStyle = '#0A0E1C';
        ctx.fill();
        for (const [xx, yy, ph] of b.lit) {
          const on = Math.sin(S.t * 0.2 + ph * 40) > -0.85;
          if (!on) continue;
          const q = cam.P([b.x + xx, b.h - yy, b.d]);
          if (!q) continue;
          const sz = 9 * q[2];
          ctx.fillStyle = ph > 0.7 ? 'rgba(160,200,255,0.55)' : 'rgba(242,193,78,0.75)';
          ctx.fillRect(q[0] - sz / 2, q[1] - sz * 0.6, sz, sz * 1.2);
        }
      }
      ctx.restore();
    }
    const cream = hex('#CDBFA6');
    const parts = [
      makeBox([-200, 231, 3], [92, 6, 6], cream), makeBox([-200, 97.5, 5], [98, 5, 10], cream, { top: hex('#DCCFB8') }),
      makeBox([-242, 164, 3], [6, 136, 6], cream), makeBox([-158, 164, 3], [6, 136, 6], cream),
      makeBox([-200, 164, 3], [3.5, 128, 4], cream), makeBox([-200, 170, 3], [80, 3.5, 4], cream),
    ];
    for (const p of parts) drawBox(p);
  }

  function drawCurtain() {
    const x0 = -274, x1 = -244, y0 = 30, y1 = 246, n = 8;
    const col = hex('#5B8F57');
    for (let i = 0; i < n; i++) {
      const xa = lerp(x0, x1, i / n), xb = lerp(x0, x1, (i + 1) / n);
      const za = 9 + 4 * Math.sin(i * 1.7), zb = 9 + 4 * Math.sin((i + 1) * 1.7);
      const poly = screenPoly([[xa, y0 + (i % 2) * 2, za], [xb, y0 + ((i + 1) % 2) * 2, zb], [xb, y1, zb], [xa, y1, za]]);
      if (!poly) continue;
      const nx = (za - zb) / (xb - xa);
      const nrm = norm([nx, 0, 1]);
      const mid = [(xa + xb) / 2, 140, (za + zb) / 2];
      trace(poly);
      ctx.fillStyle = rgba(shade(col, mid, nrm));
      ctx.fill();
    }
    const outline = screenPoly([[x0, y0, 9], [x1, y0, 9], [x1, y1, 9], [x0, y1, 9]]);
    if (outline) { trace(outline); ctx.lineWidth = lw([-258, 140, 9], 0.45); ctx.strokeStyle = strokeCol; ctx.stroke(); }
    drawBox(makeBox([-225, 250, 7], [110, 2.5, 2.5], COL.metal, { stroke: 0.3 }));
  }

  const FAIRY = { x0: -86, x1: 86, y: 198, sag: 15, n: 15 };
  function fairyPoint(t) { return [lerp(FAIRY.x0, FAIRY.x1, t), FAIRY.y - FAIRY.sag * 4 * t * (1 - t), 5]; }

  function drawFairy() {
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= 40; i++) {
      const q = cam.P(fairyPoint(i / 40));
      if (!q) continue;
      if (first) { ctx.moveTo(q[0], q[1]); first = false; } else ctx.lineTo(q[0], q[1]);
    }
    ctx.lineWidth = lw([0, 190, 5], 0.25);
    ctx.strokeStyle = 'rgba(12,8,4,0.9)';
    ctx.stroke();
    for (let i = 0; i < FAIRY.n; i++) {
      const p = fairyPoint((i + 0.5) / FAIRY.n);
      p[1] -= 1.6;
      const q = cam.P(p);
      if (!q) continue;
      const tw = 0.75 + 0.25 * Math.sin(S.t * (1.4 + (i % 4) * 0.3) + i * 2.1);
      ctx.fillStyle = `rgba(255,${200 + 30 * tw},${140 + 40 * tw},1)`;
      ctx.beginPath();
      ctx.ellipse(q[0], q[1], 0.9 * q[2], 1.3 * q[2], 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawFairyGlow() {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < FAIRY.n; i++) {
      const p = fairyPoint((i + 0.5) / FAIRY.n);
      const q = cam.P(p);
      if (!q) continue;
      const tw = 0.75 + 0.25 * Math.sin(S.t * (1.4 + (i % 4) * 0.3) + i * 2.1);
      glow(q[0], q[1], 9 * q[2], 'bulb', [255, 190, 110], 0.55 * tw, 0.5);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawShade() {
    const base = [112, 146, 70];
    const xf = (q) => add(base, q);
    const h = latheHull(xf, [[25, 0], [16, 30]], 32);
    if (!h) return;
    trace(h);
    const g = hullGradient(h, ['#F6DDA6', '#FFF1CE', '#F2CF8A']);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw(add(base, [0, 15, 0]), 0.4);
    ctx.strokeStyle = strokeCol;
    ctx.stroke();
    if (cam.eye[1] < base[1]) {
      const ring = screenPoly(ringPoints(xf, 25, 0, 32));
      if (ring) { trace(ring); ctx.fillStyle = '#FFE7AE'; ctx.fill(); ctx.stroke(); }
    }
  }

  function drawPhone() {
    const yaw = 0.42;
    const c = [64, 58.05, 97];
    drawBox(makeBox(c, [7.4, 0.9, 15.2], COL.metal, { yaw, stroke: 0.25 }));
    const hx = 3.1, hz = 6.9, y = 58.52;
    const corners = [[-hx, y, -hz], [hx, y, -hz], [hx, y, hz], [-hx, y, hz]].map((q) => add([c[0], 0, c[2]], rotY(q, yaw)));
    const poly = screenPoly(corners);
    if (!poly) return;
    trace(poly);
    const k = 0.15 + S.phone * 0.85;
    ctx.fillStyle = rgba(cmix([18, 18, 22], [235, 228, 214], k));
    ctx.fill();
  }

  function drawSteam() {
    const base = [79, 68, 106];
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = S.t * 0.6 + i * 2.1;
      ctx.beginPath();
      let first = true;
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const p = add(base, [Math.sin(ph + t * 5) * 1.6 + (i - 1) * 1.4, t * 16, 0]);
        const q = cam.P(p);
        if (!q) continue;
        if (first) { ctx.moveTo(q[0], q[1]); first = false; } else ctx.lineTo(q[0], q[1]);
      }
      ctx.lineWidth = lw(base, 0.5);
      ctx.strokeStyle = `rgba(255,236,210,${0.08 + 0.05 * Math.sin(ph)})`;
      ctx.stroke();
    }
  }

  function drawRoom() {
    ctx.fillStyle = '#120B07';
    ctx.fillRect(0, 0, W, H);

    const wall = screenPoly([[-520, 0, 0], [520, 0, 0], [520, 560, 0], [-520, 560, 0]]);
    if (wall) {
      ctx.save();
      trace(wall);
      ctx.clip();
      ctx.fillStyle = rgba(COL.wall);
      ctx.fillRect(0, 0, W, H);
      const low = screenPoly([[-520, 0, 0.02], [520, 0, 0.02], [520, 92, 0.02], [-520, 92, 0.02]]);
      if (low) { trace(low); ctx.fillStyle = rgba(COL.wallLow); ctx.fill(); }
      for (let x = -470; x <= 470; x += 26) {
        const sg = screenSeg([x, 6, 0.03], [x, 90, 0.03]);
        if (!sg) continue;
        ctx.beginPath(); ctx.moveTo(sg[0][0], sg[0][1]); ctx.lineTo(sg[1][0], sg[1][1]);
        ctx.lineWidth = lw([x, 50, 0], 0.35); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      const pool = (p, rcm, rgb, a, soft) => { const q = cam.P(p); if (q) glow(q[0], q[1], rcm * q[2], 'pool' + rgb.join(), rgb, a, soft); };
      pool([112, 168, 0], 240, [170, 96, 40], 0.85, 0.7);
      pool([112, 168, 0], 80, [255, 170, 80], 0.32, 0.6);
      pool([0, 182, 0], 130, [150, 88, 38], 0.6, 0.8);
      pool([-200, 165, 0], 150, [44, 60, 104], 0.5, 0.8);
      if (S.glow > 0 && S.mouth) pool([S.mouth[0], S.mouth[1], 0], 70 + 110 * S.glow, [150, 110, 60], S.glow * 0.8, 0.75);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    const floor = screenPoly([[-520, 0, 0], [520, 0, 0], [520, 0, 900], [-520, 0, 900]]);
    if (floor) {
      ctx.save();
      trace(floor);
      ctx.clip();
      ctx.fillStyle = rgba(COL.floor);
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let x = -470; x <= 470; x += 15) {
        const sg = screenSeg([x, 0, 0], [x, 0, 800]);
        if (!sg) continue;
        ctx.beginPath(); ctx.moveTo(sg[0][0], sg[0][1]); ctx.lineTo(sg[1][0], sg[1][1]);
        ctx.lineWidth = Math.max(0.5, lw([x, 0, 150], 0.3)); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      const fp = cam.P([112, 0, 90]);
      if (fp) glow(fp[0], fp[1], 160 * fp[2], 'floorpool', [140, 82, 34], 0.7, 0.75);
      const moon = screenPoly([[-236, 0.1, 30], [-164, 0.1, 30], [-98, 0.1, 170], [-170, 0.1, 170]]);
      if (moon) { trace(moon); ctx.fillStyle = 'rgba(70,86,130,0.12)'; ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
      const rug = [];
      for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU; rug.push([Math.cos(a) * 118, 0.3, 140 + Math.sin(a) * 52]); }
      const rp = screenPoly(rug);
      if (rp) {
        trace(rp);
        ctx.fillStyle = rgba(shade(hex('#8C5A33'), [0, 0, 140], [0, 1, 0]));
        ctx.fill();
        ctx.lineWidth = lw([0, 0, 150], 0.5);
        ctx.strokeStyle = strokeCol;
        ctx.stroke();
        const inner = screenPoly(rug.map((q) => [q[0] * 0.84, 0.35, 140 + (q[2] - 140) * 0.8]));
        if (inner) {
          trace(inner);
          ctx.lineWidth = lw([0, 0, 150], 2.2);
          ctx.strokeStyle = rgba(shade(COL.sticker, [0, 0, 150], [0, 1, 0]), 0.5);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const sorted = objects.concat(jars.map((j) => ({ kind: 'jar', jar: j, key: j.key + j.dz }))).sort((a, b) => a.key - b.key);
    for (const o of sorted) {
      if (o.kind === 'jar') drawJar(o.jar);
      else drawAny(o);
    }

    ctx.globalCompositeOperation = 'lighter';
    const shadeC = cam.P([112, 160, 70]);
    if (shadeC) {
      glow(shadeC[0], shadeC[1], 60 * shadeC[2], 'lamp', [255, 190, 110], 0.55, 0.55);
      const under = cam.P([112, 140, 70]);
      if (under) glow(under[0], under[1], 28 * under[2], 'lampcore', [255, 220, 160], 0.6, 0.5);
    }
    drawFairyGlow();
    const ph = cam.P([64, 59, 97]);
    if (ph && S.phone > 0) glow(ph[0], ph[1], 26 * ph[2], 'phone', [180, 200, 255], S.phone * 0.5, 0.6);
    drawDust();
    ctx.globalCompositeOperation = 'source-over';
  }

  const dust = [];
  {
    seed = 3;
    for (let i = 0; i < 110; i++) dust.push([rr(-160, 200), rr(20, 250), rr(20, 240), rr(0, TAU), rr(0.15, 0.5)]);
  }
  function drawDust() {
    for (const d of dust) {
      const p = [d[0] + Math.sin(S.t * 0.13 + d[3]) * 9, ((d[1] + S.t * d[4] * 3) % 240) + 15, d[2] + Math.cos(S.t * 0.11 + d[3]) * 7];
      const q = cam.P(p);
      if (!q) continue;
      const dl = len(sub(p, S.lamp));
      const a = clamp(1.1 - dl / 140, 0, 1) * 0.55 + S.glow * clamp(1 - len(sub(p, S.mouth || p)) / 60, 0, 1) * 0.6;
      if (a < 0.02) continue;
      glow(q[0], q[1], Math.max(1.2, 0.5 * q[2]), 'dust', [255, 215, 160], a, 0.4);
    }
  }

  const CHAT = [
    { who: 'Inès', text: 'On se fait un resto samedi ?' },
    { who: 'Max', text: 'Vous avez une idée ?', me: true },
    { who: 'Léa', text: 'Oui ! Regardez ça' },
    { who: 'Léa', link: true },
    { who: 'Sam', text: 'Trop bien !' },
    { who: 'Noah', text: 'Je ramène le dessert' },
    { who: 'Inès', text: 'Vous avez vu le match ?' },
    { who: 'Sam', text: 'On dit 19 h ?' },
    { who: 'Noah', text: 'Qui a un chargeur ?' },
    { who: 'Inès', text: 'Regardez mon chat' },
    { who: 'Sam', text: 'Je peux plus finalement' },
    { who: 'Léa', text: 'Trop hâte' },
    { who: 'Noah', text: 'Vous avez vu ma story ?' },
    { who: 'Inès', text: 'Qui ramène les chips ?' },
  ];
  const LINK = { title: 'Le ramen caché derrière Flagey', site: 'instagram.com', dish: 'ramen' };
  const CHAT_ANCHOR = [58, 68, 105];
  const CHAT_CM = 0.16;
  const CHAT_T0 = 0.06, CHAT_T1 = 0.215, RESCUE = 0.232, FLY_END = 0.322, DROP_END = 0.338;

  function bubbleSize(m) {
    if (m.link) return [232, 92];
    ctx.font = '600 15px "DM Sans", sans-serif';
    const tw = Math.min(214, ctx.measureText(m.text).width + 26);
    return m.me ? [tw, 36] : [tw + 28, 52];
  }

  function linkRect(p) {
    for (const it of chatLayout(p)) {
      if (!it.m.link) continue;
      return [Math.max(-it.y, -360), it.bw, it.bh];
    }
    return null;
  }

  function chatLayout(p) {
    const items = [];
    const step = (CHAT_T1 - CHAT_T0) / CHAT.length;
    let y = 0;
    for (let i = CHAT.length - 1; i >= 0; i--) {
      const appear = seg(p, CHAT_T0 + i * step, CHAT_T0 + (i + 0.7) * step);
      if (appear <= 0) continue;
      const [bw, bh] = bubbleSize(CHAT[i]);
      const gap = 8;
      const hh = (bh + gap) * outCubic(appear);
      items.push({ i, m: CHAT[i], bw, bh, y: y + bh, appear });
      y += hh;
    }
    return items;
  }

  function chatScale(anchorScale) { return anchorScale * CHAT_CM * uiScale(); }
  function uiScale() { return clamp(560 / Math.min(W, H * 1.2), 1, 1.75); }

  function chatOrigin() {
    const q = cam.P(CHAT_ANCHOR);
    if (!q) return null;
    const k = chatScale(q[2]);
    const width = 300 * k;
    const x = clamp(q[0] - width * 0.12, 14, Math.max(14, W - 14 - width));
    return { x, y: q[1], k, q };
  }

  function drawChat() {
    const p = S.p;
    if (p < CHAT_T0 || p > FLY_END + 0.02) return;
    const o = chatOrigin();
    if (!o) return;
    const k = o.k;
    const fadeAll = 1 - seg(p, RESCUE - 0.012, RESCUE + 0.02);
    const items = chatLayout(p);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(k, k);
    for (const it of items) {
      const top = -it.y;
      const fadeTop = 1 - seg(-top, 300, 420);
      let a = fadeTop * clamp01(it.appear * 2);
      if (it.m.link) {
        if (p > RESCUE - 0.012) continue;
      } else a *= fadeAll;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const sc = 0.85 + 0.15 * outBack(it.appear);
      ctx.save();
      const left = it.m.me ? 300 - it.bw : 0;
      ctx.translate(left + it.bw / 2, top + it.bh / 2);
      ctx.scale(sc, sc);
      ctx.translate(-it.bw / 2, -it.bh / 2);
      drawBubble(it.m, it.bw, it.bh, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBubble(m, bw, bh, highlight) {
    if (m.link) {
      drawLinkCard(bw, bh, highlight, 1);
      return;
    }
    let y = 0;
    if (!m.me) {
      ctx.font = '700 11px "DM Sans", sans-serif';
      ctx.fillStyle = 'rgba(251,243,228,0.7)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(m.who, 30, 11);
      y = 16;
      ctx.fillStyle = rgba(AVATAR[m.who] || COL.sticker);
      ctx.beginPath(); ctx.arc(11, y + 27, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(COL.ink);
      ctx.font = '800 10px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.who[0], 11, y + 27.5);
    }
    const x = m.me ? 0 : 28, w = m.me ? bw : bw - 28;
    roundRect(x, y, w, 36, 16);
    ctx.fillStyle = m.me ? rgba(COL.sticker) : '#FFFFFF';
    ctx.fill();
    ctx.fillStyle = rgba(COL.ink);
    ctx.font = '600 15px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text, x + 13, y + 18.5, w - 24);
  }

  function drawLinkCard(bw, bh, highlight, contentAlpha) {
    ctx.save();
    if (highlight > 0) {
      roundRect(5, 5, bw, bh, 18);
      ctx.fillStyle = rgba(COL.sticker, highlight);
      ctx.fill();
    }
    roundRect(0, 0, bw, bh, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rgba(COL.ink);
    ctx.stroke();
    ctx.globalAlpha *= contentAlpha;
    const img = dishes[LINK.dish];
    const s = bh - 20;
    ctx.save();
    roundRect(10, 10, s, s, 14);
    ctx.clip();
    ctx.fillStyle = '#F9DDD5';
    ctx.fillRect(10, 10, s, s);
    if (ready(img)) ctx.drawImage(img, 10, 10, s, s);
    ctx.restore();
    ctx.fillStyle = rgba(COL.ink);
    ctx.font = '800 15px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const tx = s + 22, tw = bw - tx - 10;
    const words = LINK.title.split(' ');
    let line = '', ly = 30;
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (ctx.measureText(t).width > tw && line) { ctx.fillText(line, tx, ly); line = wd; ly += 18; } else line = t;
    }
    ctx.fillText(line, tx, ly);
    ctx.font = '600 12px "DM Sans", sans-serif';
    ctx.fillStyle = rgba(COL.muted);
    ctx.fillText(`Léa · ${LINK.site}`, tx, ly + 20);
    ctx.restore();
  }

  function flyingLink() {
    const p = S.p;
    target.extra = null;
    if (p < RESCUE - 0.012 || p > DROP_END + 0.05) return null;
    const rect = linkRect(p);
    const o = chatOrigin();
    if (!rect || !o) return null;
    const [ly, bw, bh] = rect;
    const c = CHAT_CM * uiScale();
    const shift = (o.x - o.q[0]) / o.q[2];
    const start = add(CHAT_ANCHOR, add(mul(cam.r, shift + (bw / 2) * c), mul(cam.u, -(ly + bh / 2) * c)));
    const w = target.w, gh = 1.32 * w;
    const { base } = jarXf(target);
    const above = add(base, [0, gh + 9, 0]);
    const slot = target.slots[7];
    const final = add(base, [slot.lx, slot.ly, slot.lz]);
    const u = seg(p, RESCUE, FLY_END);
    const e = inOut(u);
    const ctrl = add(vlerp(start, above, 0.5), [0, 32, 10]);
    const pos = vlerp(vlerp(start, ctrl, e), vlerp(ctrl, above, e), e);
    const morph = smooth(seg(u, 0.35, 0.95));
    if (p >= FLY_END) {
      const d = seg(p, FLY_END, DROP_END);
      const fall = inCubic(d);
      const at = vlerp(above, final, fall);
      target.extra = { kind: 'ramen', p: at, rot: lerp(0.3, slot.rot, d), inside: d > 0.45 };
      return null;
    }
    return { pos, morph, bw, bh, u, alpha: seg(p, RESCUE - 0.012, RESCUE + 0.004) };
  }

  function drawFlying(f) {
    if (!f) return;
    const q = cam.P(f.pos);
    if (!q) return;
    const k = chatScale(q[2]);
    const tokenPx = 0.235 * target.w * q[2];
    const w = lerp(f.bw * k, tokenPx, f.morph), h = lerp(f.bh * k, tokenPx, f.morph);
    ctx.save();
    ctx.globalAlpha = f.alpha;
    ctx.translate(q[0], q[1]);
    ctx.rotate(Math.sin(f.u * Math.PI) * 0.25);
    const sx = w / lerp(f.bw, f.bh, f.morph);
    ctx.scale(sx, sx);
    const bw = lerp(f.bw, f.bh, f.morph), bh = f.bh;
    ctx.translate(-bw / 2, -bh / 2);
    if (f.morph < 0.98) {
      drawLinkCard(bw, bh, 1 - f.morph, 1 - f.morph);
    }
    if (f.morph > 0.2) {
      ctx.globalAlpha = f.alpha * f.morph;
      const img = dishes[LINK.dish];
      roundRect(0, 0, bw, bh, bh * 0.28 + (1 - f.morph) * 6);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#F9DDD5';
      ctx.fillRect(0, 0, bw, bh);
      if (ready(img)) ctx.drawImage(img, (bw - bh) / 2, 0, bh, bh);
      ctx.restore();
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(COL.ink);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    glow(q[0], q[1], Math.max(w, h) * 1.1, 'flyglow', [242, 193, 78], 0.35 * (1 - f.morph * 0.5), 0.5);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBadge() {
    const p = S.p;
    const a = seg(p, 0.03, 0.06) * (1 - seg(p, RESCUE, RESCUE + 0.03));
    if (a <= 0) return;
    const q = cam.P([62, 60, 93]);
    if (!q) return;
    const n = Math.round(lerp(3, 128, smooth(seg(p, CHAT_T0, CHAT_T1))));
    const r = Math.max(9, 2.4 * q[2] * uiScale());
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(q[0] + r * 0.9, q[1] - r * 1.4);
    const pulse = 1 + 0.08 * Math.sin(S.t * 6) * (n < 128 ? 1 : 0.3);
    ctx.scale(pulse, pulse);
    ctx.font = `800 ${r * 1.05}px "DM Sans", sans-serif`;
    const label = String(n);
    const w = Math.max(r * 2, ctx.measureText(label).width + r * 1.1);
    roundRect(-w / 2, -r, w, 2 * r, r);
    ctx.fillStyle = rgba(COL.tomato);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.strokeStyle = rgba(COL.line);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, r * 0.06);
    ctx.restore();
  }

  const sparks = [];
  {
    seed = 17;
    for (let i = 0; i < 70; i++) sparks.push({ b: rr(0.565, 0.8), a: rr(0, TAU), r: rr(0.2, 1), v: rr(30, 70), life: rr(0.06, 0.13), s: rr(0.5, 1.4), star: rand() < 0.35 });
  }
  function drawSparks() {
    if (!S.mouth || S.p < 0.56) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      const age = (S.p - s.b) / s.life;
      if (age < 0 || age > 1) continue;
      const rad = s.r * target.w * 0.3 * (1 + age * 1.6);
      const p = add(S.mouth, [Math.cos(s.a + age) * rad, age * s.v * 0.45, Math.sin(s.a + age) * rad]);
      const q = cam.P(p);
      if (!q) continue;
      const a = Math.sin(age * Math.PI) * 0.9;
      const r = s.s * 0.55 * q[2];
      if (s.star) {
        ctx.save();
        ctx.translate(q[0], q[1]);
        ctx.rotate(S.t * 2 + s.a);
        ctx.fillStyle = `rgba(255,236,180,${a})`;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) { const rr2 = k % 2 ? r * 0.3 : r * 1.6; const an = (k / 8) * TAU; ctx.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else glow(q[0], q[1], r * 3, 'spark', [255, 214, 140], a, 0.45);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const CARDS = [
    ['ramen', 'Le ramen caché derrière Flagey', 'Léa'], ['pizza', 'La meilleure pizza napolitaine de Gand ?', 'Sam'],
    ['bao', 'Les bao les plus moelleux de Bruxelles', 'toi'], ['mezze', 'Mezze libanais à partager', 'Léa'],
    ['pancakes', 'Brunch XXL du dimanche', 'Inès'], ['sushi', "Sushis : l'adresse qu'on garde pour nous", 'Sam'],
    ['burger', 'Le smash burger dont tout le monde parle', 'Inès'], ['wine', 'Le bar à vins où il faut réserver', 'toi'],
    ['banhmi', 'Bánh mì : 3 adresses testées', 'Noah'], ['tacos', 'Tacos de rue à Saint-Gilles', 'Léa'],
    ['icecream', 'Glaces artisanales : notre top 5', 'Sam'],
  ];
  const inner = [];
  {
    seed = 5;
    CARDS.forEach((c, i) => inner.push({ c, a: (i / CARDS.length) * TAU * 2.2 + rr(-0.3, 0.3), r: rr(70, 150), d: 260 + i * 95, rot: rr(-0.25, 0.25) }));
  }

  function drawInside(q, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, '#FFF8EA');
    g.addColorStop(0.45, '#FBEFD4');
    g.addColorStop(0.8, '#F4D486');
    g.addColorStop(1, '#E8B850');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const f = H / 2 / Math.tan(40 * DEG);
    const travel = q * 1300;
    for (let i = 0; i < 16; i++) {
      const d = ((i * 110 - travel) % 1760 + 1760) % 1760 + 30;
      const r = (230 * f) / d;
      if (r > R * 2.2) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.lineWidth = Math.max(1, (6 * f) / d);
      ctx.strokeStyle = `rgba(255,255,255,${clamp01(0.5 - d / 3600)})`;
      ctx.stroke();
    }
    const items = inner.map((it) => ({ it, d: it.d - travel })).filter((o) => o.d > 25).sort((a, b) => b.d - a.d);
    for (const { it, d } of items) {
      const s = f / d;
      const x = cx + Math.cos(it.a + q * 0.8) * it.r * s * 1.6;
      const y = cy + Math.sin(it.a + q * 0.8) * it.r * s * 1.6;
      const fog = clamp01(1 - (d - 200) / 900);
      ctx.save();
      ctx.globalAlpha = alpha * fog * clamp01((d - 25) / 60);
      ctx.translate(x, y);
      ctx.rotate(it.rot + q * 0.6);
      ctx.scale(s * 0.9, s * 0.9);
      drawMiniCard(it.c);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMiniCard([dish, title, who]) {
    const bw = 250, bh = 78;
    ctx.translate(-bw / 2, -bh / 2);
    roundRect(5, 5, bw, bh, 18);
    ctx.fillStyle = rgba(COL.sticker);
    ctx.fill();
    roundRect(0, 0, bw, bh, 18);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rgba(COL.ink);
    ctx.stroke();
    const s = bh - 18;
    ctx.save();
    roundRect(9, 9, s, s, 13);
    ctx.clip();
    ctx.fillStyle = '#F9DDD5';
    ctx.fillRect(9, 9, s, s);
    if (ready(dishes[dish])) ctx.drawImage(dishes[dish], 9, 9, s, s);
    ctx.restore();
    ctx.fillStyle = rgba(COL.ink);
    ctx.font = '800 14px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const tx = s + 20, tw = bw - tx - 10;
    let line = '', ly = 28, lines = 0;
    for (const wd of title.split(' ')) {
      const t = line ? line + ' ' + wd : wd;
      if (ctx.measureText(t).width > tw && line) { if (lines < 1) { ctx.fillText(line, tx, ly); ly += 17; lines++; line = wd; } else { line += '…'; break; } } else line = t;
    }
    ctx.fillText(line, tx, ly);
    ctx.font = '600 12px "DM Sans", sans-serif';
    ctx.fillStyle = rgba(COL.muted);
    ctx.fillText(who, tx, ly + 19);
  }

  const KEYS = [
    [0.0, [-2, 122, 24, 300, 262, 17, 6, 0.12, 0.03]],
    [0.09, [34, 98, 70, 190, 150, 18, 9, 0.08, 0]],
    [0.2, [40, 100, 80, 170, 136, 14, 10, 0.06, 0]],
    [0.29, [18, 150, 30, 140, 96, 6, 8, 0, 0]],
    [0.37, [0, 172, 14, 84, 62, 2, 8, 0, 0]],
    [0.47, [0, 176, 38, 50, 40, -5, 9, 0, 0]],
    [0.58, [0, 181, 38, 50, 44, -2, 16, 0, 0]],
    [0.7, [0, 184, 38, 38, 32, 0, 56, 0, 0]],
    [0.79, [0, 185, 38, 13, 11, 0, 84, 0, 0]],
    [0.84, [0, 185, 38, 3, 3, 0, 89, 0, 0]],
  ];
  const KEYS_PORTRAIT = [
    [0.0, [-4, 152, 0, 172, 150, 10, 4, 0, -0.19]],
    [0.09, [44, 98, 72, 112, 130, 18, 9, 0, -0.1]],
    [0.2, [48, 100, 82, 100, 120, 14, 10, 0, -0.1]],
    [0.29, [22, 150, 30, 100, 90, 6, 8, 0, -0.04]],
    [0.37, [0, 172, 14, 50, 50, 2, 8, 0, -0.05]],
    [0.47, [0, 176, 38, 30, 34, -5, 9, 0, -0.05]],
    [0.58, [0, 181, 38, 30, 36, -2, 16, 0, -0.04]],
    [0.7, [0, 184, 38, 24, 28, 0, 56, 0, 0]],
    [0.79, [0, 185, 38, 9, 9, 0, 84, 0, 0]],
    [0.84, [0, 185, 38, 2.4, 2.4, 0, 89, 0, 0]],
  ];

  function spline(keys, t) {
    if (t <= keys[0][0]) return keys[0][1].slice();
    const n = keys.length;
    if (t >= keys[n - 1][0]) return keys[n - 1][1].slice();
    let i = 0;
    while (keys[i + 1][0] < t) i++;
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    const h = t1 - t0, s = (t - t0) / h;
    const tan = (k) => {
      if (k <= 0 || k >= n - 1) return keys[k][1].map(() => 0);
      const [ta, va] = keys[k - 1], [tb, vb] = keys[k + 1];
      return va.map((a, j) => (vb[j] - a) / (tb - ta));
    };
    const m0 = tan(i), m1 = tan(i + 1);
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return v0.map((a, j) => h00 * a + h10 * h * m0[j] + h01 * v1[j] + h11 * h * m1[j]);
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  function setCamera(p) {
    const portrait = W / H < 0.85;
    const v = spline(portrait ? KEYS_PORTRAIT : KEYS, p);
    const vfov = 46 * DEG;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (W / H));
    const dist = Math.max(v[3] / 2 / Math.tan(hfov / 2), v[4] / 2 / Math.tan(vfov / 2));
    const calm = 1 - smooth(seg(p, 0.6, 0.78));
    const yaw = (v[5] + pointer.x * 3.2 * calm + Math.sin(S.t * 0.23) * 0.6 * calm) * DEG;
    const pitch = Math.min(89.6, v[6] + pointer.y * 1.6 * calm + Math.sin(S.t * 0.31) * 0.3 * calm) * DEG;
    const T = [v[0], v[1], v[2]];
    const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    cam.set(add(T, mul(dir, dist)), yaw, pitch, vfov, v[7], v[8]);
  }

  function animateJars(p) {
    for (const j of jars) { j.dim = 0; j.glow = 0; j.jiggle = null; }
    const t = target;
    const hop = bump(p, 0.296, 0.31, 0.338, 0.352);
    const land = seg(p, 0.338, 0.36);
    const lift = smooth(seg(p, 0.37, 0.47));
    t.dz = 26 * lift;
    t.dy = 3 * lift + Math.sin(Math.PI * seg(p, 0.37, 0.47)) * 4;
    t.spin = -0.38 * Math.sin(Math.PI * seg(p, 0.38, 0.5));
    t.squash = Math.sin(Math.PI * seg(p, 0.349, 0.37)) * 0.9 * (1 - seg(p, 0.349, 0.37) * 0.3) + Math.sin(Math.PI * seg(p, 0.465, 0.49)) * 0.6;
    const L = t.lidS;
    const twist = inOut(seg(p, 0.5, 0.565));
    const pop = seg(p, 0.565, 0.6);
    const fly = seg(p, 0.598, 0.68);
    L.twist = -twist * TAU * 1.5 - fly * 4;
    L.lift = hop * 7 + twist * 1.2 + outBack(pop, 2.2) * 6 * (1 - fly);
    L.tiltZ = -0.32 * hop + -0.25 * outBack(pop) - 1.6 * inCubic(fly);
    L.tiltX = 0.2 * hop + 0.18 * pop + 0.6 * fly;
    const fe = inCubic(fly);
    L.off = [fe * 70, fe * 55, fe * 34];
    L.gone = fly >= 1;
    t.glow = smooth(seg(p, 0.565, 0.64));
    t.jiggle = (i) => Math.sin(Math.PI * seg(p, 0.566 + (i % 3) * 0.006, 0.6 + (i % 3) * 0.006)) * 1.2 + (land > 0 && land < 1 && i < 3 ? Math.sin(Math.PI * land) * 0.4 : 0);
    const focus = smooth(seg(p, 0.37, 0.46));
    for (const j of jars) if (j !== t) j.dim = focus * 0.55;
    const gh = 1.32 * t.w;
    S.mouth = [t.x + t.dx, t.y + t.dy + gh + 1, t.z + t.dz];
    S.glow = t.glow;
    S.exposure = 1 + t.glow * 0.25;
    S.phone = seg(p, 0.03, 0.07) * (1 - seg(p, 0.26, 0.32)) + 0.12;
  }

  function drawVignette(p) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    const k = 0.62 + 0.2 * smooth(seg(p, 0.37, 0.46)) - 0.4 * S.glow;
    g.addColorStop(0, 'rgba(8,5,3,0)');
    g.addColorStop(1, `rgba(8,5,3,${clamp01(k)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const SOUNDS = [
    [0.3, 'pop'], [0.336, 'poc'], [0.352, 'lid'], [0.515, 'tick'], [0.53, 'tick'], [0.545, 'tick'], [0.56, 'tick'], [0.572, 'pop'], [0.8, 'chime'],
  ];
  let lastSoundP = 0;
  function sounds(p) {
    const audio = window.BocalSound;
    if (audio && p > lastSoundP && p - lastSoundP < 0.04) {
      for (const [at, name] of SOUNDS) if (lastSoundP < at && p >= at) audio.play(name);
    }
    lastSoundP = p;
  }

  function render(p) {
    if (W < 2 || H < 2) return;
    S.p = p;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const inside = smooth(seg(p, 0.815, 0.838));
    if (inside < 1) {
      animateJars(p);
      setCamera(Math.min(p, 0.84));
      LIGHTS = lights();
      const flying = flyingLink();
      drawRoom();
      drawChat();
      drawBadge();
      drawFlying(flying);
      drawSparks();
      drawVignette(p);
    }
    if (inside > 0) drawInside(seg(p, 0.815, 0.95), inside);
    const flash = smooth(seg(p, 0.905, 0.955));
    if (flash > 0) {
      ctx.fillStyle = `rgba(251,243,228,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  const captions = [...document.querySelectorAll('[data-show]')].map((el) => {
    const [a, b] = el.dataset.show.split(',').map(Number);
    return { el, a, b, on: null };
  });
  const root = document.documentElement;

  function updateDom(p) {
    for (const c of captions) {
      const on = p >= c.a && p <= c.b;
      if (on !== c.on) { c.on = on; c.el.classList.toggle('is-on', on); }
    }
    root.style.setProperty('--journey', p.toFixed(4));
    document.body.classList.toggle('in-room', p < 0.9 && journeyVisible);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, rect.width < 700 ? 1.6 : 1.75);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function scrollProgress() {
    const r = journey.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp01(-r.top / total) : 0;
  }

  let journeyVisible = true;
  let current = frozen ?? scrollProgress();
  let lastTime = performance.now();
  let running = false;

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    S.t += dt;
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
    const goal = frozen ?? scrollProgress();
    current += (goal - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(goal - current) < 0.00005) current = goal;
    try {
      render(current);
    } catch (e) {
      if (!frame.failed) console.error(e);
      frame.failed = true;
    }
    updateDom(current);
    sounds(current);
    if (journeyVisible) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  function still() {
    resize();
    S.t = 2;
    render(0);
    updateDom(0);
  }

  new ResizeObserver(() => { resize(); if (!running) render(current); }).observe(canvas);
  new IntersectionObserver((entries) => {
    journeyVisible = entries[0].isIntersecting;
    if (!journeyVisible) document.body.classList.remove('in-room');
    if (journeyVisible && !reduceMotion.matches) start();
  }).observe(journey);

  resize();
  document.fonts.ready.then(() => { if (!running) render(current); });
  for (const img of Object.values(dishes)) img.addEventListener('load', () => { if (!running) render(current); });

  if (reduceMotion.matches) {
    document.documentElement.classList.add('reduce-motion');
    still();
    document.fonts.ready.then(still);
  } else start();

  window.BocalRoom = { setProgress: (p) => { current = p; render(p); updateDom(p); } };
})();
