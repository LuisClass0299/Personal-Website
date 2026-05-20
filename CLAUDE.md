# Luis Classe — Portfolio Project Memory

## Project
Personal portfolio website built with HTML, CSS, and vanilla JavaScript.
- Main files: `Portfolio/index.html`, `Portfolio/style.css`, `Portfolio/script.js`
- Assets: `Portfolio/assets/scarab_logo.png`, `Portfolio/assets/profile.jpeg`

## Design Preferences
- **Theme**: Dark mode (`--bg-dark: #0d0d0d`)
- **Accent color**: Yellow (`--accent: #F5B800`) — sampled from IEEE UCF logo
- **Text**: White (`--text-light: #ffffff`), muted gray (`#aaaaaa`) for body text
- **Font**: Segoe UI, system-ui
- **Icons**: Font Awesome 6.5.0 via CDN
- **Logo**: scarab_logo.png — black on transparent, use `filter: invert(1)` to make white
- **Border radius**: 8–12px on cards/buttons
- **Inspiration**: Katherina Dayaon's portfolio (katdayaon.art)

## CSS Variables (root)
```css
:root {
    --bg-dark: #0d0d0d;
    --accent: #F5B800;
    --text-light: #ffffff;
    --nav-height: 64px;
}
```

## Completed Sections
- **Navbar**: Logo left, centered nav links, icon buttons (Resume/LinkedIn/GitHub) right
- **Mobile menu**: Full-screen overlay with hamburger toggle, close button, large centered links
- **Hero**: Two-column flex layout, heading "Hello, I'm Luis" with yellow accent on name, bio text, profile photo right

## Working Preferences
- Luis is learning HTML/CSS/JS — always explain concepts, don't just give code
- Show code for him to type himself rather than editing files directly
- Explain what properties do when introducing new ones (e.g. rem, calc, font-weight)
- He uses VS Code with Live Server extension for previewing
- Project lives in OneDrive — can cause file sync issues; always verify via bash if needed

## Personal Info
- Name: Luis Classe
- Studies: Computer Science at University of Central Florida (UCF)
- Interests: Software engineering
- LinkedIn: https://www.linkedin.com/in/luis-classe
