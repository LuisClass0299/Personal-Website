import { test, expect, type Page } from '@playwright/test';

/* Fake-clock runs are slow in WebKit and Firefox once other workers share the machine (the formations alone take ~14s). */
test.describe.configure({ timeout: 90_000 });

/* Only home.js runs: the photo decode's own loop would slow every fake-clock jump, most of all in WebKit. */
test.beforeEach(async ({ page }) => {
  await page.route('**/decode.js', (route) => route.abort());
});

const field = (page: Page) => page.locator('canvas.home-field');

/* The field's backing store vs the stage's box in device pixels, read in one go so a reflow can't land between them. */
const fieldVsStage = (page: Page) => field(page).evaluate((c: HTMLCanvasElement) => {
  const box = c.parentElement!.getBoundingClientRect();
  return { field: [c.width, c.height], stage: [Math.round(box.width * devicePixelRatio), Math.round(box.height * devicePixelRatio)] };
});

/* home.js starts after load and the mono font; it has started once the field is sized to the stage. */
async function fieldReady(page: Page) {
  await expect.poll(async () => { const { field, stage } = await fieldVsStage(page); return field.join() === stage.join(); }).toBe(true);
}

/* Time is fake and paused from the first script on, so every step below is an exact jump of the clock. */
async function openPaused(page: Page) {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto('/');
  await fieldReady(page);
}

/* What the eye sees: the scramble draws over the name, the real text stays put for screen readers. */
const shownName = (page: Page) => page.locator('#home-name').evaluate((el: HTMLElement) => el.dataset.scramble ?? el.textContent);

test.describe('home name scramble', () => {
  test('scrambles "Luis" about 1.2s after load, settles, and plays again every 6s', async ({ page }) => {
    await openPaused(page);
    const name = page.locator('#home-name');

    await page.clock.runFor(1000);
    expect(await shownName(page)).toBe('Luis');

    await page.clock.runFor(300); // 1.3s
    const scrambled = await shownName(page);
    expect(scrambled).toHaveLength(4);
    expect(scrambled).not.toBe('Luis');
    // the accessible name and the text stay whole while the glyphs churn
    await expect(page.getByRole('heading', { level: 1, name: "Hello, I'm Luis" })).toBeVisible();
    await expect(name).toHaveText('Luis');

    await page.clock.runFor(900); // 2.2s
    expect(await shownName(page)).toBe('Luis');

    await page.clock.runFor(3700); // 5.9s
    expect(await shownName(page)).toBe('Luis');
    await page.clock.runFor(300); // 6.2s
    expect(await shownName(page)).not.toBe('Luis');
    await page.clock.runFor(1000); // 7.2s
    expect(await shownName(page)).toBe('Luis');
    await page.clock.runFor(5000); // 12.2s
    expect(await shownName(page)).not.toBe('Luis');
  });
});

const ROLES = ['web developer', 'software engineer', 'network admin', 'lifelong gamer'];

/* The typed text is painted by CSS from data-text; #home-role keeps the whole role for screen readers. */
const shownRole = (page: Page) => page.locator('.home-typed').getAttribute('data-text');

test.describe('home role typer', () => {
  test('opens on the first role, then deletes and types each of the board roles in turn', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(100);
    expect(await shownRole(page)).toBe('web developer');
    await expect(page.locator('.home-typed')).toHaveAttribute('aria-hidden', 'true');

    // sample every 350ms (each role holds whole for 1.68s) and keep the whole words in order;
    // fastForward plays each 350ms as one frame, since WebKit takes ~16ms a fake frame
    const whole: string[] = [];
    const partial = new Set<string>();
    for (let t = 0; t < 22000; t += 350) {
      await page.clock.fastForward(350);
      const text = (await shownRole(page))!;
      if (ROLES.includes(text)) {
        if (whole.at(-1) !== text) whole.push(text);
      } else {
        expect(ROLES.some((role) => role.startsWith(text))).toBe(true);
        if (text) partial.add(text);
      }
    }
    expect(whole.slice(0, 5)).toEqual([...ROLES, ROLES[0]]);
    expect(partial.size).toBeGreaterThan(5);

    // screen readers and the line's text get a whole role, never a half-typed one
    await expect(page.locator('#home-role')).toHaveText('web developer');
    await expect(page.locator('.home-term-body > p').last()).toHaveText('→ web developer');
  });

  test('the caret blinks right after the typed text', async ({ page }) => {
    await page.goto('/');
    await fieldReady(page);
    const caret = page.locator('.home-caret');
    expect(await caret.evaluate((el) => getComputedStyle(el).animationName)).toBe('home-blink');
    const typed = (await page.locator('.home-typed').boundingBox())!;
    const box = (await caret.boundingBox())!;
    expect(Math.abs(box.x - (typed.x + typed.width) - 2)).toBeLessThanOrEqual(1);
  });
});

test.describe('home terminal card', () => {
  test('its six lines fade in one after another, as on the board', async ({ page }) => {
    await page.goto('/');
    const timing = await page.locator('.home-term-body > p').evaluateAll((els) => els.map((el) => {
      const s = getComputedStyle(el);
      return `${s.animationName} ${s.animationDuration} ${s.animationDelay}`;
    }));
    expect(timing).toEqual(['0.2s', '0.55s', '0.9s', '1.25s', '1.6s', '1.95s'].map((d) => `home-line 0.35s ${d}`));
  });
});

/* ---- binary field ---- */

type Pixels = { gold: number; hot: number; flash: number; bright: number };

/* Reads the field's pixels in a square of half-size r around (x, y), in CSS px from the stage's top-left:
   gold = formation-gold pixels, hot = strongest gold tint (r - b), flash = strongest white (b), bright = max channel. */
function pixels(page: Page, x = 0, y = 0, r = Infinity): Promise<Pixels> {
  return field(page).evaluate((c: HTMLCanvasElement, [x, y, r]) => {
    const k = c.width / c.clientWidth;
    const x0 = Math.max(0, Math.round((x - r) * k)), y0 = Math.max(0, Math.round((y - r) * k));
    const x1 = Math.min(c.width, Math.round((x + r) * k)), y1 = Math.min(c.height, Math.round((y + r) * k));
    const d = c.getContext('2d')!.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const out = { gold: 0, hot: 0, flash: 0, bright: 0 };
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 140 && d[i + 2] < 80) out.gold++;
      out.hot = Math.max(out.hot, d[i] - d[i + 2]);
      out.flash = Math.max(out.flash, d[i + 2]);
      out.bright = Math.max(out.bright, d[i], d[i + 1], d[i + 2]);
    }
    return out;
  }, [x, y, r === Infinity ? 1e6 : r]);
}

const snapshot = (page: Page) => field(page).evaluate((c: HTMLCanvasElement) => c.toDataURL());

/* An empty spot of the stage at 1280×840: left of <main>'s content, below the nav. */
const EMPTY = { x: 20, y: 700 };

test.describe('home binary field', () => {
  test.use({ viewport: { width: 1280, height: 840 } });

  test('is a canvas filling the stage behind the nav and content, and lets every click through', async ({ page }) => {
    await page.goto('/');
    await fieldReady(page); // sharp at the screen's devicePixelRatio (Desktop Safari's is 2)
    const canvas = field(page);
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    const stage = (await page.locator('.t-stage').boundingBox())!;
    expect(await canvas.boundingBox()).toEqual(stage);

    const hit = (x: number, y: number) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)!.className, [x, y]);
    expect(await hit(EMPTY.x, EMPTY.y)).toBe('t-stage');
    const cta = (await page.locator('.home-cta').first().boundingBox())!;
    expect(await hit(cta.x + cta.width / 2, cta.y + cta.height / 2)).toContain('home-cta');

    // the photo frame, not its img: the decode canvas covers the img and hides it outside the hold
    for (const target of [page.getByRole('link', { name: 'experience.log' }), page.locator('.home-cta').nth(1), page.locator('.home-photo')]) {
      await target.click({ trial: true });
    }
    await page.getByRole('button', { name: /Jump to/ }).click();
    await expect(page.getByRole('dialog', { name: 'Jump to a page' })).toBeVisible();
  });

  test('draws a dim grid of 0s and 1s that flickers', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(100);
    const dim = await pixels(page, EMPTY.x, 400, 48);
    expect(dim.bright).toBeGreaterThan(20); // glyphs are there…
    expect(dim.bright).toBeLessThan(60); // …but only at about 7% white
    expect(dim.hot).toBeLessThan(20);

    const before = await snapshot(page);
    await page.clock.runFor(330);
    expect(await snapshot(page)).not.toBe(before);
  });

  test('glows gold around the cursor', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(100);
    expect((await pixels(page, EMPTY.x, EMPTY.y, 24)).hot).toBeLessThan(20);

    await page.mouse.move(EMPTY.x, EMPTY.y);
    await page.clock.runFor(400);
    expect((await pixels(page, EMPTY.x, EMPTY.y, 24)).hot).toBeGreaterThan(100);
    expect((await pixels(page, EMPTY.x, EMPTY.y - 400, 24)).hot).toBeLessThan(20);

    await page.mouse.move(640, 900); // off the stage, onto the footer
    await page.clock.runFor(400);
    expect((await pixels(page, EMPTY.x, EMPTY.y, 24)).hot).toBeLessThan(20);
  });

  test('a click on the background sends a white wave out from the click', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(100);
    await page.mouse.move(EMPTY.x, EMPTY.y);
    await page.clock.runFor(200);
    expect((await pixels(page, EMPTY.x, EMPTY.y, 24)).flash).toBeLessThan(100);

    await page.mouse.click(EMPTY.x, EMPTY.y);
    await page.clock.runFor(160);
    expect((await pixels(page, EMPTY.x, EMPTY.y, 24)).flash).toBeGreaterThan(200);
    expect((await pixels(page, EMPTY.x + 600, EMPTY.y, 24)).flash).toBeLessThan(100);

    await page.clock.runFor(700); // the wave reaches 600px away about 720ms later
    expect((await pixels(page, EMPTY.x, EMPTY.y, 24)).flash).toBeLessThan(100);
    expect((await pixels(page, EMPTY.x + 600, EMPTY.y, 24)).flash).toBeGreaterThan(200);
  });

  test('a click on the content does not send a wave', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(100);
    const card = (await page.locator('.home-term-body').boundingBox())!;
    const at = { x: card.x + card.width - 10, y: card.y + 10 };
    await page.mouse.click(at.x, at.y);
    await page.clock.runFor(160);
    expect((await pixels(page, at.x, at.y, 24)).flash).toBeLessThan(100);
  });

  test('gold formations rise out of the field in turn: eye, Clawd, whale, then the eye again', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(1500);
    expect((await pixels(page)).gold).toBe(0);

    const kinds: string[] = [];
    let litDuringEye = 0;
    for (let t = 1500; t < 42000; t += 500) {
      await page.clock.fastForward(500); // one frame per 500ms: frame by frame, WebKit needs ~40s for this
      const kind = (await field(page).getAttribute('data-formation')) ?? '';
      if (kind && kinds.at(-1) !== kind) kinds.push(kind);
      if (kind === 'eye' && t > 5000 && !litDuringEye) litDuringEye = (await pixels(page)).gold;
    }
    expect(kinds).toEqual(['eye', 'clawd', 'whale', 'eye']);
    expect(litDuringEye).toBeGreaterThan(200);
  });

  test('stops while the tab is hidden and carries on when it is shown again', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(1000);
    const setHidden = (hidden: boolean) => page.evaluate((hidden) => {
      Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: hidden ? 'hidden' : 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

    await setHidden(true);
    const frozen = { field: await snapshot(page), role: await shownRole(page) };
    await page.clock.runFor(4000);
    expect({ field: await snapshot(page), role: await shownRole(page) }).toEqual(frozen);

    await setHidden(false);
    await page.clock.runFor(2500);
    expect(await snapshot(page)).not.toBe(frozen.field);
    expect(await shownRole(page)).not.toBe(frozen.role);
  });

  test('stops while the stage is scrolled off-screen and carries on when it is back', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(1000);
    await page.addStyleTag({ content: 'body { padding-bottom: 3000px; }' });
    await page.evaluate(() => window.scrollTo(0, 2500));
    await expect.poll(() => page.evaluate(() => document.querySelector('.t-stage')!.getBoundingClientRect().bottom)).toBeLessThan(0);
    await page.clock.runFor(200); // let the observer's report land
    const frozen = { field: await snapshot(page), role: await shownRole(page) };
    await page.clock.runFor(4000);
    expect({ field: await snapshot(page), role: await shownRole(page) }).toEqual(frozen);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => { await page.clock.runFor(200); return snapshot(page); }).not.toBe(frozen.field);
    await page.clock.runFor(2500);
    expect(await shownRole(page)).not.toBe(frozen.role);
  });

  test('follows the stage when the window resizes', async ({ page }) => {
    await page.goto('/');
    await fieldReady(page);
    const before = await fieldVsStage(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(async () => (await fieldVsStage(page)).field).not.toEqual(before.field);
    await fieldReady(page);
    expect(await field(page).boundingBox()).toEqual(await page.locator('.t-stage').boundingBox());
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe('home binary field on a 2x screen', () => {
  test.use({ deviceScaleFactor: 2 });

  test('renders at device resolution', async ({ page }) => {
    await page.goto('/');
    await fieldReady(page);
    const { field: [width] } = await fieldVsStage(page);
    expect(width).toBe(Math.round((await page.locator('.t-stage').boundingBox())!.width * 2));
  });
});

test.describe('home motion with reduced motion', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 840 } });

  test('nothing scrambles, types, flickers or forms; the name, first role and a still field show', async ({ page }) => {
    await openPaused(page);
    await page.clock.runFor(100);
    const still = await snapshot(page);
    expect((await pixels(page, EMPTY.x, 400, 48)).bright).toBeGreaterThan(20);

    await page.mouse.move(EMPTY.x, EMPTY.y);
    await page.mouse.click(EMPTY.x, EMPTY.y);
    for (let t = 0; t < 14000; t += 700) {
      await page.clock.runFor(700);
      expect(await shownName(page)).toBe('Luis');
    }
    expect(await snapshot(page)).toBe(still);
    await expect(field(page)).not.toHaveAttribute('data-formation');
    await expect(page.locator('.home-typed')).toHaveCount(0);
    await expect(page.locator('#home-role')).toHaveText('web developer');
    await expect(page.locator('#home-role')).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe('home motion without home.js', () => {
  test('the page still shows the name, the first role and the CTAs', async ({ page }) => {
    await page.route('**/home.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: "Hello, I'm Luis" })).toBeVisible();
    await expect(page.locator('.home-term-body > p').last()).toHaveText('→ web developer');
    await expect(page.locator('#home-role')).toBeVisible();
    await expect(page.locator('.home-cta').first()).toBeVisible();
  });
});
