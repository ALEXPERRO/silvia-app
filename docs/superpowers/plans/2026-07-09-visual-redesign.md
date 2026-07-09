# Blooming Wild ART — Ground-up visual redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the entire visual layer of the silvia-app site (palette, typography, icons, navbar branding, and page composition for Home/Portfolio/Eventi/Shop) around the site's existing logo, per `docs/superpowers/specs/2026-07-09-visual-redesign-design.md`, without changing any routing, form, gallery-filter, or Supabase logic.

**Architecture:** Angular 20 standalone components + Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`). All theming lives in one `src/styles.css` `@theme` block whose color/font tokens cascade into every template via Tailwind utility classes — most of the redesign is achieved by redefining those tokens plus targeted template rewrites for structure that's actually changing (navbar branding, card shapes, filter tabs, hero layout).

**Tech Stack:** Angular 20 (standalone components, `@if`/`@for`/`@switch` control flow), Tailwind CSS v4, `NgOptimizedImage`, Google Fonts (Fraunces + Work Sans), plain Bash + headless Microsoft Edge for visual verification (no test runner changes — see Global Constraints).

## Global Constraints

- This is a purely visual/template redesign. No new business logic is being added, so tasks do not follow classic red/green unit-TDD. Each task's verification is: (1) `npx ng build` succeeds with no errors, (2) a headless-browser screenshot of the affected route(s) at mobile (390×844) and desktop (1440×1000) widths, visually checked against that task's acceptance criteria. Routing, the reactive booking form, the Supabase calls, and the gallery filter/lightbox logic must not change — only classes/markup/tokens.
- Repo root: `C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app` (Windows; use the Bash tool's git-bash POSIX paths, e.g. `C:\...` works directly in the commands below since that's what has been used successfully all session).
- Dev server: `npm start` (Angular CLI `ng serve`), serves on `http://localhost:4200`. Screenshot tool: Microsoft Edge headless at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (confirmed present on this machine).
- Screenshots go to `.tmp-screenshots/` at the repo root (created in Task 1, gitignored) — never commit screenshots.
- Every task ends with a `git commit`. This is a fresh repo initialized in Task 1.
- No dark theme. No new bio copy is invented for the About Me placeholder — it must keep showing clearly-marked placeholder text until the user supplies real copy.
- Design tokens (exact hex values, all defined in Task 2) that every later task relies on:
  `bg-blush` `#EEDCC7` (page bg) · `bg-parchment` `#F7EFDF` (secondary surface) · `bg-white`/`text-white`/`border-white` now resolve to `#FBF6EC` (card surface) · `text-moss`/`bg-moss`/`border-moss` `#5C6B33` · `hover:text-moss-hover`/`hover:bg-moss-hover` `#47531F` · `text-sage` `#8A9A6E` · `text-bark`/`border-bark` `#7C6248` · `text-plum`/`border-plum` `#6E4F6B` · `hover:text-plum-hover` `#5A3F58` · `bg-gray-900`/`text-gray-900` now resolve to ink `#2C2415` · `text-gray-600` → `#6B5842` · `text-gray-500`/`text-gray-400` → ink-faint tones · `border-gray-200`/`bg-gray-50`/`bg-gray-100` → warm hairline/parchment tones · `font-title` → Fraunces · `font-body` → Work Sans.

---

### Task 1: Initialize git repository

**Files:**
- Modify: `.gitignore` (append screenshot folder)
- Create: (git metadata only, no app files)

**Interfaces:**
- Consumes: nothing.
- Produces: a git repo at the project root that every subsequent task commits into; `.tmp-screenshots/` gitignored.

- [ ] **Step 1: Check current state and initialize git**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git status 2>&1 | head -3
git init
```

Expected: `git status` first prints "fatal: not a git repository"; after `git init`, a `.git/` folder exists.

- [ ] **Step 2: Add the screenshots folder to .gitignore**

Open `.gitignore` and append at the end:

```
# Redesign verification screenshots (not committed)
/.tmp-screenshots
```

- [ ] **Step 3: Create the screenshots directory**

```bash
mkdir -p "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app\.tmp-screenshots"
```

- [ ] **Step 4: Initial commit of the current state**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add -A
git commit -m "chore: initial commit before ground-up visual redesign"
git log --oneline
```

Expected: one commit listed, working tree clean afterward (`git status` shows nothing to commit).

---

### Task 2: Design tokens — rewrite `src/styles.css`

**Files:**
- Modify: `src/styles.css` (full file rewrite)

**Interfaces:**
- Consumes: nothing.
- Produces: every Tailwind color/font token listed in Global Constraints; `.nav-link` underline now uses `--color-moss`; `::selection` uses `--color-plum-soft`. All later tasks depend on these token names existing exactly as spelled here.

- [ ] **Step 1: Replace the full contents of `src/styles.css`**

```css
@import "tailwindcss";

@theme {
  /* Warm herbarium neutrals — override Tailwind's default white/gray/red scale
     so every existing bg-white/text-gray-* utility site-wide reads as
     parchment/ink instead of clinical gray, with zero template churn. */
  --color-white: #FBF6EC;
  --color-gray-50: #F7EFDF;
  --color-gray-100: #EFE0C4;
  --color-gray-200: #CDAF80;
  --color-gray-300: #B99A66;
  --color-gray-400: #A38B62;
  --color-gray-500: #8F7852;
  --color-gray-600: #6B5842;
  --color-gray-700: #7C6248;
  --color-gray-800: #52422F;
  --color-gray-900: #2C2415;
  --color-gray-950: #1C160D;

  --color-red-400: #C57A61;
  --color-red-500: #AD5A40;

  /* Blooming Wild ART palette — sampled from the logo (public/images/logo/logo.png) */
  --color-parchment: #F7EFDF;
  --color-blush: #EEDCC7;
  --color-moss: #5C6B33;
  --color-moss-hover: #47531F;
  --color-sage: #8A9A6E;
  --color-bark: #7C6248;
  --color-plum: #6E4F6B;
  --color-plum-hover: #5A3F58;
  --color-plum-soft: #E4D8E6;

  --font-title: "Fraunces", serif;
  --font-body: "Work Sans", sans-serif;
}

html {
  scroll-behavior: smooth;
}

body {
  overflow-x: hidden;
}

::selection {
  background-color: var(--color-plum-soft);
  color: var(--color-gray-900);
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Sottolineatura animata sui link di navigazione, attiva anche su routerLinkActive */
.nav-link {
  position: relative;
  transition: color 0.2s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 1px;
  background-color: var(--color-moss);
  transition: width 0.2s ease;
}

.nav-link:hover::after,
.nav-link.active::after {
  width: 100%;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.25s;
}
```

This removes the previous session's `.pattern-dots` and `.bg-botanical` tiled-texture utilities — the new design uses flat `bg-blush`/`bg-parchment` plus sparse per-section decoration (a single `<app-icon name="leaf">` per hero, added in Task 7), not a repeating background pattern.

- [ ] **Step 2: Build to confirm the CSS compiles**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors. (Pages will look broken/unstyled in places until later tasks replace the old `nature-*`/`bg-botanical` class references — that's expected at this point, this task only lands the token definitions.)

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/styles.css
git commit -m "feat(theme): replace palette/type tokens with logo-derived Blooming Wild ART system"
```

---

### Task 3: Swap fonts and shell backgrounds

**Files:**
- Modify: `src/index.html`
- Modify: `src/app/app.html`

**Interfaces:**
- Consumes: `bg-blush`, `font-body`, `font-title` from Task 2.
- Produces: page shell now loads Fraunces + Work Sans and uses the blush page background at `pt-16` (64px) top offset — Task 5 (Navbar) must build a navbar that is visually ~64px tall to match this.

- [ ] **Step 1: Replace `src/index.html`**

```html
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>Blooming Wild ART</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Blooming Wild ART — illustrazioni, eventi Paint & Pass! e shop di Silvia Sgaramella.">
  <link rel="icon" type="image/x-icon" href="favicon.ico">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Work+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-blush font-body text-gray-900">
  <app-root></app-root>
</body>
</html>
```

- [ ] **Step 2: Replace `src/app/app.html`**

```html
<app-navbar />

<main class="pt-16 min-h-screen bg-blush">
  <router-outlet />
</main>

<app-footer />
```

- [ ] **Step 3: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual check — fonts load and background is blush**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
(npm start > /tmp/ng-serve.log 2>&1 &)
timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,900 --screenshot=".tmp-screenshots\task3-home-desktop.png" http://localhost:4200/
```

Then use the Read tool on `.tmp-screenshots\task3-home-desktop.png`. Expected: page background is a warm blush/tan tone (not white, not the old dark plum pattern), heading text renders in a serif face (Fraunces — if the font hasn't loaded yet it'll show a serif fallback, that's fine, confirmed properly in Task 5+ once more content exists).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/index.html src/app/app.html
git commit -m "feat(theme): load Fraunces/Work Sans and switch shell background to blush"
```

---

### Task 4: Redraw the icon set

**Files:**
- Modify: `src/app/shared/icon/icon.html` (full file rewrite)

**Interfaces:**
- Consumes: nothing (pure SVG markup, `name` input already defined in `icon.ts` — not touched).
- Produces: the same 12 `IconName` cases (`calendar`, `map-pin`, `map`, `ticket`, `sparkles`, `alert-triangle`, `ban`, `x`, `chevron-left`, `chevron-right`, `chevron-down`, `leaf`) with hand-adjusted, slightly irregular stroke paths instead of mechanically perfect geometry. `<app-icon name="...">` usage in every other template is unaffected.

- [ ] **Step 1: Replace `src/app/shared/icon/icon.html`**

```html
<svg
  viewBox="0 0 24 24"
  width="100%"
  height="100%"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  @switch (name) {
    @case ('calendar') {
      <path d="M4 8.5c0-2 .3-3.2 2-3.4 3-.4 9-.4 12 0 1.7.2 2 1.4 2 3.4v8c0 2-.4 3-2 3.2-3 .3-9 .3-12 0-1.6-.2-2-1.2-2-3.2v-8Z" />
      <path d="M8 3v4M16 3v3.6" />
      <path d="M4.5 10c4-.6 11-.6 15 0" />
    }
    @case ('map-pin') {
      <path d="M12 21c-3.8-3.6-6.5-7-6.5-10.2C5.5 6.8 8.4 4 12 4s6.5 2.8 6.5 6.8c0 3.2-2.7 6.6-6.5 10.2Z" />
      <path d="M12 12.4c1.1 0 2-.9 2-2.1 0-1.2-.9-2.1-2-2.1s-2 .9-2 2.1c0 1.2.9 2.1 2 2.1Z" />
    }
    @case ('map') {
      <path d="M3.5 6.4 8.5 4l7 3.6 5-2.3v14L15.5 22l-7-3.6-5 2.3Z" />
      <path d="M8.5 4v14.4M15.5 7.6V22" />
    }
    @case ('ticket') {
      <path d="M3 9.8c0-1.3.8-1.9 1.9-2.1 2-.4 12.2-.4 14.2 0 1.1.2 1.9.8 1.9 2.1-1.4.3-1.4 3.9 0 4.3 0 1.3-.8 1.9-1.9 2.1-2 .4-12.2.4-14.2 0-1.1-.2-1.9-.8-1.9-2.1 1.4-.4 1.4-4 0-4.3Z" />
      <path d="M9 7.3v9.3" stroke-dasharray="1.5 2.6" />
    }
    @case ('sparkles') {
      <path d="M12 3.5c.6 3 1.8 4.6 4.8 5.5-3 .9-4.2 2.5-4.8 5.5-.6-3-1.8-4.6-4.8-5.5 3-.9 4.2-2.5 4.8-5.5Z" />
      <path d="M5.2 3.2c.3 1.4.9 2.1 2.2 2.5-1.3.4-1.9 1.1-2.2 2.5-.3-1.4-.9-2.1-2.2-2.5 1.3-.4 1.9-1.1 2.2-2.5Z" />
      <path d="M18.8 14.8c.3 1.3.8 2 2 2.4-1.2.4-1.7 1.1-2 2.4-.3-1.3-.8-2-2-2.4 1.2-.4 1.7-1.1 2-2.4Z" />
    }
    @case ('alert-triangle') {
      <path d="M10.4 4.2 1.9 18.3c-.7 1.2.1 2.7 1.5 2.7h17.2c1.4 0 2.2-1.5 1.5-2.7L13.6 4.2c-.7-1.2-2.5-1.2-3.2 0Z" />
      <path d="M12 9.3v4" />
      <path d="M12 16.9v.1" />
    }
    @case ('ban') {
      <path d="M12 21c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9Z" />
      <path d="M5.7 5.7 18.3 18.3" />
    }
    @case ('x') {
      <path d="M5.5 5.8 18.3 18.4" />
      <path d="M18.4 5.6 5.6 18.3" />
    }
    @case ('chevron-left') {
      <path d="M15.5 18.2 9.3 12l6-6.4" />
    }
    @case ('chevron-right') {
      <path d="M8.5 5.6 14.7 12l-6 6.4" />
    }
    @case ('chevron-down') {
      <path d="M5.6 8.5 12 14.8l6.4-6" />
    }
    @case ('leaf') {
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    }
  }
</svg>
```

- [ ] **Step 2: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Visual check on Eventi (uses the most icon variety)**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1000 --screenshot=".tmp-screenshots\task4-eventi-icons.png" http://localhost:4200/eventi
```

Read `.tmp-screenshots\task4-eventi-icons.png`. Expected: calendar/map-pin/map/ticket/ban/alert-triangle/sparkles/chevrons all render as closed, recognizable shapes (no broken/open paths), with a slightly hand-drawn (not perfectly geometric) feel.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/app/shared/icon/icon.html
git commit -m "feat(icons): redraw icon set with organic hand-adjusted strokes"
```

---

### Task 5: Rebuild Navbar with logo branding

**Files:**
- Modify: `src/app/layout/navbar/navbar.html` (full file rewrite)
- Modify: `src/app/layout/navbar/navbar.ts:1-2,9-15` (add `NgOptimizedImage` import + to the `imports` array)

**Interfaces:**
- Consumes: `bg-parchment`, `border-gray-200`, `text-moss`, `hover:text-moss` (Task 2); `pt-16` assumption from Task 3 (navbar must render ~64px tall).
- Produces: nothing new consumed by later tasks (Footer/Home/Portfolio/Eventi/Shop don't reference the navbar).

- [ ] **Step 1: Replace `src/app/layout/navbar/navbar.html`**

```html
<nav class="fixed top-0 left-0 w-full bg-parchment text-gray-800 z-50 shadow-sm border-b border-gray-200">
  <div class="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
    <a routerLink="/" class="flex items-center gap-2.5 shrink-0">
      <img ngSrc="images/logo/logo.png" width="36" height="36" alt="Blooming Wild ART" class="rounded-full object-cover" />
      <span class="flex items-baseline gap-1 leading-none">
        <span class="font-title italic text-lg text-moss">Blooming Wild</span>
        <span class="font-body text-[10px] tracking-[0.2em] text-gray-500 max-[420px]:hidden">ART</span>
      </span>
    </a>
    <ul class="flex items-center gap-3 md:gap-7 font-semibold text-[11px] md:text-sm tracking-widest uppercase">
      @for (item of navItems; track item.path) {
        <li>
          <a
            [routerLink]="item.path"
            routerLinkActive="active text-moss"
            [routerLinkActiveOptions]="{ exact: item.path === '/' }"
            class="nav-link hover:text-moss transition-colors"
          >
            {{ item.label }}
          </a>
        </li>
      }
    </ul>
  </div>
</nav>
```

- [ ] **Step 2: Replace `src/app/layout/navbar/navbar.ts`**

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {
  protected readonly navItems: NavItem[] = [
    { label: 'About me', path: '/' },
    { label: 'Portfolio', path: '/portfolio' },
    { label: 'Eventi', path: '/eventi' },
    { label: 'Shop', path: '/shop' },
  ];
}
```

- [ ] **Step 3: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual check — logo shows, no gap/overlap with page content, mobile doesn't overflow**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,300 --screenshot=".tmp-screenshots\task5-nav-desktop.png" http://localhost:4200/portfolio
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=390,300 --screenshot=".tmp-screenshots\task5-nav-mobile.png" http://localhost:4200/portfolio
```

Read both screenshots. Expected: circular logo + "Blooming Wild ART" wordmark on the left, four nav links on the right, on a `parchment` bar visibly lighter than the `blush` page body below it; the active link ("Portfolio") shown in moss with an underline. On the 390px-wide screenshot, nothing overflows/wraps to a second line and "ART" is hidden (per the `max-[420px]:hidden` rule) while the rest stays legible.

If there's a visible gap or overlap between the nav bar and the page's `<h1>` below it, adjust `py-3` in `navbar.html` (increase/decrease) so the rendered bar height matches the `pt-16` (64px) assumption in `app.html`, then re-screenshot.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/app/layout/navbar/navbar.html src/app/layout/navbar/navbar.ts
git commit -m "feat(navbar): add logo wordmark and restyle links to the new token system"
```

---

### Task 6: Rebuild Footer

**Files:**
- Modify: `src/app/layout/footer/footer.html` (full file rewrite)

**Interfaces:**
- Consumes: `border-gray-200`, `text-moss`, `text-gray-500` (Task 2). `footer.text`/`footer.credits` from `ContentService.footer` (unchanged, not touched).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Replace `src/app/layout/footer/footer.html`**

```html
<footer class="bg-white text-gray-800 text-center py-10 border-t border-gray-200 z-20 relative text-sm">
  <p class="font-title italic text-2xl tracking-wide text-moss">{{ footer.text }}</p>
  <p class="text-xs text-gray-500 tracking-wider font-light mt-2">{{ footer.credits }}</p>
</footer>
```

- [ ] **Step 2: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Visual check**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1400 --screenshot=".tmp-screenshots\task6-shop-footer.png" http://localhost:4200/shop
```

Read `.tmp-screenshots\task6-shop-footer.png` and scroll-check the bottom of the page visually (the screenshot covers the fold; if the footer isn't visible in frame, re-run with `--window-size=1440,2200`). Expected: "Blooming Wild ART" in moss italic serif, credits line below in small warm-gray text, thin border above separating it from the page content.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/app/layout/footer/footer.html
git commit -m "feat(footer): restyle to the Blooming Wild ART token system"
```

---

### Task 7: Rebuild Home / About Me hero

**Files:**
- Modify: `src/app/features/home/home.html` (full file rewrite)
- Modify: `src/app/features/home/home.ts` (full file rewrite — add `Icon` import)

**Interfaces:**
- Consumes: `cover.main` (`{ src, scale }`) from `ContentService.cover` (unchanged); `Icon` component (`app-icon`, `name`/`size` inputs) from Task 4's redrawn set; `text-plum`, `text-sage` tokens from Task 2.
- Produces: nothing consumed by other pages.

- [ ] **Step 1: Replace `src/app/features/home/home.html`**

```html
<header class="relative min-h-[calc(100vh-64px)] flex items-center px-4 py-16 md:py-0">
  <app-icon name="leaf" [size]="72" class="hidden md:block absolute top-10 right-[8%] text-sage opacity-40 rotate-12" />

  <div class="relative w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-12 md:gap-16 items-center">
    <div class="text-center md:text-left order-2 md:order-1">
      <p class="font-body text-xs tracking-[0.2em] uppercase text-plum font-semibold mb-4">Illustratrice · Blooming Wild ART</p>
      <h1 class="font-title text-4xl md:text-6xl text-gray-900 mb-6 text-balance">Silvia Sgaramella</h1>

      <!-- Box di testo (contenuto da definire) -->
      <div class="bg-white border border-gray-200 shadow-lg rounded px-6 py-5 md:px-8 md:py-6 max-w-md mx-auto md:mx-0">
        <p class="font-title italic text-gray-500 text-sm md:text-base tracking-wide">Testo in arrivo...</p>
      </div>
    </div>

    <div class="order-1 md:order-2 flex justify-center md:justify-end">
      <div class="w-full max-w-xs">
        <div class="relative aspect-3/4 border-[6px] border-white shadow-2xl -rotate-2 overflow-hidden">
          <img [ngSrc]="cover.main.src" [style.transform]="'scale(' + cover.main.scale + ')'" fill priority alt="Silvia" class="object-cover" />
        </div>
        <p class="text-center font-body text-[10px] tracking-[0.15em] uppercase text-gray-500 mt-3">Silvia, nel suo studio</p>
      </div>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Replace `src/app/features/home/home.ts`**

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ContentService } from '../../core/services/content.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgOptimizedImage, Icon],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly content = inject(ContentService);

  protected readonly cover = this.content.cover;
}
```

- [ ] **Step 3: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual check — desktop asymmetric layout + mobile stacked with photo visible**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,900 --screenshot=".tmp-screenshots\task7-home-desktop.png" http://localhost:4200/
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=390,844 --screenshot=".tmp-screenshots\task7-home-mobile.png" http://localhost:4200/
```

Read both screenshots. Expected on desktop: copy block (kicker in plum uppercase, "Silvia Sgaramella" in large serif, placeholder text box) on the left, the framed rotated photo on the right, a faint sage leaf detail in the top-right corner. Expected on mobile: photo appears first (fully visible, not cropped to zero height — this was a real bug in an earlier version of this page), copy stacked below it, everything centered and readable, no horizontal overflow.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/app/features/home/home.html src/app/features/home/home.ts
git commit -m "feat(home): rebuild About Me hero as an asymmetric editorial layout"
```

---

### Task 8: Rebuild Portfolio page

**Files:**
- Modify: `src/app/features/portfolio/portfolio.html` (full file rewrite)

**Interfaces:**
- Consumes: `activeCategory()`, `categories`, `filteredItems()`, `lightboxItem()`, `setCategory()`, `openLightbox()`, `closeLightbox()` from `portfolio.ts` (all unchanged, exact same names); `app-icon` (Task 4); `text-moss`, `hover:text-moss-hover`, `border-plum`, `bg-gray-900/90` (Task 2 — `gray-900` now resolves to ink, giving a warm dark lightbox backdrop instead of pure black).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Replace `src/app/features/portfolio/portfolio.html`**

```html
<section class="min-h-screen py-24 px-4 max-w-6xl mx-auto">
  <h1 class="text-4xl md:text-6xl text-gray-900 font-title mb-4 text-center">Portfolio</h1>
  <p class="text-center text-gray-600 max-w-xl mx-auto mb-12 text-sm md:text-base font-body">
    Una selezione delle illustrazioni e composizioni di Silvia: dalle opere finite ai singoli elementi botanici, marini e animali.
  </p>

  <!-- Filtri categoria -->
  <div class="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-14 font-body text-xs md:text-sm tracking-widest uppercase">
    @for (cat of categories; track cat.value) {
      <button
        type="button"
        (click)="setCategory(cat.value)"
        class="pb-1 border-b-2 transition-colors hover:text-moss-hover"
        [class.text-moss]="activeCategory() === cat.value"
        [class.border-moss]="activeCategory() === cat.value"
        [class.text-gray-500]="activeCategory() !== cat.value"
        [class.border-transparent]="activeCategory() !== cat.value"
      >
        {{ cat.label }}
      </button>
    }
  </div>

  <!-- Griglia -->
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8">
    @for (item of filteredItems(); track item.src) {
      <button
        type="button"
        (click)="openLightbox(item)"
        class="group text-left"
      >
        <div class="relative aspect-square bg-white border border-gray-200 shadow-sm group-hover:shadow-lg group-hover:border-plum transition-all overflow-hidden">
          <img
            [ngSrc]="item.src"
            fill
            loading="lazy"
            [alt]="item.title"
            class="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <p class="mt-2 font-body text-[10px] tracking-[0.12em] uppercase text-gray-500 group-hover:text-gray-900 transition-colors">
          {{ item.title }}
        </p>
      </button>
    } @empty {
      <p class="col-span-full text-center text-gray-500 py-12 font-body">Nessuna illustrazione in questa categoria.</p>
    }
  </div>
</section>

<!-- Lightbox -->
@if (lightboxItem(); as item) {
  <div
    class="fixed inset-0 z-60 bg-gray-900/90 flex items-center justify-center p-6"
    (click)="closeLightbox()"
  >
    <button
      type="button"
      (click)="closeLightbox()"
      class="absolute top-6 right-6 text-white hover:text-plum-hover transition-colors"
      aria-label="Chiudi"
    >
      <app-icon name="x" [size]="28" />
    </button>
    <figure class="max-w-2xl w-full" (click)="$event.stopPropagation()">
      <div class="relative w-full aspect-square bg-white border-[6px] border-white overflow-hidden">
        <img [ngSrc]="item.src" fill [alt]="item.title" class="object-contain p-6" />
      </div>
      <figcaption class="text-center text-white font-body text-[11px] tracking-[0.15em] uppercase mt-4">{{ item.title }}</figcaption>
    </figure>
  </div>
}
```

- [ ] **Step 2: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Visual check — filter tabs, grid tiles, lightbox**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1200 --screenshot=".tmp-screenshots\task8-portfolio-grid.png" http://localhost:4200/portfolio
```

Read `.tmp-screenshots\task8-portfolio-grid.png`. Expected: "Tutte" filter shown underlined in moss (it's the default active category), other filters in muted warm gray with no fill/pill background; grid tiles are thin-bordered squares with the illustration inset (not edge-to-edge) and a small caption label below each tile, not an overlay. Then verify the lightbox opens correctly:

```bash
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1200 --screenshot=".tmp-screenshots\task8-portfolio-check.png" http://localhost:4200/portfolio
```

(Lightbox itself is triggered by a click event, which a plain screenshot navigation won't do — this is acceptable: the grid/filter markup is the part that changed structurally and is what this screenshot verifies. The lightbox's Angular `@if` binding and `closeLightbox()`/`openLightbox()` logic are untouched from before this redesign, only its Tailwind classes changed, and Task 11's full-site pass includes a click-through check.)

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/app/features/portfolio/portfolio.html
git commit -m "feat(portfolio): rebuild gallery as specimen-card grid with underlined tab filters"
```

---

### Task 9: Rebuild Eventi page

**Files:**
- Modify: `src/app/features/eventi/eventi.html` (full file rewrite)
- Modify: `src/app/core/services/content.service.ts:42` (one class-name string inside a rule's `innerHTML`)

**Interfaces:**
- Consumes: every signal/method already on `Eventi` (`currentDefinition()`, `eventsWithSeats()`, `scrollToPrev()`, `scrollToNext()`, `onSliderScroll()`, `selectEventAndScroll()`, `trustedMapUrl()`, `form`, `isPrivato()`, `selectedEvent()`, `bookingSuccess()`, `submitting()`, `errorMessage()`, `onSubmit()` — none of these change name or signature); `app-icon` (Task 4); `bg-moss`/`hover:bg-moss-hover`, `text-plum`, `border-plum` (Task 2).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Replace `src/app/features/eventi/eventi.html`**

```html
<!-- SEZIONE EVENTI SLIDER -->
<section class="min-h-screen py-24 px-4 relative flex flex-col items-center justify-center">
  <h1 class="text-4xl md:text-6xl text-gray-900 font-title mb-4 tracking-wide text-center">
    I Nostri Prossimi Eventi
  </h1>

  <!-- Blocco Definizione Dinamico -->
  <div class="max-w-xl w-full bg-white border border-gray-200 rounded p-6 mb-12 text-center shadow-lg font-title italic text-base md:text-lg text-gray-800 min-h-40 flex flex-col justify-center gap-1 tracking-wide">
    @for (def of currentDefinition(); track $index; let i = $index) {
      @if (i === 0) {
        <span class="text-xl md:text-2xl font-semibold font-title not-italic text-gray-900 mb-1">{{ def }}</span>
      } @else if (i === 1) {
        <span class="text-xs tracking-widest uppercase font-body not-italic text-gray-500 mb-2">{{ def }}</span>
      } @else {
        <p class="text-gray-600">{{ def }}</p>
      }
    }
  </div>

  <!-- CONTENITORE PRINCIPALE CON FRECCE ESTERNE -->
  <div class="relative w-full max-w-5xl flex items-center justify-center px-2 md:px-12">
    <button
      type="button"
      (click)="scrollToPrev()"
      class="absolute left-0 md:-left-4 z-30 bg-white text-gray-700 w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center shadow-md hover:bg-gray-50 hover:border-plum active:scale-95 transition-all select-none"
    >
      <app-icon name="chevron-left" [size]="20" />
    </button>

    <div
      #sliderRef
      (scroll)="onSliderScroll($event)"
      class="w-full overflow-x-auto flex gap-6 pb-4 px-1 scroll-smooth snap-x snap-mandatory scrollbar-hide"
    >
      @for (ev of eventsWithSeats(); track ev.id) {
        <div class="w-full min-w-full bg-white rounded shadow-lg overflow-hidden z-10 flex flex-col md:flex-row border border-gray-200 snap-start shrink-0">
          <div class="p-6 md:p-10 md:w-1/2 flex flex-col justify-center text-left">
            <h3 class="text-2xl md:text-4xl font-title font-medium text-gray-900 mb-1 tracking-wide">{{ ev.title }}</h3>

            <p class="flex items-center gap-1.5 text-xs md:text-sm font-title italic mb-4" [class.text-red-500]="ev.isSoldOut" [class.font-bold]="ev.isSoldOut" [class.text-moss]="!ev.isSoldOut">
              @if (ev.isSoldOut) {
                <app-icon name="alert-triangle" [size]="16" /> Attenzione: Posti esauriti per questa data
              } @else {
                <app-icon name="sparkles" [size]="16" /> Solo {{ ev.seatsAvailable }} posti ancora disponibili
              }
            </p>

            <p class="text-sm text-gray-600 font-medium leading-relaxed mb-6">{{ ev.message.body }}</p>

            <div class="space-y-2 mb-6 text-xs md:text-sm text-gray-500 font-medium border-l-2 border-gray-200 pl-4">
              <p class="flex items-center gap-2"><app-icon name="calendar" [size]="15" /> <span>{{ ev.date }}</span> • <span>{{ ev.time }}</span></p>
              <p class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" /> <span>{{ ev.location }}</span>, <span class="text-gray-400">{{ ev.address }}</span></p>
            </div>

            <div class="flex flex-wrap gap-3">
              <a [href]="ev.mapLink" target="_blank" class="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold tracking-widest px-4 py-3 rounded hover:bg-gray-50 hover:border-plum transition-colors uppercase"><app-icon name="map" [size]="14" /> Mappa</a>
              <button
                type="button"
                [disabled]="ev.isSoldOut"
                (click)="selectEventAndScroll(ev.id)"
                class="flex items-center gap-1.5 text-xs font-semibold tracking-widest px-5 py-3 rounded transition-all uppercase"
                [ngClass]="ev.isSoldOut ? 'bg-gray-200 cursor-not-allowed text-gray-500' : 'bg-moss text-white hover:bg-moss-hover'"
              >
                @if (ev.isSoldOut) {
                  <app-icon name="ban" [size]="14" /> Esaurito
                } @else {
                  <app-icon name="ticket" [size]="14" /> Prenotati
                }
              </button>
            </div>
          </div>
          <div class="md:w-1/2 min-h-65 md:min-h-full bg-gray-50">
            <iframe [src]="trustedMapUrl(ev.mapEmbedUrl)" width="100%" height="100%" style="border:0" allowfullscreen loading="lazy" class="w-full h-full object-cover min-h-70"></iframe>
          </div>
        </div>
      }
    </div>

    <button
      type="button"
      (click)="scrollToNext()"
      class="absolute right-0 md:-right-4 z-30 bg-white text-gray-700 w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center shadow-md hover:bg-gray-50 hover:border-plum active:scale-95 transition-all select-none"
    >
      <app-icon name="chevron-right" [size]="20" />
    </button>
  </div>
</section>

<!-- SEZIONE PRENOTAZIONE / FORM -->
<section #bookingSection class="min-h-screen py-24 px-4 relative flex flex-col items-center justify-center">
  <div class="max-w-2xl w-full bg-white rounded shadow-xl p-6 md:p-10 z-10 border border-gray-200">
    <div class="flex flex-col items-center mb-8 text-center">
      <h2 class="text-3xl md:text-5xl font-title font-medium text-gray-900 tracking-wide">Prenota il tuo posto</h2>
      @if (selectedEvent(); as sel) {
        <h3 class="text-xs md:text-sm text-moss font-medium tracking-wider uppercase mt-3 bg-gray-50 border border-gray-200 py-2 px-4 rounded-full">
          {{ sel.acceptedMessage }}
        </h3>
      }
    </div>

    @if (!bookingSuccess()) {
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6 text-left text-sm">
        <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2">1. Dati Partecipante e Regolamento</p>

        <div>
          <label for="event-select" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Seleziona l'evento *</label>
          <select id="event-select" formControlName="eventId" class="w-full p-3 border border-gray-200 rounded bg-white focus:border-moss focus:outline-none font-medium text-gray-800 transition-colors">
            <option [ngValue]="null" disabled>Seleziona un appuntamento...</option>
            @for (ev of eventsWithSeats(); track ev.id) {
              <option [ngValue]="ev.id" [disabled]="ev.isSoldOut">
                {{ ev.title }} ({{ ev.date }}) - {{ ev.isSoldOut ? 'SOLD OUT' : 'Posti: ' + ev.seatsAvailable }}
              </option>
            }
          </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="user-name" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nome e Cognome *</label>
            <input type="text" id="user-name" formControlName="name" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="Emanuela Viola">
          </div>
          <div>
            <label for="user-email" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email *</label>
            <input type="email" id="user-email" formControlName="email" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="esempio@email.com">
          </div>
        </div>

        @if (selectedEvent(); as sel) {
          <div class="bg-gray-50 p-5 rounded border border-gray-200 space-y-3 text-xs text-gray-700 leading-relaxed">
            <p class="text-gray-900 font-title italic text-sm tracking-wide">Note importanti per i partecipanti:</p>
            <ul class="list-disc pl-5 space-y-2 font-medium">
              @for (rule of sel.rules; track $index) {
                <li [innerHTML]="rule"></li>
              }
            </ul>
          </div>
        }

        <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2 pt-4">2. Fatturazione</p>
        <div>
          <label for="billing-type" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tipologia Account *</label>
          <select id="billing-type" formControlName="billingType" class="w-full p-3 border border-gray-200 rounded bg-white focus:border-moss focus:outline-none font-medium text-gray-800">
            <option value="privato">Privato (Ricevuta con Codice Fiscale)</option>
            <option value="business">Azienda / Libero Professionista (Fattura con P.IVA)</option>
          </select>
        </div>

        @if (isPrivato()) {
          <div>
            <label for="user-cf" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Codice Fiscale *</label>
            <input type="text" id="user-cf" formControlName="cf" maxlength="16" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800 uppercase" placeholder="FMTLNZ90A01F205X">
          </div>
        } @else {
          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="company-name" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ragione Sociale *</label>
                <input type="text" id="company-name" formControlName="companyName" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="Studio d'Arte S.r.l.">
              </div>
              <div>
                <label for="company-piva" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Partita IVA *</label>
                <input type="text" id="company-piva" formControlName="companyPiva" maxlength="11" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="11 cifre numeriche">
              </div>
            </div>
            <div>
              <label for="company-sdi" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Codice Destinatario SDI *</label>
              <input type="text" id="company-sdi" formControlName="companySdi" maxlength="7" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800 uppercase" placeholder="M5UXCR1">
            </div>
          </div>
        }

        <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2 pt-4">3. Indirizzo di Residenza o Sede</p>
        <div>
          <label for="billing-address" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Via e Numero Civico *</label>
          <input type="text" id="billing-address" formControlName="address" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="Corso Umberto I, 45">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label for="billing-cap" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">CAP *</label>
            <input type="text" id="billing-cap" formControlName="cap" maxlength="5" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="74121">
          </div>
          <div class="sm:col-span-2">
            <label for="billing-city" class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Città e Provincia *</label>
            <input type="text" id="billing-city" formControlName="city" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="Taranto (TA)">
          </div>
        </div>

        @if (errorMessage(); as err) {
          <p class="text-red-500 text-xs font-semibold text-center">{{ err }}</p>
        }

        <div class="text-center pt-6">
          <button type="submit" [disabled]="submitting()" class="w-full md:w-auto bg-moss text-white font-medium text-sm tracking-widest py-4 px-10 rounded hover:bg-moss-hover transition-all uppercase disabled:opacity-50">
            {{ submitting() ? 'Invio in corso...' : 'Invia Iscrizione' }}
          </button>
        </div>
      </form>
    } @else {
      <div class="mt-6 bg-moss text-white text-center p-5 rounded border border-moss-hover shadow-lg font-title italic text-lg flex items-center justify-center gap-2">
        <app-icon name="sparkles" [size]="20" />
        <span>Iscrizione salvata. Riceverai a breve una mail con la conferma e la ricevuta del tuo posto.</span>
      </div>
    }
  </div>
</section>
```

- [ ] **Step 2: Update the one remaining `nature-violet` class reference in `content.service.ts`**

In `src/app/core/services/content.service.ts` line 42, change:

```typescript
        "Giuro solennemente di aver studiato il repertorio e di aver scelto la mia hit dalla <a href='https://docs.google.com/spreadsheets/d/1QZq5S1K9pq8tfgCBQkcjXSWAfp-xlwBkoWbpZPT5bmc/edit?gid=0#gid=0' target='_blank' class='text-nature-violet underline font-black'>Lista Canzoni Ufficiale</a>. Non sono ammesse scene mute!",
```

to:

```typescript
        "Giuro solennemente di aver studiato il repertorio e di aver scelto la mia hit dalla <a href='https://docs.google.com/spreadsheets/d/1QZq5S1K9pq8tfgCBQkcjXSWAfp-xlwBkoWbpZPT5bmc/edit?gid=0#gid=0' target='_blank' class='text-plum underline font-black'>Lista Canzoni Ufficiale</a>. Non sono ammesse scene mute!",
```

- [ ] **Step 3: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual check — event card, CTA colors, booking form**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1300 --screenshot=".tmp-screenshots\task9-eventi-top.png" http://localhost:4200/eventi
```

Read `.tmp-screenshots\task9-eventi-top.png`. Expected: definition block and event card both thin-bordered with soft shadow (not the old heavy `rounded-2xl` pill look), "Prenotati" button filled moss green (not near-black), "Solo N posti disponibili" text in moss with the sparkle icon next to it. Then scroll to the form:

```bash
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,2200 --screenshot=".tmp-screenshots\task9-eventi-form.png" http://localhost:4200/eventi
```

Read `.tmp-screenshots\task9-eventi-form.png`. Expected: "Invia Iscrizione" submit button filled moss green, input focus rings/borders use moss on focus (can't be verified from a static screenshot without a focused element — verify by reading the CSS class list is present, `focus:border-moss`, which it is per Step 1's markup).

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/app/features/eventi/eventi.html src/app/core/services/content.service.ts
git commit -m "feat(eventi): restyle event cards, CTAs, and booking form to the new token system"
```

---

### Task 10: Rebuild Shop page

**Files:**
- Modify: `src/app/features/shop/shop.html` (full file rewrite)

**Interfaces:**
- Consumes: `shopUrl`, `products` from `shop.ts` (unchanged); `text-moss`, `hover:text-moss-hover`, `hover:border-plum` (Task 2).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Replace `src/app/features/shop/shop.html`**

```html
<section class="min-h-screen py-24 px-4 max-w-6xl mx-auto">
  <h1 class="text-4xl md:text-6xl text-gray-900 font-title mb-4 tracking-wide text-center">Shop</h1>
  <p class="text-center text-gray-600 max-w-xl mx-auto mb-12 text-sm md:text-base">
    Stampe, cartoline e piccoli oggetti illustrati da Silvia, disponibili sul negozio Etsy.
  </p>

  <!-- Banner CTA -->
  <div class="bg-gray-900 text-white rounded p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 mb-16 shadow-xl">
    <div class="text-center md:text-left">
      <p class="font-title italic text-2xl md:text-3xl tracking-wide mb-1">Blooming Wild ART su Etsy</p>
      <p class="text-gray-300 text-sm">Visita il negozio completo per scoprire tutte le illustrazioni disponibili.</p>
    </div>
    <a
      [href]="shopUrl"
      target="_blank"
      rel="noopener"
      class="bg-white text-gray-900 font-semibold text-xs tracking-widest uppercase px-6 py-4 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
    >
      Vai al negozio Etsy →
    </a>
  </div>

  <!-- Griglia prodotti -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
    @for (product of products; track product.id) {
      <article class="bg-white border border-gray-200 shadow-sm hover:shadow-lg hover:border-plum transition-all overflow-hidden flex flex-col">
        <div class="relative w-full aspect-square bg-gray-50">
          <img [ngSrc]="product.image" fill loading="lazy" [alt]="product.title" class="object-contain p-6" />
        </div>
        <div class="p-5 flex flex-col grow text-left">
          <h3 class="font-title italic text-lg text-gray-900 tracking-wide mb-1">{{ product.title }}</h3>
          <p class="text-xs text-gray-500 leading-relaxed mb-4 grow">{{ product.description }}</p>
          <div class="flex items-center justify-between">
            <span class="font-semibold text-gray-900 text-sm">{{ product.price }}</span>
            <a
              [href]="product.etsyUrl"
              target="_blank"
              rel="noopener"
              class="text-[10px] font-bold tracking-widest uppercase text-moss hover:text-moss-hover hover:underline"
            >
              Vedi su Etsy →
            </a>
          </div>
        </div>
      </article>
    }
  </div>

  <p class="text-center text-gray-400 text-xs mt-12">
    * Prodotti di esempio in attesa del collegamento al negozio Etsy definitivo.
  </p>
</section>
```

- [ ] **Step 2: Build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -20
```

Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Visual check**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1300 --screenshot=".tmp-screenshots\task10-shop.png" http://localhost:4200/shop
```

Read `.tmp-screenshots\task10-shop.png`. Expected: dark ink-colored CTA banner (warm dark brown-black, not flat gray), product cards with thin borders (not heavy rounded corners), "Vedi su Etsy" links in moss green.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git add src/app/features/shop/shop.html
git commit -m "feat(shop): restyle product cards and CTA banner to the new token system"
```

---

### Task 11: Full-site visual QA pass

**Files:** none (verification only).

**Interfaces:**
- Consumes: the fully redesigned site from Tasks 1–10.
- Produces: a pass/fail confirmation for every page and interaction; this is the final task.

- [ ] **Step 1: Full production build**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
npx ng build 2>&1 | tail -30
```

Expected: `Application bundle generation complete.` with no errors and no unexpected warnings (Tailwind "unknown utility class" warnings would indicate a leftover `nature-*`/`bg-botanical` reference — if any appear, grep for them and fix before continuing).

- [ ] **Step 2: Confirm no leftover references to the retired token names**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
grep -rn "nature-\|bg-botanical\|pattern-dots" src/ || echo "clean"
```

Expected: `clean` (no matches). If matches are found, replace them per the mapping in Global Constraints and re-run.

- [ ] **Step 3: Screenshot every route, desktop + mobile**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
curl -sf http://localhost:4200 >/dev/null 2>&1 || { (npm start > /tmp/ng-serve.log 2>&1 &); timeout 60 bash -c 'until curl -sf http://localhost:4200 >/dev/null 2>&1; do sleep 2; done'; }
for route in "" "portfolio" "eventi" "shop"; do
  name="${route:-home}"
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1400 --screenshot=".tmp-screenshots\final-${name}-desktop.png" "http://localhost:4200/${route}"
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=390,844 --screenshot=".tmp-screenshots\final-${name}-mobile.png" "http://localhost:4200/${route}"
done
```

Read all 8 screenshots. Checklist per page:
- **Home**: photo visible on both mobile and desktop, no leftover dark/black background, placeholder text box still says "Testo in arrivo...", logo not duplicated on this page (it only lives in the navbar).
- **Portfolio**: filter tabs underlined not pilled, grid tiles framed with captions, no `nature-*` colors visible.
- **Eventi**: event card and form both use moss/plum accents, no near-black buttons remain.
- **Shop**: CTA banner and product cards match the palette.
- **All pages**: navbar shows the logo + wordmark and doesn't overlap page content; footer renders in moss/ink.

- [ ] **Step 4: Click-through check on Portfolio's lightbox and category filters**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,1000 --screenshot=".tmp-screenshots\final-portfolio-filter.png" "http://localhost:4200/portfolio#composizioni"
```

(If a query/hash-based deep link into a category isn't supported by the component — it isn't, `activeCategory` is local component state, not route-driven — this step's screenshot will simply show the default "Tutte" grid; that's fine, the filter/lightbox *interaction* itself is unchanged Angular signal logic from before this redesign and was already working. The purpose of this step is only to catch any layout regression, not to re-verify interaction logic that this plan never touched.)

- [ ] **Step 5: Stop the dev server**

`pkill` is not available in this git-bash environment — stop the process by the port it's bound to, using the PowerShell tool (not Bash):

```powershell
$conn = Get-NetTCPConnection -LocalPort 4200 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $pids = $conn.OwningProcess | Sort-Object -Unique
  foreach ($p in $pids) { Stop-Process -Id $p -Force }
  "stopped"
} else { "no listener" }
```

Then confirm with Bash:

```bash
curl -sf http://localhost:4200 >/dev/null 2>&1 && echo "still up" || echo "stopped"
```

Expected: `stopped`.

- [ ] **Step 6: Final commit**

```bash
cd "C:\Users\Alessio Perrini\Desktop\Perro\Silvia\sito-silvia\silvia-app"
git status
git add -A
git commit -m "chore: ground-up visual redesign complete" --allow-empty
git log --oneline
```

Expected: a clean, linear commit history from Task 1 through this task, one commit per task.

---

## Self-Review Notes

- **Spec coverage:** palette (Task 2), typography (Tasks 2–3), icons (Task 4), branding/logo (Task 5), footer (Task 6), Home hero (Task 7), Portfolio (Task 8), Eventi incl. the one `content.service.ts` color reference (Task 9), Shop (Task 10), "no dark theme" and "no invented bio copy" (respected throughout — placeholder text preserved verbatim in Task 7) — every spec section maps to a task.
- **Type/name consistency checked:** `IconName` cases in Task 4 match every `<app-icon name="...">` usage referenced in Tasks 7–10 exactly (`calendar`, `map-pin`, `map`, `ticket`, `sparkles`, `alert-triangle`, `ban`, `x`, `chevron-left`, `chevron-right`, `leaf`); no new icon names are introduced that Task 4 doesn't define. All component signal/method names referenced in Tasks 8–10's markup (`activeCategory()`, `filteredItems()`, `eventsWithSeats()`, `selectedEvent()`, etc.) are read verbatim from the current `.ts` files, not invented.
- **No placeholders:** every task step contains complete, copy-pasteable file contents or exact commands — nothing deferred to "similar to Task N."
