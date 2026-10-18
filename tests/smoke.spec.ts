import { test, expect } from '@playwright/test';

const pages = [
  { name: 'home', path: '/' },
  { name: 'experience', path: '/pages/experience.html' },
  { name: 'projects', path: '/pages/projects.html' },
  { name: 'about', path: '/pages/about.html' },
];

for (const { name, path } of pages) {
  test(`${name} page loads with no console errors or failed requests`, async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`uncaught: ${err.message}`));
    page.on('requestfailed', (req) => problems.push(`failed: ${req.url()} (${req.failure()?.errorText})`));
    page.on('response', (res) => {
      if (res.status() >= 400) problems.push(`${res.status()}: ${res.url()}`);
    });

    const response = await page.goto(path, { waitUntil: 'load' });

    expect(response?.status()).toBe(200);
    expect(problems).toEqual([]);
  });
}
