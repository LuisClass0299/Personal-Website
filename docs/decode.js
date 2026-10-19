/* Photo decode (home page): the photo burns out into tiles, the /decode luis mini terminal runs,
   then the tiles decode back in and sharpen. Ported from the Terminal board's burnStep loop.
   The <img> stays the base layer: this script only draws on the canvas over it, and CSS hides
   the img while data-decode says the tiles are on screen. */
(() => {
  const figure = document.querySelector('.home-photo');
  const canvas = figure && figure.querySelector('.home-decode-canvas');
  if (!canvas || !canvas.getContext || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const img = figure.querySelector('img');

  const W = 320, H = 420, TILE = 20, COLS = W / TILE, ROWS = H / TILE, ZOOM = 12;
  const PHASES = [['hold', 2600], ['out', 2600], ['gap', 1900], ['in', 2200], ['sharp', 450]];
  // the digit a burning tile flashes, from its animation progress: [until, digit, colour]
  const BITS = [[0.2], [0.3, '0', '#ffffff'], [0.4, '1', '#ffffff'], [0.5, '0', '#ffe9a8'], [0.6, '1', '#ffe9a8'], [0.7, '0', '#F5B800'], [0.8, '1', '#F5B800'], [1, '0', '#F5B800']];
  const jit = (i, salt) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };
  const ease = (t) => t * t * (3 - 2 * t);
  const clamp = (t) => Math.max(0, Math.min(1, t));

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const ctx = canvas.getContext('2d');
  let base, burnt;

  /* The photo as the img shows it (object-fit: cover, top), plus a darkened sepia copy for the burn. */
  function prepare() {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '600 13px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    base = document.createElement('canvas');
    base.width = W * dpr;
    base.height = H * dpr;
    const bctx = base.getContext('2d');
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * dpr;
    const dw = img.naturalWidth * scale;
    bctx.drawImage(img, (base.width - dw) / 2, 0, dw, img.naturalHeight * scale);

    burnt = document.createElement('canvas');
    burnt.width = base.width;
    burnt.height = base.height;
    const pixels = bctx.getImageData(0, 0, base.width, base.height);
    const p = pixels.data;
    for (let i = 0; i < p.length; i += 4) {
      // brightness(.5) sepia(1)
      const r = p[i] / 2, g = p[i + 1] / 2, b = p[i + 2] / 2;
      p[i] = 0.393 * r + 0.769 * g + 0.189 * b;
      p[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
      p[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
    }
    burnt.getContext('2d').putImageData(pixels, 0, 0);
  }

  /* One 20px tile showing its patch of src, magnified `zoom` times around the tile's centre. */
  function tile(src, x, y, zoom, alpha) {
    const half = TILE / 2 / zoom;
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, (x + TILE / 2 - half) * dpr, (y + TILE / 2 - half) * dpr, 2 * half * dpr, 2 * half * dpr, x, y, TILE, TILE);
  }

  let blank = false;

  function draw(phase, t, cycle) {
    // hold shows the img and gap shows nothing: clear once and idle until the tiles return
    const idle = phase === 'hold' || phase === 'gap';
    if (idle && blank) return;
    ctx.clearRect(0, 0, W, H);
    blank = idle;
    if (idle) return;
    // the board's background-size transition: .36s steps(4) between sharp and 12× pixelated
    const step = Math.min(4, Math.floor(t / 90)) / 4;
    const zoom = phase === 'out' ? 1 + (ZOOM - 1) * step : phase === 'sharp' ? ZOOM - (ZOOM - 1) * step : ZOOM;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, x = c * TILE, y = r * TILE;
        // progress through the tile's .9s burn: out burns from the bottom-left, in runs it backwards from the top-right
        let f = 0;
        if (phase === 'out') f = (t - 300 - Math.hypot(x + 10, H - y - 10) / 530 * 1100 - jit(i, 20 + cycle) * 200) / 900;
        if (phase === 'in') f = 1 - (t - Math.hypot(W - x - 10, y + 10) / 530 * 1100 - jit(i, 10 + cycle) * 250) / 900;
        f = clamp(f);
        const opacity = f < 0.3 ? 1 : 1 - ease(clamp((f - 0.3) / 0.15));
        const burn = f < 0.3 ? ease(f / 0.3) : 1 - ease((f - 0.3) / 0.7);
        if (opacity > 0) {
          tile(base, x, y, zoom, opacity);
          if (burn > 0) tile(burnt, x, y, zoom, opacity * burn);
        }
        const bit = BITS.find(([until]) => f < until);
        if (bit && bit[1]) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = bit[2];
          ctx.fillText(bit[1], x + TILE / 2, y + TILE / 2 + 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  let index = 0, elapsed = 0, cycle = 0, last = null, raf = 0, onScreen = false;

  function frame(now) {
    // dt is capped so a janky frame doesn't skip a phase
    elapsed += last === null ? 0 : Math.min(100, now - last);
    last = now;
    while (elapsed >= PHASES[index][1]) {
      elapsed -= PHASES[index][1];
      index = (index + 1) % PHASES.length;
      if (PHASES[index][0] === 'in') cycle++;
      figure.dataset.decode = PHASES[index][0];
    }
    draw(PHASES[index][0], elapsed, cycle);
    raf = requestAnimationFrame(frame);
  }

  /* Runs only while the tab is visible and the photo is on screen; .is-paused freezes the CSS side. */
  function update() {
    const run = onScreen && !document.hidden;
    figure.classList.toggle('is-paused', !run);
    if (run && !raf) {
      last = null;
      raf = requestAnimationFrame(frame);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  img.decode().then(() => {
    prepare();
    figure.dataset.decode = 'hold';
    update();
    document.addEventListener('visibilitychange', update);
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    }).observe(figure);
  }, () => {});
})();
