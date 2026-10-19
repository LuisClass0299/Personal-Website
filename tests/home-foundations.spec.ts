import { test, expect } from '@playwright/test';

test.describe('home page foundations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('nav shows the four terminal tabs linking to the current pages, with home.sh current', async ({ page }) => {
    const tabs = page.getByRole('navigation', { name: 'Main' }).locator('.t-tab');

    await expect(tabs).toHaveText(['home.sh', 'experience.log', 'projects/', 'about.md']);
    expect(await tabs.evaluateAll((els) => els.map((el) => el.getAttribute('href')))).toEqual([
      'index.html',
      'pages/experience.html',
      'pages/projects.html',
      'pages/about.html',
    ]);
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
    expect((await page.getByRole('navigation', { name: 'Main' }).boundingBox())?.y).toBe(0);
  });

  test('logo is the 32px pixel scarab drawn inline, not the old PNG', async ({ page }) => {
    const logo = page.getByRole('navigation', { name: 'Main' }).getByRole('img', { name: 'Scarab logo' });

    await expect(logo).toHaveAttribute('shape-rendering', 'crispEdges');
    expect(await logo.evaluate((el) => el.tagName.toLowerCase())).toBe('svg');
    expect(await logo.boundingBox()).toMatchObject({ width: 32, height: 32 });
    await expect(page.locator('img[src*="scarab_logo"]')).toHaveCount(0);
  });

  test('favicon is the gold scarab as an SVG', async ({ page }) => {
    const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');

    expect(href).toMatch(/^data:image\/svg\+xml,/);
    const svg = decodeURIComponent(href!.slice('data:image/svg+xml,'.length));
    expect(svg).toContain('crispEdges');
    expect(svg).toContain('#F5B800');
  });

  test('nav has the "Jump to ⌘K" palette button', async ({ page }) => {
    const jump = page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Jump to/ });

    await expect(jump).toBeVisible();
    await expect(jump).toContainText('⌘K');
    await expect(jump).toHaveAttribute('type', 'button');
  });

  test('drops the old navbar, hamburger, mobile menu and shared stylesheet/script', async ({ page }) => {
    await expect(page.locator('.hamburger, .mobile-menu, .close-btn, .navbar')).toHaveCount(0);
    await expect(page.locator('link[href$="style.css"], script[src$="script.js"]')).toHaveCount(0);
    await expect(page.locator('link[href="terminal.css"]')).toHaveCount(1);
    await expect(page.locator('script[src="terminal.js"]')).toHaveCount(1);
  });

  test('nav and footer use IBM Plex Mono', async ({ page }) => {
    for (const selector of ['nav', 'footer']) {
      expect(await page.locator(selector).evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?IBM Plex Mono/);
    }
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((face) => face.family.includes('IBM Plex Mono') && face.status === 'loaded');
    });
    expect(loaded).toBe(true);
  });

  test('footer carries the copyright and the resume, LinkedIn and GitHub links', async ({ page }) => {
    const footer = page.getByRole('contentinfo');

    await expect(footer).toContainText('© Luis Classe');
    for (const [name, href] of [
      ['Resume', 'assets/resume.pdf'],
      ['LinkedIn', 'https://www.linkedin.com/in/luis-classe'],
      ['GitHub', 'https://github.com/LuisClass0299'],
    ]) {
      const link = footer.getByRole('link', { name });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toBeVisible();
    }
  });
});

test.describe('home page on a 375px phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('has no horizontal page scroll; the tabs scroll sideways inside their strip', async ({ page }) => {
    await page.goto('/');

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    const strip = page.locator('.t-tabs');
    expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const lastTab = strip.getByRole('link', { name: 'about.md' });
    await lastTab.scrollIntoViewIfNeeded();
    await expect(lastTab).toBeInViewport({ ratio: 0.95 }); // subpixel tab widths keep it just under 1
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    for (const control of [
      page.getByRole('img', { name: 'Scarab logo' }),
      page.getByRole('button', { name: /Jump to/ }),
      page.getByRole('contentinfo').getByRole('link', { name: 'GitHub' }),
    ]) {
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  });

  test('the current tab opens onto the page, with the ⌘K button up on the logo row', async ({ page }) => {
    await page.goto('/');
    const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
    const current = (await page.locator('.t-tab[aria-current="page"]').boundingBox())!;
    const logo = (await page.getByRole('img', { name: 'Scarab logo' }).boundingBox())!;
    const jump = (await page.getByRole('button', { name: /Jump to/ }).boundingBox())!;

    expect(Math.abs(current.y + current.height - (nav.y + nav.height))).toBeLessThanOrEqual(1);
    expect(jump.y + jump.height).toBeLessThanOrEqual(current.y);
    expect(Math.abs(jump.y + jump.height / 2 - (logo.y + logo.height / 2))).toBeLessThanOrEqual(2);
  });
});

test.describe('home page with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing animates or transitions', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'experience.log' }).hover();
    await page.getByRole('button', { name: /Jump to/ }).hover();

    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    for (const selector of ['.t-tab', '.t-jump', '.t-social a']) {
      expect(await page.locator(selector).first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
    }
  });
});
