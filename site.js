(() => {
  'use strict';

  const { t, base: A, screens: SCREENS } = window.BocalI18n;

  const PLAY_URL = null;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const Sound = (() => {
    let ac = null, master = null, noise = null, on = true, unlocked = false;
    function ensure() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.5;
        const comp = ac.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      return true;
    }
    function env(g, t, attack, decay, peak) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function tone(freq, t, vol, decay, drop, dest, type = 'sine', attack = 0.003) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq * drop, t);
      if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq, t + 0.02);
      const g = ac.createGain();
      env(g, t, attack, decay, vol);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + attack + decay + 0.05);
    }
    function click(freq, t, vol, decay, dest) {
      const n = ac.createBufferSource();
      n.buffer = noise;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 1.1;
      const g = ac.createGain();
      env(g, t, 0.001, decay, vol);
      n.connect(bp).connect(g).connect(dest);
      n.start(t);
      n.stop(t + decay + 0.03);
    }
    function wood(freq, t, vol, decay, dest) {
      tone(freq, t, vol, decay, 1.45, dest);
      tone(freq * 2.76, t, vol * 0.18, decay * 0.35, 1, dest);
      click(freq * 3.2, t, vol * 0.16, 0.02, dest);
    }
    function bloop(freq, t, vol, dest) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.78, t);
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.035);
      const g = ac.createGain();
      env(g, t, 0.004, 0.14, vol);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.2);
      tone(freq * 2, t + 0.012, vol * 0.14, 0.06, 1, dest);
    }
    function bell(freq, t, vol, decay, dest) {
      tone(freq, t, vol, decay, 1, dest, 'triangle', 0.004);
      tone(freq * 2.01, t, vol * 0.25, decay * 0.45, 1, dest);
    }
    function output(pan) {
      if (!pan || !ac.createStereoPanner) return master;
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(master);
      return p;
    }
    const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
    const sounds = {
      poc: (t, k, d) => wood(560 * k, t, 0.32, 0.16, d),
      tick: (t, k, d) => wood(1350 * k, t, 0.09, 0.045, d),
      lid: (t, k, d) => { wood(300, t, 0.34, 0.2, d); tone(120, t, 0.18, 0.1, 1.6, d); },
      pop: (t, k, d) => { click(900, t, 0.22, 0.05, d); tone(210, t, 0.2, 0.09, 1.8, d); wood(720 * k, t + 0.035, 0.22, 0.12, d); },
      chime: (t, k, d) => [784, 988, 1175, 1568].forEach((f, i) => wood(f, t + i * 0.085, 0.14, 0.5, d)),
      msg: (t, k, d) => bloop(NOTES[Math.round(k) % NOTES.length], t, 0.13, d),
      msgMe: (t, k, d) => bloop(392, t, 0.12, d),
      msgLink: (t, k, d) => { bell(1046.5, t, 0.1, 0.35, d); bell(1318.5, t + 0.1, 0.1, 0.55, d); },
      sparkle: (t, k, d) => [2093, 2637, 3136, 4186].forEach((f, i) => bell(f, t + i * 0.04, 0.03, 0.45, d)),
      glide: (t, k, d) => [784, 988, 1175].forEach((f, i) => wood(f, t + i * 0.07, 0.09, 0.18, d)),
      clink: (t, k, d) => { tone(2400, t, 0.05, 0.22, 1, d); tone(3620, t, 0.03, 0.16, 1, d); click(5000, t, 0.025, 0.015, d); },
      harp: (t, k, d) => [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => bell(f, t + i * 0.075, 0.06, 1.1, d)),
      pass: (t, k, d) => bell(1568 * k, t, 0.04, 0.22, d),
      arrive: (t, k, d) => { wood(261.6, t, 0.18, 0.5, d); [523.25, 659.25, 783.99].forEach((f) => bell(f, t + 0.02, 0.06, 1.4, d)); wood(1046.5, t + 0.12, 0.09, 0.4, d); },
    };
    function refresh() {
      for (const b of $$('[data-sound]')) {
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? t('soundOff') : t('soundOn'));
        b.classList.toggle('needs-tap', on && !unlocked);
      }
    }
    function unlock() {
      if (unlocked || !on) return;
      if (ensure()) unlocked = true;
      refresh();
    }
    function play(name, k = 1, pan = 0) {
      if (!on || !unlocked || !ac) return;
      if (ac.state === 'suspended') ac.resume();
      const fn = sounds[name];
      if (fn) fn(ac.currentTime + 0.012, k ?? 1, output(pan));
    }
    function setOn(value) {
      on = value;
      if (on) {
        unlock();
        play('poc');
      }
      refresh();
    }
    refresh();
    return { play, setOn, unlock, get on() { return on; }, get unlocked() { return unlocked; } };
  })();
  window.BocalSound = Sound;
  for (const b of $$('[data-sound]')) {
    b.addEventListener('click', () => {
      if (Sound.on && !Sound.unlocked) {
        Sound.unlock();
        Sound.play('poc');
      } else Sound.setOn(!Sound.on);
    });
  }
  const unlockSound = (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-sound]')) return;
    Sound.unlock();
  };
  for (const type of ['pointerdown', 'keydown', 'touchend']) addEventListener(type, unlockSound, { capture: true, passive: true });

  if (PLAY_URL) {
    for (const a of $$('[data-store]')) a.href = PLAY_URL;
    for (const s of $$('[data-store-label]')) s.textContent = t('storeDownload');
    for (const a of $$('.store-link')) a.textContent = t('storeShort');
  }

  const measure = document.createElement('canvas').getContext('2d');
  let uid = 0;
  const DISHES = new Set(['ramen', 'pizza', 'pancakes', 'wine', 'banhmi', 'tacos', 'icecream', 'bao', 'mezze', 'burger', 'sushi']);
  const PASTELS = ['#F9DDD5', '#FCE8B2', '#D6EBD3', '#DCE9F7', '#E8DFF8'];

  function jarSVG({ lid, label, tokens = [], fresh = -1 }) {
    const id = `jar${++uid}`;
    const lidH = 17, gh = 132, y0 = lidH - 2, H = y0 + gh;
    const glass = `M25 ${y0}H75A25 25 0 0 1 100 ${y0 + 25}V${y0 + gh - 30}A30 30 0 0 1 70 ${y0 + gh}H30A30 30 0 0 1 0 ${y0 + gh - 30}V${y0 + 25}A25 25 0 0 1 25 ${y0}Z`;
    const shown = tokens.slice(-9);
    const size = 23.5, gap = 4, pad = 8.5;
    let parts = '';
    shown.forEach((kind, i) => {
      const row = Math.floor(i / 3);
      const inRow = Math.min(3, shown.length - row * 3);
      const col = i % 3;
      const rowW = inRow * size + (inRow - 1) * gap;
      const x = 50 - rowW / 2 + col * (size + gap);
      const y = y0 + gh - pad - size - row * (size + gap);
      const cls = i === fresh ? 'jar-token drop' : 'jar-token';
      const rect = `x="${x}" y="${y}" width="${size}" height="${size}" rx="6.6"`;
      let fill;
      if (DISHES.has(kind)) {
        fill = `<clipPath id="${id}c${i}"><rect ${rect}/></clipPath><rect ${rect} fill="#F9DDD5"/><image href="${A}img/dishes/${kind}.webp" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#${id}c${i})" preserveAspectRatio="xMidYMid slice"/>`;
      } else if (kind === 'ig') fill = `<rect ${rect} fill="url(#${id}ig)"/>`;
      else if (kind === 'tt') fill = `<rect ${rect} fill="#111"/>`;
      else if (kind === 'yt') fill = `<rect ${rect} fill="#E62117"/><path d="M${x + 9} ${y + 7}l8 4.75-8 4.75z" fill="#fff"/>`;
      else fill = `<rect ${rect} fill="${PASTELS[+kind.slice(1)] || PASTELS[0]}"/>`;
      parts += `<g class="${cls}">${fill}<rect ${rect} fill="none" stroke="rgba(43,29,18,.55)" stroke-width="1.6"/></g>`;
    });
    let labelSvg = '';
    if (label) {
      measure.font = '800 15px "DM Sans", sans-serif';
      const tw = Math.min(118, measure.measureText(label).width);
      const lw = tw + 14, ly = y0 + gh * 0.3 + 11;
      const fit = tw >= 118 ? ' textLength="118" lengthAdjust="spacingAndGlyphs"' : '';
      labelSvg = `<g class="jar-label" transform="rotate(-3 50 ${ly})"><rect x="${50 - lw / 2}" y="${ly - 11.5}" width="${lw}" height="23" rx="6" fill="#fff" stroke="#2B1D12" stroke-width="2.8"/><text x="50" y="${ly + 5.2}" text-anchor="middle" font-family="DM Sans, sans-serif" font-weight="800" font-size="15" fill="#2B1D12"${fit}>${escapeHtml(label)}</text></g>`;
    }
    return `<svg viewBox="-14 -6 128 ${H + 10}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${id}ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#F9A825"/><stop offset=".5" stop-color="#E1306C"/><stop offset="1" stop-color="#7B3FE4"/></linearGradient>
      <clipPath id="${id}g"><path d="${glass}"/></clipPath></defs>
      <g class="jar-body">
        <path d="${glass}" fill="rgba(255,255,255,.55)"/>
        <g clip-path="url(#${id}g)">${parts}<rect x="13" y="${y0 + 16}" width="7" height="40" rx="3.5" fill="#fff" opacity=".95"/></g>
        <path d="${glass}" fill="none" stroke="#2B1D12" stroke-width="3.5" stroke-linejoin="round"/>
        ${labelSvg}
      </g>
      <g class="jar-lid"><rect x="12.5" y="0" width="75" height="17" rx="6" fill="${lid}" stroke="#2B1D12" stroke-width="3"/><path d="M20 6.5h60" stroke="#2B1D12" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/></g>
    </svg>`;
  }

  function restart(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
  }

  const STATUS = `<span>9:41</span><span class="ph-sys"><svg viewBox="0 0 54 14" aria-hidden="true"><g fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6.5" width="3" height="7.5" rx="1"/><rect x="10" y="4" width="3" height="10" rx="1"/><rect x="15" y="1" width="3" height="13" rx="1"/><path d="M29 4.2a9 9 0 0 1 9.6 0l-1.5 1.8a6.4 6.4 0 0 0-6.6 0zM31.3 7a5 5 0 0 1 5 0l-1.6 1.9a2.4 2.4 0 0 0-1.8 0zM33.8 12.6l-1.3-1.6a1.7 1.7 0 0 1 2.6 0z"/><rect x="42" y="2" width="10" height="10" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".45"/><rect x="43.6" y="3.6" width="6.8" height="6.8" rx="1.4"/></g></svg></span>`;

  function buildPhone(el) {
    const screens = $('.phone-screens', el);
    const content = screens || (() => {
      const img = document.createElement('img');
      const name = el.dataset.screen;
      img.src = `${A}img/${SCREENS}/${name}.webp`;
      img.width = 390;
      img.height = 844;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = { home: t('altHome'), invite: t('altInvite') }[name] || '';
      return img;
    })();
    el.textContent = '';
    for (let i = 7; i >= 1; i--) {
      const slab = document.createElement('div');
      slab.className = 'ph-slab';
      slab.style.setProperty('--i', i);
      el.append(slab);
    }
    const body = document.createElement('div');
    body.className = 'ph-body';
    const screen = document.createElement('div');
    screen.className = 'ph-screen';
    screen.append(content);
    screen.insertAdjacentHTML('beforeend', `<div class="ph-status">${STATUS}</div><div class="ph-island"></div><div class="ph-glare"></div>`);
    el.append(body, screen);
  }
  $$('.phone').forEach(buildPhone);

  function renderFloatJars() {
    for (const el of $$('[data-jar]')) {
      const cfg = JSON.parse(el.dataset.jar);
      el.innerHTML = jarSVG(cfg);
    }
  }

  const revealObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      revealObserver.unobserve(e.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el) => revealObserver.observe(el));

  const tilts = $$('[data-tilt]').map((el) => {
    const [ry0, rx0] = (el.dataset.tilt || '-16,6').split(',').map(Number);
    const t = { el, ry0, rx0, ry: ry0, rx: rx0, px: 0, py: 0, tpx: 0, tpy: 0, on: false };
    const scene = el.closest('.tilt-scene') || el.parentElement;
    scene.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = scene.getBoundingClientRect();
      t.tpx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      t.tpy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    scene.addEventListener('pointerleave', () => { t.tpx = 0; t.tpy = 0; });
    el.style.setProperty('--ry', `${ry0}deg`);
    el.style.setProperty('--rx', `${rx0}deg`);
    return t;
  });
  const tiltObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const t = tilts.find((x) => x.el === e.target);
      if (t) t.on = e.isIntersecting;
    }
    if (tilts.some((t) => t.on)) startTilt();
  });
  tilts.forEach((t) => tiltObserver.observe(t.el));
  let tiltRunning = false;
  function startTilt() {
    if (tiltRunning || reduceMotion) return;
    tiltRunning = true;
    requestAnimationFrame(tiltFrame);
  }
  function tiltFrame() {
    let any = false;
    for (const t of tilts) {
      if (!t.on) continue;
      any = true;
      t.px += (t.tpx - t.px) * 0.08;
      t.py += (t.tpy - t.py) * 0.08;
      const r = t.el.getBoundingClientRect();
      const c = Math.max(-0.8, Math.min(0.8, (r.top + r.height / 2) / innerHeight - 0.5));
      const ry = t.ry0 - c * 20 + t.px * 12;
      const rx = t.rx0 + c * 12 - t.py * 9;
      t.ry += (ry - t.ry) * 0.12;
      t.rx += (rx - t.rx) * 0.12;
      t.el.style.setProperty('--ry', `${t.ry.toFixed(2)}deg`);
      t.el.style.setProperty('--rx', `${t.rx.toFixed(2)}deg`);
    }
    if (any) requestAnimationFrame(tiltFrame);
    else tiltRunning = false;
  }

  const LIDS = ['#E0533D', '#4D96D9', '#F2C14E', '#6FA36B', '#9B7FD9', '#E68AA8', '#EE8A3C', '#2B1D12']
    .map((color, i) => [i, t('colors')[i], color]);
  const EMOJIS = ['🍝', '🍰', '🍷', '✈️', '🏖️', '🏠', '🛋️', '🎁', '🎬', '📚', '🎵', '🌿'];
  const builder = { lid: '#E0533D', emoji: '🍝', name: t('builderName'), tokens: ['pizza', 'pancakes', 'icecream', 'tacos', 'banhmi'] };
  const builderJar = $('#builder-jar');
  const nameInput = $('#builder-name');

  function renderBuilder(anim) {
    if (!builderJar) return;
    const name = (nameInput.value.trim() || t('myJar')).slice(0, 14);
    builderJar.innerHTML = jarSVG({ lid: builder.lid, label: `${name} ${builder.emoji}`, tokens: builder.tokens });
    if (anim === 'lid') restart($('.jar-lid', builderJar), 'hop');
    if (anim === 'body') restart($('.jar-body', builderJar), 'squash');
  }

  if (builderJar) {
    nameInput.value = builder.name;
    const swatches = $('#swatches');
    LIDS.forEach(([, label, color], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--c', color);
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(color === builder.lid));
      b.addEventListener('click', () => {
        builder.lid = color;
        $$('.swatch', swatches).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        renderBuilder('lid');
        Sound.play('poc', 0.8 + i * 0.07);
      });
      swatches.append(b);
    });
    const emojis = $('#emojis');
    EMOJIS.forEach((e, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'emoji';
      b.textContent = e;
      b.setAttribute('aria-label', `${t('emoji')} ${e}`);
      b.setAttribute('aria-pressed', String(e === builder.emoji));
      b.addEventListener('click', () => {
        builder.emoji = e;
        $$('.emoji', emojis).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        renderBuilder('body');
        Sound.play('tick');
      });
      emojis.append(b);
    });
    nameInput.addEventListener('input', () => renderBuilder());
    renderBuilder();
  }

  const steps = $$('.share-step');
  const shareShots = $$('#share-phone .phone-screens img');
  if (steps.length) {
    const stepObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const n = +e.target.dataset.step;
        steps.forEach((s) => s.classList.toggle('is-on', s === e.target));
        shareShots.forEach((img, i) => img.classList.toggle('is-on', i === n));
        Sound.play('tick');
      }
    }, { rootMargin: '-48% 0px -48% 0px' });
    steps.forEach((s) => stepObserver.observe(s));
  }

  const live = {
    stage: $('#live-stage'),
    jar: $('#live-jar'),
    count: $('#live-count'),
    feed: $('#live-feed'),
    base: ['pizza', 'pancakes', 'wine', 'banhmi', 'tacos', 'icecream', 'bao', 'ramen'],
    tokens: [],
    on: false,
    run: 0,
    rounds: 0,
  };
  const ARRIVALS = [
    { who: 'Léa', av: '.la-1', dish: 'mezze', title: t('titles').mezze },
    { who: 'Inès', av: '.la-2', dish: 'burger', title: t('titles').burger },
    { who: 'Sam', av: '.la-3', dish: 'sushi', title: t('titles').sushi },
  ];

  function renderLive(fresh) {
    live.jar.innerHTML = jarSVG({ lid: '#E0533D', label: `${t('jarRestos')} 🍜`, tokens: live.tokens, fresh });
  }

  function feedRow(a) {
    const li = document.createElement('li');
    li.innerHTML = `<img src="${A}img/dishes/${a.dish}.webp" alt="" width="96" height="96"><span>${t('added')(a.who, escapeHtml(a.title), `${t('jarRestos')} 🍜`)}</span>`;
    return li;
  }

  function liveReset() {
    live.tokens = live.base.slice();
    live.count.textContent = String(live.tokens.length);
    renderLive();
  }

  async function throwOne(a, run) {
    const stage = live.stage.getBoundingClientRect();
    const av = $(a.av, live.stage);
    const ar = av.getBoundingClientRect();
    const jr = live.jar.getBoundingClientRect();
    restart(av, 'throw');
    const card = document.createElement('div');
    card.className = 'fly-card';
    card.innerHTML = `<img src="${A}img/dishes/${a.dish}.webp" alt="" width="96" height="96"><span>${escapeHtml(a.title)}</span>`;
    live.stage.append(card);
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const fitX = (x) => Math.min(Math.max(x, cw / 2 + 10), stage.width - cw / 2 - 10);
    const sx = fitX(ar.left + ar.width / 2 - stage.left), sy = ar.top + ar.height / 2 - stage.top;
    const ex = jr.left + jr.width / 2 - stage.left, ey = jr.top + jr.width * 0.1 - stage.top;
    const cx = (sx + ex) / 2, cy = Math.min(sy, ey) - 110;
    const frames = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
      const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
      const s = 1 - 0.84 * t * t;
      const rot = (sx < ex ? -10 : 10) * (1 - t) + 14 * t;
      frames.push({ transform: `translate(${x - cw / 2}px, ${y - ch / 2}px) rotate(${rot}deg) scale(${s})`, opacity: t > 0.9 ? (1 - t) * 10 : 1 });
    }
    const anim = card.animate(frames, { duration: 1050, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    setTimeout(() => { if (run === live.run) { restart($('.jar-lid', live.jar), 'hop'); if (!live.rounds) Sound.play('pop'); } }, 430);
    await anim.finished.catch(() => {});
    card.remove();
    if (run !== live.run) return;
    live.tokens.push(a.dish);
    renderLive(Math.min(8, live.tokens.length - 1));
    restart($('.jar-body', live.jar), 'squash');
    live.count.textContent = String(live.tokens.length);
    restart(live.count, 'bump');
    live.feed.prepend(feedRow(a));
    while (live.feed.children.length > 3) live.feed.lastElementChild.remove();
    if (!live.rounds) Sound.play('poc', 1 + live.tokens.length * 0.03);
  }

  async function liveLoop() {
    const run = ++live.run;
    liveReset();
    await wait(500);
    while (live.on && run === live.run) {
      for (const a of ARRIVALS) {
        if (!live.on || run !== live.run) return;
        await throwOne(a, run);
        await wait(1300);
      }
      await wait(2400);
      live.rounds++;
      if (!live.on || run !== live.run) return;
      for (const li of [...live.feed.children]) li.classList.add('out');
      await wait(420);
      live.feed.textContent = '';
      liveReset();
      await wait(800);
    }
  }

  if (live.stage) {
    liveReset();
    if (reduceMotion) {
      for (const a of ARRIVALS) { live.tokens.push(a.dish); live.feed.prepend(feedRow(a)); }
      live.count.textContent = String(live.tokens.length);
      renderLive();
    } else {
      new IntersectionObserver((entries) => {
        const visible = entries[0].isIntersecting;
        if (visible && !live.on) { live.on = true; liveLoop(); }
        if (!visible && live.on) { live.on = false; live.run++; live.feed.textContent = ''; liveReset(); }
      }, { threshold: 0.35 }).observe(live.stage);
    }
  }

  const ICONS = {
    all: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
    resto: 'M7 3v7m-3-7v4a3 3 0 0 0 6 0V3M7 10v11M17 21V3c-2.5 1.5-3.5 4-3.5 8h3.5',
    sortie: 'M3 8V5h18v3a3 3 0 0 0 0 6v3H3v-3a3 3 0 0 0 0-6zM14 5v12',
    recette: 'M6 4h10a3 3 0 0 1 3 3v13H9a3 3 0 0 1-3-3zM10 9h5M10 13h5',
  };
  const TAGS = [
    { key: 'all', label: t('tagAll'), color: '' },
    { key: 'resto', label: t('tagResto'), color: '#BE123C' },
    { key: 'sortie', label: t('tagSortie'), color: '#6D28D9' },
    { key: 'recette', label: t('tagRecette'), color: '#9A3412' },
  ];
  const ITEMS = [
    { dish: 'ramen', title: t('titles').ramen, meta: 'Léa · instagram.com', tags: ['resto'] },
    { dish: 'pancakes', title: t('titles').pancakes, meta: 'Inès · instagram.com', tags: ['resto', 'sortie'] },
    { dish: 'wine', title: t('titles').wine, meta: `${t('you')} · bxl-apero.be`, tags: ['sortie'] },
    { dish: 'pizza', title: t('titles').pizzaRecipe, meta: 'Sam · youtube.com', tags: ['recette'] },
  ];
  const tagRow = $('#tag-row');
  if (tagRow) {
    const list = document.createElement('div');
    list.className = 'tag-list';
    for (const it of ITEMS) {
      const row = document.createElement('div');
      row.className = 'tag-item';
      row.dataset.tags = it.tags.join(' ');
      row.innerHTML = `<img src="${A}img/dishes/${it.dish}.webp" alt="" width="96" height="96"><span>${it.title}<small>${it.meta}</small></span>`;
      list.append(row);
    }
    tagRow.after(list);
    let auto = true, index = 0, timer = 0;
    const buttons = TAGS.map((t, i) => {
      const n = t.key === 'all' ? ITEMS.length : ITEMS.filter((it) => it.tags.includes(t.key)).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag';
      if (t.color) b.style.setProperty('--tc', t.color);
      b.setAttribute('aria-pressed', String(i === 0));
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[t.key]}"/></svg>${t.label} · ${n}`;
      b.addEventListener('click', () => { auto = false; select(i); });
      tagRow.append(b);
      return b;
    });
    function select(i) {
      index = i;
      const key = TAGS[i].key;
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      for (const row of list.children) row.classList.toggle('hide', key !== 'all' && !row.dataset.tags.split(' ').includes(key));
    }
    if (!reduceMotion) {
      new IntersectionObserver((entries) => {
        clearInterval(timer);
        if (entries[0].isIntersecting) timer = setInterval(() => { if (auto) select((index + 1) % TAGS.length); }, 2200);
      }, { threshold: 0.4 }).observe(tagRow.closest('.tile'));
    }
  }

  const ctaShelf = $('#cta-shelf');
  if (ctaShelf) {
    const holder = $('.cta-jars', ctaShelf);
    const jars = [
      { lid: '#F2C14E', label: `${t('jarRecettes')} 🍝`, tokens: ['p1', 'yt', 'ig', 'p2', 'tt'] },
      { lid: '#E0533D', label: `${t('jarRestos')} 🍜`, tokens: ['pizza', 'pancakes', 'wine', 'banhmi', 'tacos', 'ramen', 'bao'] },
      { lid: '#4D96D9', label: `${t('jarWeekend')} ✈️`, tokens: ['ig', 'p3', 'yt', 'p0'] },
    ];
    jars.forEach((cfg, i) => {
      const d = document.createElement('div');
      d.className = 'cj';
      d.style.setProperty('--i', i);
      d.dataset.cfg = JSON.stringify(cfg);
      holder.append(d);
    });
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      ctaShelf.classList.add('is-in');
      obs.disconnect();
      if (!reduceMotion) jars.forEach((_, i) => setTimeout(() => Sound.play('poc', 0.9 + i * 0.12), 1000 + i * 170));
    }, { threshold: 0.6 }).observe(ctaShelf);
  }

  function renderAllJars() {
    renderFloatJars();
    for (const d of $$('.cta-jars .cj')) d.innerHTML = jarSVG(JSON.parse(d.dataset.cfg));
    if (builderJar) renderBuilder();
    if (live.stage) renderLive();
  }
  renderAllJars();
  document.fonts.ready.then(renderAllJars);
})();
