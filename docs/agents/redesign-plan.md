# Terminal redesign: implementation plan

Rebuild the site in the "terminal" design approved on the design canvas. The work happens on `dev`, one slice per commit, then a single PR `dev` → `main`.

## Scope: home page only

Only the home page gets redesigned for now. The inner-page designs aren't final yet, so `docs/pages/*.html` stay as they are. Slices 6–8 are on hold until the user signs off on those designs.

The old pages share `docs/style.css` and `docs/script.js`, so the home page moves to new files and the old ones stay as they are:

- `docs/terminal.css`: the terminal design's tokens, nav, footer and palette styles, plus the home styles. `index.html` loads this file and no longer loads `style.css`.
- `docs/terminal.js`: the shared terminal code (nav and ⌘K palette), which the inner pages will load once they're redesigned.
- `docs/home.js`: the home-only effects (slice 3). The photo decode (slice 4) goes in `docs/decode.js`, so the two slices can run in parallel.

Don't edit `style.css`, `script.js` or anything in `docs/pages/`. Links from the home nav and the palette go to the current inner pages.

## Source of truth

- Design canvas: https://claude.ai/code/artifact/1b99561f-b3e4-47af-a386-32bf3ed49b1a ("Portfolio Motion Directions").
- Boards: `project/Terminal.dc.html` (Home), `project/Timeline.dc.html` (Experience), `project/Bento.dc.html` (Projects). There is no About board.
- Before each wave, the orchestrator re-reads the board being ported (`Artifact` `read` with `path`), since boards can change between sessions, and writes each slice's brief from it (see "Agent budget"). Agents read their brief, not the board.
- The `.dc.html` files run on the canvas runtime (`DCLogic`, `<sc-for>`, `<sc-if>`, `{{bindings}}`, `/_blob/` image URLs). Port the markup, styles and behaviour into plain HTML/CSS/vanilla JS. The runtime itself does not come along. Blob images map to files in `docs/assets/` (the profile photo is `profile.jpeg`, and the experience logos are `limbitless.png`, `ieee.png` and `bpa.png`).
- The inner-page boards still show the old logo-and-links navbar. Those pages get the Home tab-strip nav instead, once they're redesigned.

## Locked decisions

- Background: the binary field (0/1 grid that flickers, a gold glow near the cursor, a click wave, and rotating eye / Clawd / whale formations).
- Nav: terminal tabs `home.sh`, `experience.log`, `projects/`, `about.md`, plus a "Jump to ⌘K" button that opens a command palette.
- Logo: the 15×15 pixel scarab as inline SVG (`shape-rendering="crispEdges"`, 32px), replacing `scarab_logo.png` on the home page.
- "Luis" glyph scramble plays about 1.2s after load and then every 6s.
- Once a design is picked from options, only the picked one survives.
- Palette: keep the current Scarab Gold tokens (accent `#F5B800`). No palette switch.
- Social links: a row of resume, LinkedIn and GitHub icon links in the footer, alongside "© Luis Classe". They are also items in the ⌘K palette.
- Mobile nav: the tabs scroll sideways, with no hamburger, as in the design. The home page drops the hamburger and mobile-menu markup. Mobile may get tweaks after launch, but that's out of scope for these slices.

## Open decisions (ask the user before the slice that needs them)

1. **About page** (slice 8, on hold). No board exists. Proposal: an `about.md` page styled as `cat about.md` output, reusing the current about content.

## Technical approach

- The stack stays the same: no framework, no build step.
- **Tokens:** define on `:root` in `terminal.css` the design's values: ground `#0d0d0d`, surfaces `#121212`/`#141414`/`#1a1a1a`, accent `#F5B800`, accent hover `#ffd24a`, muted text `#999`/`#bbb`, and `--font-mono` (IBM Plex Mono from Google Fonts).
- **Binary field:** draw it on a `<canvas>`. The board renders about 2,000 DOM spans and re-renders them every 110ms, which only works on the canvas runtime. Port the formation logic (`shape()`, `spawn()`, `flip()`) as-is.
- **Photo decode** (the pixel-burn loop with the `/decode luis` mini terminal): 336 tiles, drawn on one `<canvas>` over the real `<img>`. Slice 4 measured both options over one loop in headless Chromium. CSS tiles needed 1,698 DOM nodes, about twice the CPU of canvas, and had 72–82 frames over 20ms against 1–4 for canvas. Under 4× CPU throttling their worst frame was 383–483ms, against 50–100ms for canvas.
- **⌘K palette:** a native `<dialog>`. Ctrl/⌘+K opens it, Esc closes it, and the input takes focus when it opens. It filters the same items as the board (Experience, Projects, About, Resume, GitHub, LinkedIn). For now it runs on the home page only.
- **JS layout:** see "Scope" above. Each page loads only the scripts it uses.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, every animation stays still and all content is visible.
- **Tests:** home-page tests go in their own spec files under `tests/` (for example `tests/home-nav.spec.ts`), one file per slice, so parallel slices don't conflict. `tests/smoke.spec.ts` must stay green for all four pages. The test server's port comes from `PORT` (default 4173), so parallel worktrees can each use their own: `PORT=4201 npx playwright test`.

## Slices

Each slice is done when: its Playwright tests pass, the page matches its brief at 1280px and 375px widths with no horizontal page scroll, and reduced motion leaves it still and readable.

0. **Test harness.** Replace `tests/example.spec.ts`, which tests playwright.dev, with smoke tests against `docs/`: a `webServer` in `playwright.config.ts`, and every page loading with no console errors. Fix the existing bug in `index.html`, which references `assets/ucf.png` while the file is `UCF.png`, so the sticker 404s on Firebase.
1. **Foundations** (home page only). Create `terminal.css` with the tokens and the mono font, and switch `index.html` from `style.css`/`script.js` to `terminal.css`/`terminal.js`. Add the tab-strip nav with the pixel scarab and `aria-current` on `home.sh`, the favicon, and the footer with its social links. Remove the hamburger and mobile menu from `index.html`. The "Jump to ⌘K" button is present but only does something after slice 5.
2. **Home, static.** Hero heading, the terminal card (`whoami` / `cat focus.txt` / `echo $ROLE`), the CTAs (`./experience`, `./projects`, and `resume.pdf` → `assets/resume.pdf`), and the photo frame and caption.
3. **Home, motion.** Name scramble, role typer, and the binary field canvas with hover glow, click wave and formations.
4. **Photo decode effect.**
5. **⌘K palette** on the home page, in `terminal.js`, opened by the nav button and Ctrl/⌘+K.
6. **Experience** (on hold). The content must match the current `experience.html`. Split in two (see "Agent budget"):
   - 6a. The page itself and the scroll-drawn timeline.
   - 6b. The Details/Less toggles and the tech-stack chips.
7. **Projects** (on hold). Split in two:
   - 7a. The page itself and the filter chips.
   - 7b. Tilt cards with glare, and the "View on GitHub" overlay.
8. **About** (on hold). Built from open decision 1.
9. **Cleanup and ship.** Delete assets that no page references anymore (scarab_logo.png, Font Awesome and the old CSS/JS stay while the inner pages still use them). Update the CLAUDE.md architecture section. Open the PR `dev` → `main` with ECC's `/pr main` (push and create), writing the body with the `pr` skill's template, and check the preview channel URL that CI comments on the PR. The user approves and merges it.

## Waves

The slices run as parallel background agents, one wave at a time. Spawn each as the `slice-builder` agent (`.claude/agents/slice-builder.md`, which runs on Sonnet) with `isolation: "worktree"`, and keep the prompt to the slice number, its brief's path, its branch name and its `PORT`. Each agent works in its own git worktree, runs `npm ci` there, and uses its own `PORT`. Worktrees are cut from `main`, so the agent's first step is `git checkout -b slice-N-name dev`. A hook blocks `git reset --hard`, so the agent can't move the worktree's own branch; it stays empty and can be deleted after the merge. Commit messages say only what changed: no `Co-Authored-By` line and no mention of Claude. Agents don't run `/simplify`. The orchestrator merges each branch into `dev` in slice order, runs `/simplify` once on the wave's merged changes, runs the full suite and ticks the box below.

1. Slice 1.
2. Slices 2 and 5.
3. Slices 3 and 4.
4. Slice 9 (in the main checkout on `dev`, not a worktree).

## Agent budget

Each agent should finish well under 120k tokens. Slice 3's agent used about 200k, most of it re-sending its context through long debugging rounds.

- **Brief, not board.** Before the wave, the orchestrator writes `docs/agents/briefs/slice-N.md` with only that slice's part of the board: markup, styles and logic, already free of the canvas runtime, plus the asset mapping and the answer to any open decision. The agent reads its brief, this plan's "Technical approach" and "Lessons learned", and the files it edits. It doesn't read the board or other slices' code.
- **Small slices.** A slice ports at most two effects. Split a bigger one before its wave, as 6 and 7 are.
- **Narrow test runs.** While iterating, run only the slice's own spec in Chromium: `PORT=<own port> npx playwright test tests/<spec> --project=chromium`. Run the full suite in all three browsers once, before committing. When something fails in one browser only, rerun just that test in that browser.
- **Debug budget.** After 3 failed attempts at the same failure, stop. Commit the work in progress on the slice branch with a message starting `WIP:`, and report what fails, what was tried and the likeliest cause. The orchestrator decides the next step.
- **Short reports.** The final report gives the commit, the files changed, the test result, differences from the brief and merge notes. No account of the process.

## Progress

- [x] 0 Test harness
- [x] 1 Foundations
- [x] 2 Home, static
- [x] 3 Home, motion
- [x] 4 Photo decode
- [x] 5 ⌘K palette
- [ ] 6 Experience (on hold)
- [ ] 7 Projects (on hold)
- [ ] 8 About (on hold)
- [ ] 9 Cleanup and ship

## Lessons learned

Read this before starting a slice. Add to it when a slice turns up something the next agent would otherwise have to rediscover.

**Motion.** These are slice 4's rules, and slices 3, 6 and 7 follow them too:

- An effect starts only once its inputs are ready (for example after `img.decode()`), and never under reduced motion.
- It pauses while the tab is hidden (`visibilitychange`) and while it is off-screen (`IntersectionObserver`). Its clock advances only while it runs, so after a pause it resumes where it stopped.
- A canvas stops drawing while nothing on it changes.
- Prefix each slice's keyframes with its own name (`home-decode-*`) so parallel slices can't clash.
- A layer added over content gets `aria-hidden`, and the content underneath keeps its alt text.
- Resting styles equal each animation's end state, so the text stays readable if animations are switched off partway through.

**Browser gotchas:**

- The `hidden` attribute doesn't hide an `<svg>`. An SVG sprite needs `style="display: none"`, or it pushes the page down.
- Safari doesn't focus a button when you click it. Code that returns focus to the trigger has to be told which button was clicked.
- Safari's canvas has no `ctx.filter`. Compute filtered copies (for example the sepia burn) from the pixels once.
- WebKit can run `defer` scripts before the stylesheets apply, so CSS custom properties read as `""` and layout is unstyled. Code that reads tokens or measures layout waits for `load`.
- Shared keyframes (`home-blink`, `home-line`) live in slice 3's section. Reuse them instead of adding identical slice-prefixed copies.

**Tests:**

- Drive timed effects with `page.clock`, and check each phase 50ms either side of its boundary.
- Under the fake clock every `requestAnimationFrame` costs about 6ms (Chromium) to 16ms (WebKit) whatever the page draws. For long stretches of fake time use `clock.fastForward`, which fires one frame per jump, not `runFor`.
- A page with several effects runs them all at once. Each effect's spec blocks the other effects' scripts with `page.route(..., r => r.abort())` in a `beforeEach`. Fake-clock specs also get `test.describe.configure({ timeout: 90_000 })`, because `page.route` and other workers make WebKit and Firefox step the clock far slower.
- Don't point click checks at an element another effect covers (the photo `img` sits under the decode canvas); target its container.
- `document.fonts.check` passes even when the font never loads. To check a font, look for a loaded face in `document.fonts`.
- Cover a script failing to load: block it with `page.route(..., r => r.abort())`, and the page should still show its static content.

**Inner pages** (slices 6–8):

- Reuse slice 1's `.t-*` nav and footer classes and the `:root` tokens in `terminal.css`.
- To adopt the ⌘K palette:
  - keep a `<button class="t-jump" type="button">` in the page's nav;
  - copy the `<dialog class="t-palette">` block from `index.html`, rewriting the relative hrefs for the page's depth (`experience.html`, `../assets/resume.pdf`, …);
  - load `../terminal.css` and `<script src="../terminal.js" defer>`.
- `terminal.js` reads the palette items from the markup and does nothing on a page without a `.t-palette`.
