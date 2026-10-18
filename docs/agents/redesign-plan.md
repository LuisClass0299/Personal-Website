# Terminal redesign: implementation plan

Rebuild the site in the "terminal" design approved on the design canvas. The work happens on `dev`, one slice per commit, then a single PR `dev` → `main`.

## Source of truth

- Design canvas: https://claude.ai/code/artifact/1b99561f-b3e4-47af-a386-32bf3ed49b1a ("Portfolio Motion Directions").
- Boards: `project/Terminal.dc.html` (Home), `project/Timeline.dc.html` (Experience), `project/Bento.dc.html` (Projects). There is no About board.
- Before each slice, re-read the board you are porting (`Artifact` `read` with `path`), since boards can change between sessions.
- The `.dc.html` files run on the canvas runtime (`DCLogic`, `<sc-for>`, `<sc-if>`, `{{bindings}}`, `/_blob/` image URLs). Port the markup, styles and behaviour into plain HTML/CSS/vanilla JS. The runtime itself does not come along. Blob images map to files in `docs/assets/` (the profile photo is `profile.jpeg`, and the experience logos are `limbitless.png`, `ieee.png` and `bpa.png`).
- The inner-page boards still show the old logo-and-links navbar. Those pages get the Home tab-strip nav instead.

## Locked decisions

- Background: the binary field (0/1 grid that flickers, a gold glow near the cursor, a click wave, and rotating eye / Clawd / whale formations).
- Nav: terminal tabs `home.sh`, `experience.log`, `projects/`, `about.md`, plus a "Jump to ⌘K" button that opens a command palette.
- Logo: the 15×15 pixel scarab as inline SVG (`shape-rendering="crispEdges"`, 32px), replacing `scarab_logo.png`.
- "Luis" glyph scramble plays about 1.2s after load and then every 6s.
- Once a design is picked from options, only the picked one survives.
- Palette: keep the current Scarab Gold tokens (accent `#F5B800`). No palette switch.
- Social links: a row of resume, LinkedIn and GitHub icon links in the footer of every page, alongside "© Luis Classe". They are also items in the ⌘K palette.
- Mobile nav: the tabs scroll sideways, with no hamburger, as in the design. Delete the hamburger and the mobile-menu markup and JS. Mobile may get tweaks after launch, but that's out of scope for these slices.

## Open decisions (ask the user before the slice that needs them)

1. **About page** (slice 8). No board exists. Proposal: an `about.md` page styled as `cat about.md` output, reusing the current about content.

## Technical approach

- The stack stays the same: no framework, no build step.
- **Tokens:** extend `:root` with the design's values: ground `#0d0d0d`, surfaces `#121212`/`#141414`/`#1a1a1a`, accent `#F5B800`, accent hover `#ffd24a`, muted text `#999`/`#bbb`, and `--font-mono` (IBM Plex Mono from Google Fonts).
- **Binary field:** draw it on a `<canvas>`. The board renders about 2,000 DOM spans and re-renders them every 110ms, which only works on the canvas runtime. Port the formation logic (`shape()`, `spawn()`, `flip()`) as-is.
- **Photo decode** (the pixel-burn loop with the `/decode luis` mini terminal): 336 tiles. Pick canvas or CSS tiles in slice 4, after measuring.
- **⌘K palette:** a native `<dialog>`. Ctrl/⌘+K opens it, Esc closes it, and the input takes focus when it opens. It filters the same items as the board (Experience, Projects, About, Resume, GitHub, LinkedIn). It runs on every page.
- **JS layout:** `docs/script.js` holds the shared code (nav and palette). Home-only effects go in `docs/home.js`. Each page loads only the scripts it uses.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, every animation stays still and all content is visible.
- **Relative paths:** pages in `docs/pages/` use `../`. The tab nav is repeated by hand on all four pages (see CLAUDE.md).

## Slices

Each slice is done when: its Playwright tests pass, the page matches its board at 1280px and 375px widths with no horizontal page scroll, and reduced motion leaves it still and readable.

0. **Test harness.** Replace `tests/example.spec.ts`, which tests playwright.dev, with smoke tests against `docs/`: a `webServer` in `playwright.config.ts`, and every page loading with no console errors. Fix the existing bug in `index.html`, which references `assets/ucf.png` while the file is `UCF.png`, so the sticker 404s on Firebase.
1. **Foundations.** Tokens, the mono font, the tab-strip nav with the pixel scarab and the correct `aria-current` on all four pages, the favicon, the footer with its social links, and removing the hamburger and mobile menu.
2. **Home, static.** Hero heading, the terminal card (`whoami` / `cat focus.txt` / `echo $ROLE`), the CTAs (`./experience`, `./projects`, and `resume.pdf` → `assets/resume.pdf`), and the photo frame and caption.
3. **Home, motion.** Name scramble, role typer, and the binary field canvas with hover glow, click wave and formations.
4. **Photo decode effect.**
5. **⌘K palette** on every page.
6. **Experience.** The scroll-drawn timeline, the Details/Less toggles and the tech-stack chips. The content must match the current `experience.html`.
7. **Projects.** Filter chips, tilt cards with glare, and the "View on GitHub" overlay.
8. **About.** Built from open decision 1.
9. **Cleanup and ship.** Remove dead CSS sections and unused assets (`scarab_logo.png`, plus Font Awesome and Devicon if nothing uses them). Update the CLAUDE.md architecture section. Open the PR `dev` → `main` and check the preview channel.

## Progress

- [x] 0 Test harness
- [ ] 1 Foundations
- [ ] 2 Home, static
- [ ] 3 Home, motion
- [ ] 4 Photo decode
- [ ] 5 ⌘K palette
- [ ] 6 Experience
- [ ] 7 Projects
- [ ] 8 About
- [ ] 9 Cleanup and ship
