/* Home-page motion: the "Luis" glyph scramble, the role typer and the binary field.
   Ported from the Terminal design board. One requestAnimationFrame loop drives all three,
   so everything pauses together while the tab is hidden or the stage is off-screen. */

(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = document.getElementById('home-name');
  const role = document.getElementById('home-role');
  const stage = document.querySelector('.t-stage');
  const canvas = document.querySelector('.home-field');
  const palette = document.querySelector('.t-palette');
  if (!name || !role || !stage || !canvas) return;
  const ctx = canvas.getContext('2d');

  /* ---- name scramble: at 1.2s, then every 6s; 45ms frames, one letter settles every 3 frames ---- */
  const GLYPHS = '!<>-_/[]{}=+*^?#01';
  const scramble = { next: 1200, frame: 0, acc: 0, on: false };

  // The scramble draws over the name (CSS ::after), so its text and accessible name stay "Luis".
  function stepScramble(dt) {
    if (!scramble.on && elapsed >= scramble.next) {
      Object.assign(scramble, { on: true, frame: 0, acc: 0, next: (Math.floor(elapsed / 6000) + 1) * 6000 });
    }
    if (!scramble.on) return;
    scramble.acc += dt;
    while (scramble.on && scramble.acc >= 45) {
      scramble.acc -= 45;
      const f = ++scramble.frame;
      const target = name.textContent;
      if (f > target.length * 3 + 3) {
        scramble.on = false;
        delete name.dataset.scramble;
      } else {
        name.dataset.scramble = [...target].map((ch, i) => (f > i * 3 + 3 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
      }
    }
  }

  /* ---- role typer: 70ms ticks; types a role, holds 24 ticks, deletes it, holds 6, next role ---- */
  const ROLES = ['web developer', 'software engineer', 'network admin', 'lifelong gamer'];
  // Opens on the first role already typed (as the HTML has it) and holds it about as long as the board
  // takes to type it, so the first delete lands when it does on the board.
  const typer = { ri: 0, ci: ROLES[0].length, del: false, hold: ROLES[0].length, acc: 0 };
  let typed = null;

  // #home-role keeps the whole role for screen readers; an aria-hidden twin shows the typing (CSS ::before).
  function setUpTyper() {
    typed = document.createElement('span');
    typed.className = 'home-typed';
    typed.setAttribute('aria-hidden', 'true');
    typed.dataset.text = ROLES[0];
    role.classList.add('home-sr');
    role.after(typed);
  }

  function tickTyper() {
    const word = ROLES[typer.ri];
    if (typer.hold > 0) typer.hold -= 1;
    else if (!typer.del) {
      if (typer.ci < word.length) typer.ci += 1;
      else Object.assign(typer, { del: true, hold: 24 });
    } else if (typer.ci > 0) typer.ci -= 1;
    else Object.assign(typer, { del: false, ri: (typer.ri + 1) % ROLES.length, hold: 6 });
  }

  function stepTyper(dt) {
    typer.acc += dt;
    if (typer.acc < 70) return;
    for (; typer.acc >= 70; typer.acc -= 70) tickTyper();
    typed.dataset.text = ROLES[typer.ri].slice(0, typer.ci);
  }

  /* ---- binary field: a 24px grid of 0/1 on a canvas behind the stage ---- */
  const S = 24; // cell size, px
  const HALF = S / 2;
  const REACH = 130; // cursor radius for the gold tint and the extra churn, px
  const f = {
    w: 0, h: 0, dpr: 0, C: 0, R: 0, bits: [],
    fm: null, wait: undefined, k: undefined, n: 0, ping: null,
    mx: null, my: null, hover: false, glow: 0, acc: 0, dirty: true,
  };
  let tokens = null;
  let sprites = null;
  // The dim 0/1 grid lives on its own layer, repainted only where a bit flips;
  // each frame copies it in and draws just the gold, lit and flashing cells over it.
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');

  // One pre-rendered glyph per look, so each cell is a drawImage with an alpha instead of a fillText.
  // Only the glowing looks get room around the cell for their shadow.
  function sprite(ch, weight, color, blur, shadow) {
    const pad = blur ? HALF : 0;
    const box = S + 2 * pad;
    const img = document.createElement('canvas');
    img.width = img.height = Math.ceil(box * f.dpr);
    const g = img.getContext('2d');
    g.scale(f.dpr, f.dpr);
    g.font = `${weight} 13px ${tokens.font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    if (blur) {
      g.shadowBlur = blur * f.dpr; // shadowBlur ignores the transform
      g.shadowColor = shadow;
    }
    g.fillText(ch, box / 2, box / 2);
    return { img, pad, box };
  }

  function buildSprites() {
    sprites = ['0', '1'].map((ch) => ({
      dim: sprite(ch, 400, tokens.text),
      hot: sprite(ch, 400, tokens.accent),
      lit: sprite(ch, 700, tokens.accent, 8, 'rgba(245, 184, 0, 0.55)'),
      flash: sprite(ch, 400, tokens.text, 10, 'rgba(245, 184, 0, 0.95)'),
    }));
  }

  const cellX = (i) => (i % f.C) * S;
  const cellY = (i) => Math.floor(i / f.C) * S;

  const blit = (g, s, x, y, alpha) => {
    g.globalAlpha = alpha;
    g.drawImage(s.img, x - s.pad, y - s.pad, s.box, s.box);
  };

  // A dim glyph stays inside its cell, so clearing the cell removes it.
  function paintBase(i) {
    const x = cellX(i), y = cellY(i);
    bctx.clearRect(x, y, S, S);
    blit(bctx, sprites[f.bits[i]].dim, x, y, 0.07);
  }

  function toggle(i) {
    f.bits[i] = 1 - f.bits[i];
    paintBase(i);
  }

  function measure() {
    const box = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (box.width === f.w && box.height === f.h && dpr === f.dpr) return;
    const sharper = dpr !== f.dpr;
    Object.assign(f, { w: box.width, h: box.height, dpr });
    canvas.width = base.width = Math.round(box.width * dpr);
    canvas.height = base.height = Math.round(box.height * dpr);
    if (sharper) buildSprites();
    const C = Math.ceil(box.width / S), R = Math.ceil(box.height / S);
    if (C !== f.C || R !== f.R) {
      Object.assign(f, { C, R, bits: Array.from({ length: C * R }, () => (Math.random() > 0.5 ? 1 : 0)) });
    }
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < f.bits.length; i++) paintBase(i);
    draw();
  }

  // Calls fn(cell, distance) for each cell centre within REACH of the cursor.
  function forNear(fn) {
    const c0 = Math.max(0, Math.floor((f.mx - REACH) / S)), c1 = Math.min(f.C - 1, Math.floor((f.mx + REACH) / S));
    const r0 = Math.max(0, Math.floor((f.my - REACH) / S)), r1 = Math.min(f.R - 1, Math.floor((f.my + REACH) / S));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const d = Math.hypot(c * S + HALF - f.mx, r * S + HALF - f.my);
      if (d < REACH) fn(r * f.C + c, d);
    }
  }

  const live = () => f.hover && f.mx !== null && !(palette && palette.open);

  // Board flip(), every 110ms: ten random flips, extra churn near the cursor, and the formation clock.
  function flip() {
    const { C, R } = f;
    for (let k = 0; k < 10; k++) toggle(Math.floor(Math.random() * f.bits.length));
    if (live()) forNear((i) => { if (Math.random() < 0.3) toggle(i); });
    let fm = f.fm;
    if (fm) {
      fm.t += 1;
      if (fm.kind === 'whale' && fm.t === 30) {
        const cx = Math.round(-8 + 0.75 * C * 0.7);
        sendPing(Math.min((C - 1) * S, (cx + 17) * S + HALF), (R - 1) * S);
      }
      if (fm.t > dur(fm.kind)) {
        fm = null;
        f.wait = 45;
      }
    } else {
      f.wait = (f.wait === undefined ? 20 : f.wait) - 1;
      if (f.wait <= 0) fm = spawn(C, R);
    }
    if (fm !== f.fm) {
      if (fm) canvas.dataset.formation = fm.kind;
      else delete canvas.dataset.formation;
    }
    f.fm = fm;
  }

  function dur(kind) {
    return kind === 'whale' ? 48 : 70;
  }

  // Board spawn(), as-is: eye, Clawd and whale in turn.
  function spawn(C, R) {
    f.k = ((f.k === undefined ? -1 : f.k) + 1) % 3;
    const kind = ['eye', 'clawd', 'whale'][f.k];
    f.n += 1;
    if (kind === 'eye') return { kind, t: 0, n: f.n, ox: 2 + Math.floor(Math.random() * Math.max(1, C - 23)), oy: 4 + Math.floor(Math.random() * Math.max(1, R - 16)) };
    if (kind === 'clawd') return { kind, t: 0, n: f.n, ox: Math.max(0, C - 19), oy: Math.max(0, R - 11) };
    return { kind, t: 0, n: f.n, ox: 0, oy: 0 };
  }

  // Board shape(), as-is: the cell indexes a formation lights at its tick t.
  function shape(fm, C, R, mx, my) {
    const t = fm.t, out = [];
    const put = (r, c) => { if (r >= 0 && r < R && c >= 0 && c < C) out.push(r * C + c); };
    const draw = (rows, oy, ox, skip) => rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#' && !(skip && skip(r, c))) put(oy + r, ox + c);
    });
    if (fm.kind === 'eye') {
      const lid = (t >= 30 && t < 32) || t === 49 ? 'closed' : (t >= 28 && t < 34) || t === 48 || t === 50 ? 'half' : 'open';
      if (lid === 'closed') {
        for (let c = 0; c < 19; c++) put(fm.oy + 4, fm.ox + c);
        [3, 6, 9, 12, 15].forEach((c) => put(fm.oy + 5, fm.ox + c));
        return out;
      }
      draw(lid === 'open'
        ? ['       #####       ', '   ####     ####   ', ' ##             ## ', '#                 #', '#                 #', '#                 #', ' ##             ## ', '   ####     ####   ', '       #####       ']
        : ['', '', '  ###############  ', '#                 #', '#                 #', '#                 #', '  ###############  '], fm.oy, fm.ox);
      const ex = (fm.ox + 9) * 24 + 12, ey = (fm.oy + 4) * 24 + 12;
      const dx = mx != null ? Math.max(-3, Math.min(3, Math.round((mx - ex) / 60))) : Math.round(Math.sin(t / 7) * 3);
      const dy = my != null ? Math.max(-1, Math.min(1, Math.round((my - ey) / 70))) : 0;
      const span = [null, [7, 11], [3, 15], [1, 17], [1, 17], [1, 17], [3, 15], [7, 11]];
      for (let r = 1; r < 8; r++) {
        if (lid === 'half' && (r < 3 || r > 5)) continue;
        for (let c = span[r][0]; c <= span[r][1]; c++) {
          const d = (r - 4 - dy) * (r - 4 - dy) + (c - 9 - dx) * (c - 9 - dx);
          if (d <= 6.5 && d > 1) put(fm.oy + r, fm.ox + c);
        }
      }
      return out;
    }
    if (fm.kind === 'clawd') {
      const blink = t === 30 || t === 31 || t === 44;
      const body = ['  ###########  ', '  ###########  ', '  ##  ###  ##  ', '  ##  ###  ##  ', '###############', '###############', '  ###########  ', '   # #   # #   ', '   # #   # #   '];
      draw(body, fm.oy, fm.ox, (r, c) => r >= 4 && r <= 5 && c >= 13);
      if (blink) [[2, 4], [2, 5], [2, 9], [2, 10], [3, 4], [3, 5], [3, 9], [3, 10]].forEach((p) => put(fm.oy + p[0], fm.ox + p[1]));
      const waving = t >= 12 && t < 52;
      const arm = !waving ? [[4, 13], [4, 14], [5, 13], [5, 14]]
        : Math.floor((t - 12) / 3) % 2 ? [[4, 13], [3, 14], [3, 15], [2, 15]]
        : [[3, 13], [2, 13], [2, 14], [1, 14], [0, 14]];
      arm.forEach((p) => put(fm.oy + p[0], fm.ox + p[1]));
      return out;
    }
    const W = ['##                   ', ' ##        ######    ', '  ##    ###########  ', '   ##############.## ', '  ##   ##############', ' ##     ###########  ', '##        #######    '];
    const u = Math.min(1, t / 40);
    const spanX = C * 0.7, amp = Math.min(R - 8, R * 0.65);
    const cx = Math.round(-8 + u * spanX);
    const cy = R + 1 - Math.sin(Math.PI * u) * amp;
    const slope = Math.max(-0.6, Math.min(0.6, -(amp * Math.PI / spanX) * Math.cos(Math.PI * u)));
    if (t <= 40) W.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') put(Math.round(cy + r + (c - 10) * slope), cx + c);
    });
    return out;
  }

  // A per-cell hash in [0, 1): the eye and Clawd fade in and out cell by cell over 10 ticks.
  const jit = (i, salt) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

  function litCells(isLive) {
    const lit = new Set();
    const fm = f.fm;
    if (!fm) return lit;
    const D = dur(fm.kind);
    for (const i of shape(fm, f.C, f.R, isLive ? f.mx : null, isLive ? f.my : null)) {
      if (fm.kind !== 'whale') {
        const g = jit(i, fm.n);
        if (fm.t < 10 && g > fm.t / 10) continue;
        if (fm.t > D - 10 && g < (fm.t - (D - 10)) / 10) continue;
      }
      lit.add(i);
    }
    return lit;
  }

  // The click wave: each cell flashes white for 0.8s (peak at 20%), 1.2ms later per px of distance.
  const WAVE = 800;
  const easeOut = (p) => 1 - (1 - p) * (1 - p);

  function sendPing(x, y) {
    f.ping = { x, y, t0: elapsed, end: elapsed + WAVE + Math.hypot(Math.max(x, f.w - x), Math.max(y, f.h - y)) * 1.2 };
  }

  function waveAt(cx, cy) {
    const p = f.ping;
    if (!p) return 0;
    const u = (elapsed - p.t0 - Math.round(Math.hypot(cx - p.x, cy - p.y) * 1.2)) / WAVE;
    if (u <= 0 || u >= 1) return 0;
    return u < 0.2 ? easeOut(u / 0.2) : 1 - easeOut((u - 0.2) / 0.8);
  }

  function draw() {
    const isLive = live();
    ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = tokens.bg;
    ctx.fillRect(0, 0, f.w, f.h);
    // the board's 200px radial gradient around the cursor, fading in over 0.3s
    if (isLive && f.glow > 0) {
      const g = ctx.createRadialGradient(f.mx, f.my, 0, f.mx, f.my, 200);
      g.addColorStop(0, 'rgba(245, 184, 0, 0.1)');
      g.addColorStop(1, 'rgba(245, 184, 0, 0)');
      ctx.globalAlpha = f.glow;
      ctx.fillStyle = g;
      ctx.fillRect(f.mx - 200, f.my - 200, 400, 400);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(base, 0, 0, f.w, f.h);
    // gold cells cover their dim glyph, and give way to the wave's white as it passes
    const over = (i, look, alpha) => {
      const x = cellX(i), y = cellY(i);
      blit(ctx, sprites[f.bits[i]][look], x, y, alpha * (1 - waveAt(x + HALF, y + HALF)));
    };
    const lit = litCells(isLive);
    for (const i of lit) over(i, 'lit', 1);
    if (isLive) forNear((i, d) => { if (!lit.has(i)) over(i, 'hot', 0.2 + 0.8 * (1 - d / REACH)); });
    if (f.ping) {
      for (let i = 0; i < f.bits.length; i++) {
        const x = cellX(i), y = cellY(i);
        const w = waveAt(x + HALF, y + HALF);
        if (w > 0) blit(ctx, sprites[f.bits[i]].flash, x, y, w);
      }
    }
    f.dirty = false;
  }

  // Redraws on each 110ms tick, and every frame only while something moves between ticks.
  function stepField(dt) {
    f.acc += dt;
    for (; f.acc >= 110; f.acc -= 110) {
      flip();
      f.dirty = true;
    }
    const target = live() ? 1 : 0;
    if (f.glow !== target) {
      f.glow = target ? Math.min(1, f.glow + dt / 300) : 0;
      f.dirty = true;
    }
    if (f.ping) {
      if (elapsed >= f.ping.end) f.ping = null;
      f.dirty = true;
    }
    if (f.dirty) draw();
  }

  function pointAt(event) {
    const box = stage.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  }

  function listen() {
    stage.addEventListener('pointermove', (event) => {
      [f.mx, f.my] = pointAt(event);
      f.hover = true;
      f.dirty = true;
    });
    stage.addEventListener('pointerleave', () => {
      f.hover = false;
      f.dirty = true;
    });
    // Clicks on links, controls and content cards are theirs; the background sends a wave.
    stage.addEventListener('click', (event) => {
      if (event.target.closest('a, button, input, label, .t-nav, h1, .home-term, .home-photo')) return;
      sendPing(...pointAt(event));
    });
  }

  /* ---- the loop: its clock only advances while it runs, so a pause resumes where it stopped ---- */
  let elapsed = 0;
  let last = null;
  let raf = 0;
  let onScreen = true;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last === null ? 0 : Math.min(now - last, 1000); // a stalled frame catches up, but never hours of it
    last = now;
    elapsed += dt;
    stepScramble(dt);
    stepTyper(dt);
    stepField(dt);
  }

  function update() {
    if (!document.hidden && onScreen) {
      if (raf) return;
      last = null;
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function init() {
    // Reduced motion gets one still frame of the field (redrawn on resize) and the static text.
    measure();
    new ResizeObserver(measure).observe(stage);
    window.addEventListener('resize', measure); // a zoom changes devicePixelRatio without resizing the stage
    if (still) return;
    listen();
    setUpTyper();
    document.addEventListener('visibilitychange', update);
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    }).observe(stage);
    update();
  }

  // Starts once its inputs are ready: WebKit runs deferred scripts before the stylesheets apply,
  // so the tokens and the stage's size are read after load, and the glyphs after the mono font is in.
  const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  loaded
    .then(() => {
      const css = getComputedStyle(document.documentElement);
      const token = (prop) => css.getPropertyValue(prop).trim();
      tokens = { font: token('--font-mono'), bg: token('--bg'), text: token('--text'), accent: token('--accent') };
      return Promise.all(['400', '700'].map((weight) => document.fonts.load(`${weight} 13px ${tokens.font}`)));
    })
    .catch(() => {}) // without the web font the glyphs fall back to the system mono
    .then(init);
})();
