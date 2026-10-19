import { test, expect, type Page } from '@playwright/test';

// The board's loop: hold 2600 → out 2600 → gap 1900 → in 2200 → sharp 450 → hold…
const HOLD = 2600;
const OUT = 2600;
const GAP = 1900;
const IN = 2200;
const SHARP = 450;

/* Loads the home page with time frozen, so the decode loop only moves when the test runs the clock. */
async function loadWithFrozenClock(page: Page) {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto('/');
  await expect(page.locator('.home-photo')).toHaveAttribute('data-decode', 'hold');
}

/* Waits out the mini terminal's open animation, so its box is measured unscaled. */
async function openTerminal(page: Page) {
  const term = page.locator('.home-decode-term');
  await term.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  return term;
}

test.describe('home photo decode', () => {
  test('a decorative effect layer sits over the photo, which keeps its alt text', async ({ page }) => {
    await page.goto('/');
    const frame = page.locator('.home-photo-frame');
    const photo = frame.getByRole('img', { name: 'Luis Classe standing in front of the city skyline at night' });
    const layer = frame.locator('canvas.home-decode-canvas');

    await expect(photo).toBeVisible();
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(await layer.boundingBox()).toEqual(await frame.boundingBox());
    // the layer is painted above the photo, and the gold corners above both
    const order = await frame.evaluate((el) => [...el.children].map((child) => child.tagName.toLowerCase() + (child.className ? '.' + child.className : '')));
    expect(order.indexOf('canvas.home-decode-canvas')).toBeGreaterThan(order.indexOf('img'));
    expect(order.indexOf('canvas.home-decode-canvas')).toBeLessThan(order.findIndex((name) => name.includes('home-photo-corner')));
  });

  test('the loop holds the photo, burns it out, pauses, decodes it back in and sharpens, on the board timing', async ({ page }) => {
    await loadWithFrozenClock(page);
    const figure = page.locator('.home-photo');
    const photo = figure.locator('img');
    // alpha of the canvas pixel at the frame's centre: the tiles paint the photo while it is decoding
    const painted = () => page.locator('.home-decode-canvas').evaluate((canvas: HTMLCanvasElement) =>
      canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3]);

    const expectPhase = async (phase: string) => expect(figure).toHaveAttribute('data-decode', phase);
    // each check lands 50ms before or after a phase boundary
    await page.clock.runFor(HOLD - 50);
    await expectPhase('hold');
    await expect(photo).toBeVisible();
    expect(await painted()).toBe(0);

    await page.clock.runFor(100);
    await expectPhase('out');
    await expect(photo).toBeHidden();
    expect(await painted()).toBe(255);

    await page.clock.runFor(OUT - 100);
    await expectPhase('out');
    await page.clock.runFor(100);
    await expectPhase('gap');
    expect(await painted()).toBe(0);

    await page.clock.runFor(GAP - 100);
    await expectPhase('gap');
    await page.clock.runFor(100);
    await expectPhase('in');

    await page.clock.runFor(IN - 100);
    await expectPhase('in');
    expect(await painted()).toBe(255);
    await page.clock.runFor(100);
    await expectPhase('sharp');

    await page.clock.runFor(SHARP - 100);
    await expectPhase('sharp');
    await page.clock.runFor(100);
    await expectPhase('hold');
    await expect(photo).toBeVisible();
    expect(await painted()).toBe(0);

    // and round again
    await page.clock.runFor(HOLD);
    await expectPhase('out');
  });

  test('a gold glitch flickers over the photo as it starts to burn out and as it sharpens', async ({ page }) => {
    await loadWithFrozenClock(page);
    const glitch = page.locator('.home-photo-frame .home-decode-glitch');
    const glitching = () => glitch.evaluate((el) => el.getAnimations().length > 0);

    await expect(glitch).toHaveAttribute('aria-hidden', 'true');
    expect(await glitching()).toBe(false);
    await page.clock.runFor(HOLD + 50);
    expect(await glitching()).toBe(true);
    await page.clock.runFor(OUT + GAP + IN);
    expect(await glitching()).toBe(true);
    await page.clock.runFor(SHARP);
    expect(await glitching()).toBe(false);
  });

  test('a decorative mini terminal types /decode luis while the photo is gone and prints the decode', async ({ page }) => {
    await loadWithFrozenClock(page);
    const term = page.locator('.home-decode-term');
    const command = term.locator('.home-decode-cmd');
    const caret = term.locator('.home-decode-caret');
    const output = term.locator('.home-decode-out');

    await expect(term).toHaveAttribute('aria-hidden', 'true');
    await expect(term).toBeHidden();
    await page.clock.runFor(HOLD + OUT - 50);
    await expect(term).toBeHidden();

    // gap: the window opens and types the command
    await page.clock.runFor(100);
    await expect(term).toBeVisible();
    await expect(term.locator('.home-decode-title')).toHaveText('luis@ucf: ~/decode');
    await expect(term.locator('p').first()).toHaveText('luis@ucf:~$ /decode luis');
    await expect(command).toBeVisible();
    await expect(caret).toBeVisible();
    await expect(output).toHaveCount(2);
    for (const line of await output.all()) await expect(line).toBeHidden();

    // in: the caret goes and the decode prints, "luis" in binary then the ok line
    await page.clock.runFor(GAP);
    await expect(caret).toBeHidden();
    await expect(output).toHaveText(['01101100 01110101 01101001 01110011', '[ok] profile.jpeg restored']);
    for (const line of await output.all()) await expect(line).toBeVisible();

    // sharp: still on screen while it fades out, then gone for the hold
    await page.clock.runFor(IN);
    await expect(term).toBeVisible();
    await page.clock.runFor(SHARP);
    await expect(term).toBeHidden();
  });

  test('the loop pauses while the tab is hidden and picks up where it was', async ({ page }) => {
    await loadWithFrozenClock(page);
    const figure = page.locator('.home-photo');
    const setHidden = (hidden: boolean) => page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

    await page.clock.runFor(HOLD - 600);
    await setHidden(true);
    await page.clock.runFor(OUT + GAP);
    await expect(figure).toHaveAttribute('data-decode', 'hold');

    await setHidden(false);
    await page.clock.runFor(500);
    await expect(figure).toHaveAttribute('data-decode', 'hold');
    await page.clock.runFor(200);
    await expect(figure).toHaveAttribute('data-decode', 'out');
  });

  test('the loop pauses while the photo is scrolled off-screen, CSS animations included', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 400 });
    await loadWithFrozenClock(page);
    const figure = page.locator('.home-photo');
    await expect(figure).toHaveClass(/\bis-paused\b/);
    await page.clock.runFor(HOLD + OUT);
    await expect(figure).toHaveAttribute('data-decode', 'hold');

    await figure.scrollIntoViewIfNeeded();
    await expect(figure).not.toHaveClass(/\bis-paused\b/);
    await page.clock.runFor(HOLD + OUT + 100);
    await expect(figure).toHaveAttribute('data-decode', 'gap');

    // scrolled away mid-gap: the terminal's typing animation freezes too
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(figure).toHaveClass(/\bis-paused\b/);
    await page.clock.runFor(GAP);
    await expect(figure).toHaveAttribute('data-decode', 'gap');
    const states = await page.locator('.home-decode-term').evaluate((el) =>
      el.getAnimations({ subtree: true }).map((animation) => animation.playState));
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((state) => state === 'paused')).toBe(true);
  });

  test('on desktop the mini terminal overlaps the photo\'s lower left, as on the board', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 840 });
    await loadWithFrozenClock(page);
    await page.clock.runFor(HOLD + OUT + 100);

    const figure = (await page.locator('.home-photo').boundingBox())!;
    const term = (await (await openTerminal(page)).boundingBox())!;
    expect(term.x - figure.x).toBe(-40);
    expect(Math.round(figure.y + figure.height - (term.y + term.height))).toBe(76);
    expect(term.width).toBe(300);
  });

  test('at 375px the open mini terminal stays inside the page gutters with no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loadWithFrozenClock(page);
    await page.locator('.home-photo').scrollIntoViewIfNeeded();
    await page.clock.runFor(HOLD + OUT + 100);
    const term = await openTerminal(page);
    await expect(term).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const box = (await term.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(375 - 16);
  });

  test('if decode.js never arrives, the plain photo stays and nothing else shows', async ({ page }) => {
    await page.route('**/decode.js', (route) => route.abort());
    await page.clock.install({ time: 0 });
    await page.goto('/');
    await page.clock.runFor(HOLD + OUT + GAP);

    await expect(page.locator('.home-photo')).not.toHaveAttribute('data-decode');
    await expect(page.getByRole('img', { name: 'Luis Classe standing in front of the city skyline at night' })).toBeVisible();
    await expect(page.locator('.home-decode-term')).toBeHidden();
  });
});

test.describe('home photo decode with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the photo stays still and whole, with no loop and no mini terminal', async ({ page }) => {
    await page.clock.install({ time: 0 });
    await page.goto('/');
    await page.clock.runFor(HOLD + OUT + GAP);

    const figure = page.locator('.home-photo');
    await expect(figure).not.toHaveAttribute('data-decode');
    const photo = figure.locator('img');
    await expect(photo).toBeVisible();
    expect(await photo.evaluate((img) => getComputedStyle(img).opacity)).toBe('1');
    await expect(page.locator('.home-decode-term')).toBeHidden();
    expect(await figure.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });
});
