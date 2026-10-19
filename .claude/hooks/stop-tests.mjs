// Stop hook: keeps Claude from finishing while the Playwright suite fails.
// Skips the run when the tested files haven't changed since the last green run,
// and gives up blocking after MAX_BLOCKS consecutive failures so it can't loop forever.
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_BLOCKS = 3;
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}

const key = createHash('sha1').update(projectDir).digest('hex').slice(0, 12);
const passFile = join(tmpdir(), `claude-stop-tests-${key}.pass`);
const blockFile = join(tmpdir(), `claude-stop-tests-${key}-${input.session_id || 'nosession'}.blocks`);

function fingerprint() {
  const files = execFileSync(
    'git',
    ['ls-files', '-co', '--exclude-standard', '-z', '--', 'docs', 'tests', 'playwright.config.ts', 'package-lock.json'],
    { cwd: projectDir, encoding: 'utf8' },
  ).split('\0').filter(Boolean).sort();
  const hash = createHash('sha1');
  for (const f of files) {
    hash.update(f);
    try { hash.update(readFileSync(join(projectDir, f))); } catch {}
  }
  return hash.digest('hex');
}

const fp = fingerprint();
if (existsSync(passFile) && readFileSync(passFile, 'utf8') === fp) process.exit(0);

const run = spawnSync('npx playwright test --reporter=line', {
  cwd: projectDir,
  shell: true,
  encoding: 'utf8',
  timeout: 280_000,
});

if (run.status === 0) {
  writeFileSync(passFile, fp);
  rmSync(blockFile, { force: true });
  process.exit(0);
}

const blocks = existsSync(blockFile) ? Number(readFileSync(blockFile, 'utf8')) || 0 : 0;
const output = `${run.stdout || ''}${run.stderr || ''}`.trim().split('\n').slice(-40).join('\n');

if (blocks >= MAX_BLOCKS) {
  rmSync(blockFile, { force: true });
  console.log(JSON.stringify({
    systemMessage: `Playwright tests are still failing after ${MAX_BLOCKS} fix attempts; letting Claude stop. Run \`npx playwright test\` to see the failures.`,
  }));
  process.exit(0);
}

writeFileSync(blockFile, String(blocks + 1));
console.log(JSON.stringify({
  decision: 'block',
  reason: `Playwright tests are failing (attempt ${blocks + 1}/${MAX_BLOCKS}). Fix them before finishing, or explain to the user why they can't be fixed.\n\n${output}`,
}));
