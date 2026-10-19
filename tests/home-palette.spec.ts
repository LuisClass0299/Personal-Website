import { test, expect, type Page } from '@playwright/test';

const palette = (page: Page) => page.getByRole('dialog', { name: 'Jump to a page' });
const jumpButton = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /Jump to/ });

// The deferred terminal.js has run by DOMContentLoaded; waiting for "load" also waits on
// Google Fonts, which under parallel load sometimes stalls Firefox past the test timeout.
const openHome = (page: Page) => page.goto('/', { waitUntil: 'domcontentloaded' });

test.describe('home ⌘K palette', () => {
  test.beforeEach(async ({ page }) => {
    await openHome(page);
  });

  test('is closed until the nav button opens it, with the search input focused', async ({ page }) => {
    await expect(palette(page)).toBeHidden();

    await jumpButton(page).click();

    await expect(palette(page)).toBeVisible();
    await expect(palette(page).getByRole('combobox')).toBeFocused();
  });

  test('Esc closes it and focus goes back to the nav button', async ({ page }) => {
    await jumpButton(page).click();
    await expect(palette(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(palette(page)).toBeHidden();
    await expect(jumpButton(page)).toBeFocused();
  });

  for (const shortcut of ['Control+k', 'Meta+k']) {
    test(`${shortcut} opens it from anywhere, and Esc hands focus back to where it was`, async ({ page }) => {
      const github = page.getByRole('contentinfo').getByRole('link', { name: 'GitHub' });
      await github.focus();

      await page.keyboard.press(shortcut);

      await expect(palette(page)).toBeVisible();
      await expect(palette(page).getByRole('combobox')).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(palette(page)).toBeHidden();
      await expect(github).toBeFocused();
    });
  }

  test('lists the six destinations, opening external ones in a new tab like the footer', async ({ page }) => {
    await jumpButton(page).click();
    const options = palette(page).getByRole('listbox').getByRole('option');

    await expect(options).toHaveCount(6);
    for (const [name, href, newTab] of [
      ['Experience', 'pages/experience.html', false],
      ['Projects', 'pages/projects.html', false],
      ['About', 'pages/about.html', false],
      ['Resume', 'assets/resume.pdf', true],
      ['GitHub', 'https://github.com/LuisClass0299', true],
      ['LinkedIn', 'https://www.linkedin.com/in/luis-classe', true],
    ] as const) {
      const option = options.filter({ hasText: name });
      await expect(option).toHaveAttribute('href', href);
      if (newTab) await expect(option).toHaveAttribute('target', '_blank');
      else await expect(option).not.toHaveAttribute('target');
    }
  });

  test('typing filters the items by name or command, and says when nothing matches', async ({ page }) => {
    await jumpButton(page).click();
    const input = palette(page).getByRole('combobox');
    const visible = palette(page).getByRole('option');

    await input.fill('pro');
    await expect(visible).toHaveText([/^Projects/]);

    await input.fill('OPEN');
    await expect(visible).toHaveText([/^Resume/, /^GitHub/, /^LinkedIn/]);

    await input.fill('cd ~/a');
    await expect(visible).toHaveText([/^About/]);

    await input.fill('zzz');
    await expect(visible).toHaveCount(0);
    await expect(palette(page).getByText('command not found: zzz')).toBeVisible();

    await input.fill('');
    await expect(visible).toHaveCount(6);
    await expect(palette(page).getByText('command not found')).toBeHidden();
  });

  test('reopens with an empty search', async ({ page }) => {
    await jumpButton(page).click();
    await palette(page).getByRole('combobox').fill('git');
    await page.keyboard.press('Escape');

    await jumpButton(page).click();

    await expect(palette(page).getByRole('combobox')).toHaveValue('');
    await expect(palette(page).getByRole('option')).toHaveCount(6);
  });

  test('arrow keys move the active item, which the input points at, wrapping round the ends', async ({ page }) => {
    await jumpButton(page).click();
    const input = palette(page).getByRole('combobox');
    const active = async () => {
      const id = await input.getAttribute('aria-activedescendant');
      const option = page.locator(`[id="${id}"]`);
      await expect(option).toHaveAttribute('aria-selected', 'true');
      await expect(palette(page).locator('[aria-selected="true"]')).toHaveCount(1);
      return (await option.textContent())!.trim().split(' ')[0];
    };

    await expect(input).toHaveAttribute('aria-controls', (await palette(page).getByRole('listbox').getAttribute('id'))!);
    expect(await active()).toBe('Experience');
    await page.keyboard.press('ArrowDown');
    expect(await active()).toBe('Projects');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    expect(await active()).toBe('LinkedIn');
    await page.keyboard.press('ArrowDown');
    expect(await active()).toBe('Experience');

    await input.fill('open');
    expect(await active()).toBe('Resume');
    await page.keyboard.press('ArrowUp');
    expect(await active()).toBe('LinkedIn');
    await expect(input).toBeFocused();
  });

  test('hovering an item makes it the active one, so only one row is ever highlighted', async ({ page }) => {
    await jumpButton(page).click();
    await page.keyboard.press('ArrowDown');

    await palette(page).getByRole('option', { name: /^GitHub/ }).hover();

    await expect(palette(page).locator('[aria-selected="true"]')).toHaveText(/^GitHub/);
    await expect(palette(page).getByRole('combobox')).toHaveAttribute('aria-activedescendant', (await palette(page).getByRole('option', { name: /^GitHub/ }).getAttribute('id'))!);
  });

  test('Enter opens the active page', async ({ page }) => {
    await jumpButton(page).click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/pages\/projects\.html$/);
  });

  test('Enter on an external item opens it in a new tab and closes the palette', async ({ page, context }) => {
    await context.route('https://github.com/**', (route) => route.fulfill({ body: 'github' }));
    await jumpButton(page).click();
    await palette(page).getByRole('combobox').fill('git');

    const [tab] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')]);

    expect(tab.url()).toBe('https://github.com/LuisClass0299');
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Enter with nothing matching does nothing', async ({ page }) => {
    await jumpButton(page).click();
    await palette(page).getByRole('combobox').fill('zzz');
    await page.keyboard.press('Enter');

    await expect(palette(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('clicking an item opens it', async ({ page }) => {
    await jumpButton(page).click();
    await palette(page).getByRole('option', { name: /^About/ }).click();

    await expect(page).toHaveURL(/\/pages\/about\.html$/);
  });

  test('clicking the backdrop closes it', async ({ page }) => {
    await jumpButton(page).click();
    await page.mouse.click(10, 700);

    await expect(palette(page)).toBeHidden();
    await expect(jumpButton(page)).toBeFocused();
  });

  test('the close button closes it', async ({ page }) => {
    await jumpButton(page).click();
    await palette(page).getByRole('button', { name: 'Close' }).click();

    await expect(palette(page)).toBeHidden();
    await expect(jumpButton(page)).toBeFocused();
  });
});

test.describe('home ⌘K palette on a 375px phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('fits the screen, with every item fully inside it and no sideways scroll', async ({ page }) => {
    await openHome(page);
    await jumpButton(page).click();

    const dialogBox = (await palette(page).boundingBox())!;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(375);
    for (const option of await palette(page).getByRole('option').all()) {
      const box = (await option.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(dialogBox.x);
      expect(box.x + box.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
      expect(await option.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    expect(await palette(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe('home ⌘K palette with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('opens and closes without animating', async ({ page }) => {
    await openHome(page);
    await jumpButton(page).click();
    await expect(palette(page)).toBeVisible();
    await palette(page).getByRole('option').first().hover();

    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    expect(await palette(page).getByRole('option').first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');

    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});
