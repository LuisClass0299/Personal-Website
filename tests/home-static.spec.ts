import { test, expect } from '@playwright/test';

/* The static layout, without the motion scripts: the decode glitch shifts by up to 7px inside the clipped photo frame. */
test.beforeEach(async ({ page }) => {
  await page.route(/\/(home|decode)\.js$/, (route) => route.abort());
});

test.describe('home page hero (static)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('heading greets with the full name in mono gold, ready for the scramble', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText("Hello, I'm Luis");

    const name = page.locator('#home-name');
    await expect(name).toHaveText('Luis');
    expect(await name.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?IBM Plex Mono/);
    expect(await name.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(245, 184, 0)');
  });

  test('terminal card answers whoami, cat focus.txt and echo $ROLE, all visible without motion', async ({ page }) => {
    const card = page.locator('.home-term');

    await expect(card.locator('.home-term-title')).toHaveText('luis@ucf: ~');
    await expect(card.locator('.home-term-body > *')).toHaveText([
      'luis@ucf:~$ whoami',
      'Luis Classe — computer science student @ UCF',
      'luis@ucf:~$ cat focus.txt',
      'web development · software engineering',
      'luis@ucf:~$ echo $ROLE',
      '→ web developer',
    ]);
    for (const line of await card.locator('.home-term-body > *').all()) {
      await expect(line).toBeVisible();
    }
    await expect(page.locator('#home-role')).toHaveText('web developer');
    expect(await card.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(18, 18, 18)');
    expect(await card.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?IBM Plex Mono/);
  });

  test('CTAs go to experience, projects and the resume, with ./experience as the gold primary', async ({ page }) => {
    const ctas = page.getByRole('main').locator('.home-cta');

    await expect(ctas).toHaveText(['./experience', './projects', 'resume.pdf']);
    expect(await ctas.evaluateAll((els) => els.map((el) => el.getAttribute('href')))).toEqual([
      'pages/experience.html',
      'pages/projects.html',
      'assets/resume.pdf',
    ]);
    expect(await ctas.first().evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(245, 184, 0)');
    expect(await ctas.nth(1).evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(51, 51, 51)');
    for (const cta of await ctas.all()) {
      expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    const resume = await page.request.get('assets/resume.pdf');
    expect(resume.ok()).toBe(true);
  });

  test('photo sits in a 320×420 frame with four gold corner brackets and a profile.jpeg / online caption', async ({ page }) => {
    const figure = page.getByRole('main').getByRole('figure');
    const photo = figure.getByRole('img', { name: 'Luis Classe standing in front of the city skyline at night' });

    await expect(photo).toHaveAttribute('src', 'assets/profile.jpeg');
    expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const frame = (await figure.locator('.home-photo-frame').boundingBox())!;
    expect(frame).toMatchObject({ width: 320, height: 420 });

    // each bracket is 22px square, 10px in from its own corner, with gold on its two outer edges
    const corners = figure.locator('.home-photo-corner');
    await expect(corners).toHaveCount(4);
    const placed = [];
    for (const corner of await corners.all()) {
      await expect(corner).toHaveAttribute('aria-hidden', 'true');
      const box = (await corner.boundingBox())!;
      const top = box.y - frame.y === 10;
      const left = box.x - frame.x === 10;
      expect(top || frame.y + frame.height - (box.y + box.height) === 10).toBe(true);
      expect(left || frame.x + frame.width - (box.x + box.width) === 10).toBe(true);
      const style = await corner.evaluate((el) => {
        const s = getComputedStyle(el);
        return { top: s.borderTopWidth, bottom: s.borderBottomWidth, left: s.borderLeftWidth, right: s.borderRightWidth, color: s.borderTopColor };
      });
      expect(style).toEqual({
        top: top ? '2px' : '0px',
        bottom: top ? '0px' : '2px',
        left: left ? '2px' : '0px',
        right: left ? '0px' : '2px',
        color: 'rgb(245, 184, 0)',
      });
      placed.push(`${top ? 't' : 'b'}${left ? 'l' : 'r'}`);
    }
    expect(placed.sort()).toEqual(['bl', 'br', 'tl', 'tr']);

    const caption = figure.locator('figcaption');
    await expect(caption).toHaveText(/profile\.jpeg\s*● online/);
    expect(await caption.locator('.t-accent').textContent()).toBe('● online');
  });
});

test.describe('home hero layout', () => {
  test('at 1280px the intro and the photo sit side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 840 });
    await page.goto('/');
    const intro = (await page.locator('.home-intro').boundingBox())!;
    const frame = (await page.locator('.home-photo-frame').boundingBox())!;

    expect(frame.x).toBeGreaterThan(intro.x + intro.width);
    expect(frame.y).toBeLessThan(intro.y + intro.height);
    expect(await page.getByRole('heading', { level: 1 }).evaluate((el) => getComputedStyle(el).fontSize)).toBe('64px');
  });

  test('at 375px everything stacks inside the viewport with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const intro = (await page.locator('.home-intro').boundingBox())!;
    const frame = (await page.locator('.home-photo-frame').boundingBox())!;
    expect(frame.y).toBeGreaterThanOrEqual(intro.y + intro.height);

    for (const selector of ['h1', '.home-term', '.home-term-body > p', '.home-cta', '.home-photo-frame', '.home-photo figcaption']) {
      for (const el of await page.locator(selector).all()) {
        const box = (await el.boundingBox())!;
        expect(box.x, selector).toBeGreaterThanOrEqual(16);
        expect(box.x + box.width, selector).toBeLessThanOrEqual(375 - 16);
        expect(await el.evaluate((node) => node.scrollWidth <= node.clientWidth), selector).toBe(true);
      }
    }
  });
});

test.describe('home hero with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the hero is fully visible and a hovered CTA changes without transitioning', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('.home-cta').first();
    await cta.hover();

    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await cta.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
    for (const selector of ['#home-name', '#home-role', '.home-term-body > p', '.home-cta', '.home-photo-frame img', '.home-photo-corner']) {
      for (const el of await page.locator(selector).all()) {
        await expect(el).toBeVisible();
        expect(await el.evaluate((node) => getComputedStyle(node).opacity), selector).toBe('1');
      }
    }
  });
});
