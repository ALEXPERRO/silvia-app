# Blooming Wild ART — Visual polish, Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add section-rhythm backgrounds, a subtle watercolor "bloom" treatment, hand-drawn dividers, a showcase-frame corner accent, functional plum badges, scroll/hover micro-animations, and a caption-text contrast fix across Home, Portfolio, Eventi and Shop — per `docs/superpowers/specs/2026-07-10-visual-polish-phase1-design.md`.

**Architecture:** Pure presentation-layer change on top of the existing "Blooming Wild ART" design system (`src/styles.css` tokens). No routing, `.ts` business logic, or `ContentService` data-shape changes except each touched component's `imports` array gaining a new standalone `RevealOnScroll` directive. Two new small CSS utilities (`.bg-bloom`, `.reveal-on-scroll`) are added to `styles.css`; everything else uses existing Tailwind utility classes and existing color tokens.

**Tech Stack:** Angular 20 standalone components, Tailwind CSS v4 (`@theme` tokens, no `tailwind.config.js`), `NgOptimizedImage`.

## Global Constraints

- **No new `ContentService` fields, no `.ts` business-logic changes** — the only `.ts` edits are adding `RevealOnScroll` to a component's `imports` array (Portfolio, Shop).
- **No rotation/collage treatment on the Portfolio grid or the Shop product grid** — confirmed out of scope with the user; those grids stay ordered/aligned. The "showcase" corner-flourish + rotation/hover-tilt treatment is scoped to exactly three spots: the Home hero photo frame, the Eventi event card (corner flourish only, no rotation — see Task 3 rationale), and the Shop CTA banner (corner flourish only, no rotation).
- **Corner-flourish markup is always positioned inward** (`top-3 right-3`, not a negative/outward offset) so it is never clipped by a parent's `overflow-hidden` (the Home photo frame and the Eventi card both use `overflow-hidden`) and always gets `z-20 pointer-events-none` so it can't sit under an `<iframe>` (Eventi) or intercept clicks.
- **Contrast fix:** every caption/meta/label text instance currently on `text-gray-400` or `text-gray-500` in a touched file moves to `text-gray-600` — measured contrast ratios (WCAG AA requires ≥ 4.5:1 for normal text):

  | Text token | on `blush` | on `parchment` | on `surface` |
  |---|---|---|---|
  | `gray-400` (`#A38B62`) | 2.44 | 2.86 | 3.03 |
  | `gray-500` (`#8F7852`) | 3.15 | 3.69 | 3.92 |
  | `gray-600` (`#6B5842`) | **5.06** | **5.93** | **6.29** |

  Exception: disabled-control text (e.g. Eventi's sold-out select option, disabled submit button) is exempt per WCAG SC 1.4.3 and is left as-is.
- **Existing color tokens only** (no new hex values): `parchment #F7EFDF`, `blush #EEDCC7`, `surface`/`white #FBF6EC`, `moss #5C6B33`, `moss-hover #47531F`, `sage #8A9A6E`, `bark #7C6248`, `plum #6E4F6B`, `plum-hover #5A3F58`, `gray-200`/`rule #CDAF80`, `gray-600 #6B5842`, `gray-900`/`ink #2C2415`.
- **No unit test suite exists for this project.** Verification is `npx ng build` (must succeed with no errors) plus a scripted visual check via headless Edge + Chrome DevTools Protocol (see Task 1, Step 1 — a shared, reusable verification script). Do **not** trust plain `--window-size=W,H` screenshots for mobile widths: on this Windows/Edge setup that flag silently floors to ~490–500px regardless of the requested width. Always drive the viewport via CDP's `Emulation.setDeviceMetricsOverride` and confirm `window.innerWidth` matches the requested value before trusting any other measurement.
- **`prefers-reduced-motion: reduce`** must fully disable the scroll-reveal transition (element renders at `opacity: 1` immediately, no transform/transition) — this is asserted directly in Task 2's verification and re-checked in Task 5.
- Every task ends with `npx ng build` passing and a commit. Commit only the files the task lists.

---

## Task 1: Home hero — bloom background, showcase frame, bio box, shared verification script

**Files:**
- Create: `.superpowers/verify/cdp-check.mjs`
- Modify: `.gitignore`
- Modify: `src/styles.css`
- Modify: `src/app/features/home/home.html`

**Interfaces:**
- Produces: `.bg-bloom` CSS utility class (usable by any section wanting the watercolor-tint background) — consumed later by Task 3 (Eventi) and Task 4 (Shop).
- Produces: `.superpowers/verify/cdp-check.mjs`, a reusable Node script — consumed by every later task's visual-check step. Usage: `node .superpowers/verify/cdp-check.mjs <width> <url> <jsExpression> [reduce]`. It launches headless Edge, sets a true CDP-emulated viewport of `<width>`px (and `prefers-reduced-motion: reduce` if the 4th arg is the literal string `reduce`), navigates to `<url>`, evaluates `<jsExpression>` (a JS expression producing a JSON-serializable value) in the page, and prints `innerWidth: <n>` and `result: <json>` to stdout.

- [ ] **Step 1: Create the shared CDP verification script**

Create `.superpowers/verify/cdp-check.mjs`:

```js
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9400 + Math.floor(Math.random() * 400);
const WIDTH = Number(process.argv[2] || 1440);
const URL = process.argv[3] || 'http://localhost:4200/';
const EXPR = process.argv[4] || 'document.title';
const REDUCE_MOTION = process.argv[5] === 'reduce';

const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\edge-cdp-profile-${PORT}`,
  'about:blank',
], { stdio: 'ignore' });

await sleep(1500);

async function jsonGet(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

const list = await jsonGet('/json/list');
let target = list[0];
if (!target) {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  target = await res.json();
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  return new Promise((resolve) => {
    const myId = ++id;
    pending.set(myId, resolve);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}
await new Promise((resolve) => { ws.onopen = resolve; });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: WIDTH < 700,
});
if (REDUCE_MOTION) {
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
}
await send('Page.navigate', { url: URL });
await sleep(2500);

const widthCheck = await send('Runtime.evaluate', { expression: 'window.innerWidth' });
const result = await send('Runtime.evaluate', {
  expression: `(() => { return JSON.stringify(${EXPR}); })()`,
  returnByValue: true,
});

console.log('innerWidth:', widthCheck.result.result.value);
console.log('result:', result.result.result.value);

ws.close();
proc.kill();
```

- [ ] **Step 2: Gitignore the verify directory**

In `.gitignore`, after the `/.superpowers/brainstorm` line added previously, add:

```
/.superpowers/verify
```

- [ ] **Step 3: Start the dev server**

Run in background: `npx ng serve --port 4200`
Wait for `Application bundle generation complete` in its output before continuing.

- [ ] **Step 4: Add the `.bg-bloom` utility to `src/styles.css`**

Insert this new block immediately after the existing `.scrollbar-hide { ... }` rule (before the `/* Sottolineatura animata ... */` comment):

```css
/* Fase 1 — macchie acquerello sobrie per le sezioni vetrina (Home, Eventi, Shop) */
.bg-bloom {
  background-image:
    radial-gradient(circle at 15% 10%, rgb(92 107 51 / 0.10), transparent 40%),
    radial-gradient(circle at 85% 90%, rgb(110 79 107 / 0.12), transparent 40%);
}
```

- [ ] **Step 5: Rewrite `src/app/features/home/home.html`**

Replace the entire file content with:

```html
<header class="relative bg-blush bg-bloom min-h-[calc(100vh-64px)] flex items-center px-4 py-16 md:py-0">
  <app-icon name="leaf" [size]="72" class="hidden md:block absolute top-10 right-[8%] text-sage opacity-40 rotate-12" />

  <div class="relative w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-12 md:gap-16 items-center">
    <div class="text-center md:text-left order-2 md:order-1">
      <p class="font-body text-xs tracking-[0.2em] uppercase text-plum font-semibold mb-4">Illustratrice · Blooming Wild ART</p>
      <h1 class="font-title text-4xl md:text-6xl text-gray-900 mb-6 text-balance">Silvia Sgaramella</h1>

      <!-- Box di testo (contenuto da definire) -->
      <div class="relative bg-white border border-gray-200 shadow-lg rounded px-6 py-5 md:px-8 md:py-6 max-w-md mx-auto md:mx-0">
        <span class="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-moss rounded-tr-md pointer-events-none z-20"></span>
        <p class="font-title italic text-gray-600 text-sm md:text-base tracking-wide">Testo in arrivo...</p>
      </div>
    </div>

    <div class="order-1 md:order-2 flex justify-center md:justify-end">
      <div class="w-full max-w-xs">
        <div class="relative aspect-3/4 border-[6px] border-white shadow-2xl -rotate-2 hover:-rotate-3 hover:scale-[1.02] transition-transform duration-300 ease-out overflow-hidden">
          <span class="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-moss rounded-tr-md pointer-events-none z-20"></span>
          <img [ngSrc]="cover.main.src" [style.transform]="'scale(' + cover.main.scale + ')'" fill priority alt="Silvia" class="object-cover" />
        </div>
        <p class="text-center font-body text-[10px] tracking-[0.15em] uppercase text-gray-600 mt-3">Silvia, nel suo studio</p>
      </div>
    </div>
  </div>
</header>
```

- [ ] **Step 6: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 7: Visual verification**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/" "(() => { const header = document.querySelector('header'); const bgImg = getComputedStyle(header).backgroundImage; const flourishes = document.querySelectorAll('header .border-moss').length; const bioText = document.querySelector('header p.font-title.italic'); return { hasBloom: bgImg !== 'none', flourishCount: flourishes, bioColor: getComputedStyle(bioText).color }; })()"
```
Expected: `result:` JSON shows `"hasBloom":true`, `"flourishCount":2` (bio box + photo frame), `"bioColor":"rgb(107, 88, 66)"` (this is `#6B5842` = `gray-600`).

Then repeat at width `390` and confirm `innerWidth: 390` and the same `hasBloom`/`flourishCount` values (layout doesn't hide the flourishes on mobile).

- [ ] **Step 8: Commit**

```bash
git add .superpowers/verify/cdp-check.mjs .gitignore src/styles.css src/app/features/home/home.html
git commit -m "feat(home): add bloom background, showcase corner flourish and hover tilt, bump bio/caption contrast"
```

---

## Task 2: Reveal-on-scroll directive + Portfolio section rhythm

**Files:**
- Create: `src/app/shared/reveal-on-scroll/reveal-on-scroll.ts`
- Modify: `src/styles.css`
- Modify: `src/app/features/portfolio/portfolio.ts`
- Modify: `src/app/features/portfolio/portfolio.html`

**Interfaces:**
- Consumes: `.superpowers/verify/cdp-check.mjs` (Task 1).
- Produces: `RevealOnScroll` standalone directive, selector `[appRevealOnScroll]`, importable as `import { RevealOnScroll } from '../../shared/reveal-on-scroll/reveal-on-scroll';` — consumed by Task 4 (Shop).
- Produces: `.reveal-on-scroll` / `.reveal-on-scroll.is-visible` CSS classes in `styles.css`.

- [ ] **Step 1: Add reveal-on-scroll CSS to `src/styles.css`**

Insert this block immediately after the `.bg-bloom` block added in Task 1:

```css
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.reveal-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal-on-scroll {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

- [ ] **Step 2: Create the directive**

Create `src/app/shared/reveal-on-scroll/reveal-on-scroll.ts`:

```ts
import { Directive, ElementRef, Renderer2, afterNextRender, inject } from '@angular/core';

@Directive({
  selector: '[appRevealOnScroll]',
  standalone: true,
  host: {
    class: 'reveal-on-scroll',
  },
})
export class RevealOnScroll {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  constructor() {
    afterNextRender(() => {
      const target = this.el.nativeElement;

      if (typeof IntersectionObserver === 'undefined') {
        this.renderer.addClass(target, 'is-visible');
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.renderer.addClass(target, 'is-visible');
              observer.unobserve(target);
            }
          }
        },
        { threshold: 0.15 },
      );

      observer.observe(target);
    });
  }
}
```

- [ ] **Step 3: Wire the directive into Portfolio**

In `src/app/features/portfolio/portfolio.ts`, update the imports:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ContentService } from '../../core/services/content.service';
import { GalleryCategory, GalleryItem } from '../../core/models/gallery-item.model';
import { Icon } from '../../shared/icon/icon';
import { RevealOnScroll } from '../../shared/reveal-on-scroll/reveal-on-scroll';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgOptimizedImage, Icon, RevealOnScroll],
  templateUrl: './portfolio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Portfolio {
```

(Rest of the class body is unchanged.)

- [ ] **Step 4: Rewrite `src/app/features/portfolio/portfolio.html`**

Replace the entire file content with:

```html
<section class="bg-parchment py-20 px-4">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-4xl md:text-6xl text-gray-900 font-title mb-4 text-center">Portfolio</h1>
    <p class="text-center text-gray-600 max-w-xl mx-auto mb-12 text-sm md:text-base font-body">
      Una selezione delle illustrazioni e composizioni di Silvia: dalle opere finite ai singoli elementi botanici, marini e animali.
    </p>

    <!-- Filtri categoria -->
    <div class="flex flex-wrap justify-center gap-x-6 gap-y-3 font-body text-xs md:text-sm tracking-widest uppercase">
      @for (cat of categories; track cat.value) {
        <button
          type="button"
          (click)="setCategory(cat.value)"
          class="pb-1 border-b-2 transition-colors hover:text-moss-hover"
          [class.text-moss]="activeCategory() === cat.value"
          [class.border-moss]="activeCategory() === cat.value"
          [class.text-gray-600]="activeCategory() !== cat.value"
          [class.border-transparent]="activeCategory() !== cat.value"
        >
          {{ cat.label }}
        </button>
      }
    </div>
  </div>
</section>

<!-- Separatore -->
<div class="bg-blush py-10 flex items-center justify-center">
  <div class="flex items-center gap-3 w-2/3 max-w-xs">
    <span class="flex-1 h-px bg-gray-200"></span>
    <span class="w-1.5 h-1.5 rounded-full bg-bark"></span>
    <span class="flex-1 h-px bg-gray-200"></span>
  </div>
</div>

<section class="bg-blush pb-24 px-4">
  <div class="max-w-6xl mx-auto">
    <!-- Griglia -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8">
      @for (item of filteredItems(); track item.src) {
        <button
          type="button"
          (click)="openLightbox(item)"
          appRevealOnScroll
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
          <p class="mt-2 font-body text-[10px] tracking-[0.12em] uppercase text-gray-600 group-hover:text-gray-900 transition-colors">
            {{ item.title }}
          </p>
        </button>
      } @empty {
        <p class="col-span-full text-center text-gray-600 py-12 font-body">Nessuna illustrazione in questa categoria.</p>
      }
    </div>
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

- [ ] **Step 5: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 6: Visual verification — section rhythm and reveal-on-scroll**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(() => { const sections = [...document.querySelectorAll('section')]; const tile = document.querySelector('.reveal-on-scroll'); return { firstSectionBg: getComputedStyle(sections[0]).backgroundColor, secondSectionBg: getComputedStyle(sections[1]).backgroundColor, tileOpacity: tile ? getComputedStyle(tile).opacity : null, tileHasVisibleClass: tile ? tile.classList.contains('is-visible') : null }; })()"
```
Expected: `firstSectionBg` and `secondSectionBg` are different `rgb(...)` values (parchment vs blush), `tileOpacity: "1"`, `tileHasVisibleClass: true` (grid tiles are in the initial viewport on a 1440px-tall-enough page, so the IntersectionObserver should have already fired by the time the script reads it — confirms the reveal mechanism runs, not just that CSS exists).

- [ ] **Step 7: Visual verification — reduced motion**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(() => { const tile = document.querySelector('.reveal-on-scroll'); return { opacity: getComputedStyle(tile).opacity, transitionDuration: getComputedStyle(tile).transitionDuration }; })()" reduce
```
Expected: `opacity: "1"` and `transitionDuration: "0s"` (the `prefers-reduced-motion` media query wins even before the observer would add `is-visible`).

- [ ] **Step 8: Commit**

```bash
git add src/styles.css src/app/shared/reveal-on-scroll/reveal-on-scroll.ts src/app/features/portfolio/portfolio.ts src/app/features/portfolio/portfolio.html
git commit -m "feat(portfolio): add reveal-on-scroll directive, split page into parchment/blush sections with a hand-drawn divider, fix caption contrast"
```

---

## Task 3: Eventi — bloom section, urgency badge, card corner flourish, section split

**Files:**
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:**
- Consumes: `.bg-bloom` (Task 1), `.superpowers/verify/cdp-check.mjs` (Task 1).
- No `.ts` changes — `eventi.ts` bindings (`eventsWithSeats()`, `currentDefinition()`, `selectedEvent()`, `form`, `isPrivato()`, `bookingSuccess()`, `submitting()`, `errorMessage()`, `scrollToPrev()/scrollToNext()/onSliderScroll()/selectEventAndScroll()/onSubmit()/trustedMapUrl()`) are all read, none renamed or altered.

**Design decision (resolves an ambiguity in the spec):** the spec's "showcase treatment" for Eventi is implemented as the corner-flourish accent only, **not** rotation/hover-tilt. The event card is a full-width slide inside a horizontal `snap-x` scroller (`w-full min-w-full`) — rotating or tilting a full-bleed slide would visually clip against its neighbors and serves no one on a touch device (hover-tilt has no touch equivalent). The corner flourish alone (inward-positioned, so it survives the card's `overflow-hidden`) delivers the vetrina accent without that risk.

- [ ] **Step 1: Rewrite `src/app/features/eventi/eventi.html`**

Replace the entire file content with:

```html
<!-- SEZIONE EVENTI SLIDER -->
<section class="bg-blush bg-bloom min-h-screen py-24 px-4 relative flex flex-col items-center justify-center">
  <h1 class="text-4xl md:text-6xl text-gray-900 font-title mb-4 tracking-wide text-center">
    I Nostri Prossimi Eventi
  </h1>

  <!-- Blocco Definizione Dinamico -->
  <div class="max-w-xl w-full bg-white border border-gray-200 rounded p-6 mb-12 text-center shadow-lg font-title italic text-base md:text-lg text-gray-800 min-h-40 flex flex-col justify-center gap-1 tracking-wide">
    @for (def of currentDefinition(); track $index; let i = $index) {
      @if (i === 0) {
        <span class="text-xl md:text-2xl font-semibold font-title not-italic text-gray-900 mb-1">{{ def }}</span>
      } @else if (i === 1) {
        <span class="text-xs tracking-widest uppercase font-body not-italic text-gray-600 mb-2">{{ def }}</span>
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
        <div class="relative w-full min-w-full bg-white rounded shadow-lg overflow-hidden z-10 flex flex-col md:flex-row border border-gray-200 snap-start shrink-0">
          <span class="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-moss rounded-tr-md pointer-events-none z-20"></span>
          <div class="p-6 md:p-10 md:w-1/2 flex flex-col justify-center text-left">
            <h3 class="text-2xl md:text-4xl font-title font-medium text-gray-900 mb-1 tracking-wide">{{ ev.title }}</h3>

            <p
              class="inline-flex w-fit items-center gap-1.5 text-xs md:text-sm font-title italic mb-4 px-3 py-1.5 rounded-full"
              [class.text-red-500]="ev.isSoldOut"
              [class.font-bold]="ev.isSoldOut"
              [class.bg-plum]="!ev.isSoldOut"
              [class.text-white]="!ev.isSoldOut"
            >
              @if (ev.isSoldOut) {
                <app-icon name="alert-triangle" [size]="16" /> Attenzione: Posti esauriti per questa data
              } @else {
                <app-icon name="sparkles" [size]="16" /> Solo {{ ev.seatsAvailable }} posti ancora disponibili
              }
            </p>

            <p class="text-sm text-gray-600 font-medium leading-relaxed mb-6">{{ ev.message.body }}</p>

            <div class="space-y-2 mb-6 text-xs md:text-sm text-gray-600 font-medium border-l-2 border-gray-200 pl-4">
              <p class="flex items-center gap-2"><app-icon name="calendar" [size]="15" /> <span>{{ ev.date }}</span> • <span>{{ ev.time }}</span></p>
              <p class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" /> <span>{{ ev.location }}</span>, <span class="text-gray-600">{{ ev.address }}</span></p>
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

<!-- Separatore -->
<div class="bg-parchment py-10 flex items-center justify-center">
  <div class="flex items-center gap-3 w-2/3 max-w-xs">
    <span class="flex-1 h-px bg-gray-200"></span>
    <span class="w-1.5 h-1.5 rounded-full bg-bark"></span>
    <span class="flex-1 h-px bg-gray-200"></span>
  </div>
</div>

<!-- SEZIONE PRENOTAZIONE / FORM -->
<section #bookingSection class="bg-parchment min-h-screen py-24 px-4 relative flex flex-col items-center justify-center">
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
          <label for="event-select" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Seleziona l'evento *</label>
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
            <label for="user-name" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Nome e Cognome *</label>
            <input type="text" id="user-name" formControlName="name" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="Emanuela Viola">
          </div>
          <div>
            <label for="user-email" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Email *</label>
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
          <label for="billing-type" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Tipologia Account *</label>
          <select id="billing-type" formControlName="billingType" class="w-full p-3 border border-gray-200 rounded bg-white focus:border-moss focus:outline-none font-medium text-gray-800">
            <option value="privato">Privato (Ricevuta con Codice Fiscale)</option>
            <option value="business">Azienda / Libero Professionista (Fattura con P.IVA)</option>
          </select>
        </div>

        @if (isPrivato()) {
          <div>
            <label for="user-cf" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Codice Fiscale *</label>
            <input type="text" id="user-cf" formControlName="cf" maxlength="16" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800 uppercase" placeholder="FMTLNZ90A01F205X">
          </div>
        } @else {
          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="company-name" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Ragione Sociale *</label>
                <input type="text" id="company-name" formControlName="companyName" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="Studio d'Arte S.r.l.">
              </div>
              <div>
                <label for="company-piva" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Partita IVA *</label>
                <input type="text" id="company-piva" formControlName="companyPiva" maxlength="11" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="11 cifre numeriche">
              </div>
            </div>
            <div>
              <label for="company-sdi" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Codice Destinatario SDI *</label>
              <input type="text" id="company-sdi" formControlName="companySdi" maxlength="7" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800 uppercase" placeholder="M5UXCR1">
            </div>
          </div>
        }

        <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2 pt-4">3. Indirizzo di Residenza o Sede</p>
        <div>
          <label for="billing-address" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Via e Numero Civico *</label>
          <input type="text" id="billing-address" formControlName="address" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="Corso Umberto I, 45">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label for="billing-cap" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">CAP *</label>
            <input type="text" id="billing-cap" formControlName="cap" maxlength="5" class="w-full p-3 border border-gray-200 rounded focus:border-moss focus:outline-none font-medium text-gray-800" placeholder="74121">
          </div>
          <div class="sm:col-span-2">
            <label for="billing-city" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Città e Provincia *</label>
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

- [ ] **Step 2: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Visual verification — bloom, section split, badge, flourish**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/eventi" "(() => { const sections = [...document.querySelectorAll('section')]; const badge = document.querySelector('.bg-plum.rounded-full'); const flourish = document.querySelector('.border-moss.rounded-tr-md'); return { sliderSectionBg: getComputedStyle(sections[0]).backgroundColor, formSectionBg: getComputedStyle(sections[1]).backgroundColor, hasBadge: !!badge, badgeTextColor: badge ? getComputedStyle(badge).color : null, hasFlourish: !!flourish }; })()"
```
Expected: `sliderSectionBg` (blush) differs from `formSectionBg` (parchment), `hasBadge: true`, `badgeTextColor: "rgb(255, 255, 255)"`, `hasFlourish: true`.

- [ ] **Step 4: Visual verification — mobile, no overflow**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 390 "http://localhost:4200/eventi" "(() => ({ scrollWidth: document.documentElement.scrollWidth }))()"
```
Expected: `innerWidth: 390` and `result: {"scrollWidth":390}` — the inward-positioned flourish and the new badge must not introduce horizontal overflow on a real 390px viewport.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/eventi/eventi.html
git commit -m "feat(eventi): add bloom section, plum urgency badge, card corner flourish, parchment booking section, fix caption contrast"
```

---

## Task 4: Shop — bloom banner, corner flourish, section split, reveal-on-scroll

**Files:**
- Modify: `src/app/features/shop/shop.ts`
- Modify: `src/app/features/shop/shop.html`

**Interfaces:**
- Consumes: `.bg-bloom` (Task 1), `RevealOnScroll` directive (Task 2), `.superpowers/verify/cdp-check.mjs` (Task 1).
- No changes to `shopUrl`/`products` bindings.

- [ ] **Step 1: Wire the directive into Shop**

Replace `src/app/features/shop/shop.ts` entirely with:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ContentService } from '../../core/services/content.service';
import { RevealOnScroll } from '../../shared/reveal-on-scroll/reveal-on-scroll';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [NgOptimizedImage, RevealOnScroll],
  templateUrl: './shop.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shop {
  private readonly content = inject(ContentService);

  protected readonly shopUrl = this.content.shopUrl;
  protected readonly products = this.content.shopProducts;
}
```

- [ ] **Step 2: Rewrite `src/app/features/shop/shop.html`**

Replace the entire file content with:

```html
<section class="bg-blush bg-bloom py-20 px-4">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-4xl md:text-6xl text-gray-900 font-title mb-4 tracking-wide text-center">Shop</h1>
    <p class="text-center text-gray-600 max-w-xl mx-auto mb-12 text-sm md:text-base">
      Stampe, cartoline e piccoli oggetti illustrati da Silvia, disponibili sul negozio Etsy.
    </p>

    <!-- Banner CTA -->
    <div class="relative bg-gray-900 text-white rounded p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
      <span class="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-sage rounded-tr-md pointer-events-none z-20"></span>
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
  </div>
</section>

<!-- Separatore -->
<div class="bg-parchment py-10 flex items-center justify-center">
  <div class="flex items-center gap-3 w-2/3 max-w-xs">
    <span class="flex-1 h-px bg-gray-200"></span>
    <span class="w-1.5 h-1.5 rounded-full bg-bark"></span>
    <span class="flex-1 h-px bg-gray-200"></span>
  </div>
</div>

<section class="bg-parchment pb-24 px-4">
  <div class="max-w-6xl mx-auto">
    <!-- Griglia prodotti -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
      @for (product of products; track product.id) {
        <article appRevealOnScroll class="bg-white border border-gray-200 shadow-sm hover:shadow-lg hover:border-plum transition-all overflow-hidden flex flex-col">
          <div class="relative w-full aspect-square bg-gray-50">
            <img [ngSrc]="product.image" fill loading="lazy" [alt]="product.title" class="object-contain p-6" />
          </div>
          <div class="p-5 flex flex-col grow text-left">
            <h3 class="font-title italic text-lg text-gray-900 tracking-wide mb-1">{{ product.title }}</h3>
            <p class="text-xs text-gray-600 leading-relaxed mb-4 grow">{{ product.description }}</p>
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

    <p class="text-center text-gray-600 text-xs mt-12">
      * Prodotti di esempio in attesa del collegamento al negozio Etsy definitivo.
    </p>
  </div>
</section>
```

- [ ] **Step 3: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual verification**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/shop" "(() => { const sections = [...document.querySelectorAll('section')]; const flourish = document.querySelector('.border-sage.rounded-tr-md'); const card = document.querySelector('.reveal-on-scroll'); return { bannerSectionBg: getComputedStyle(sections[0]).backgroundColor, gridSectionBg: getComputedStyle(sections[1]).backgroundColor, hasFlourish: !!flourish, cardOpacity: card ? getComputedStyle(card).opacity : null }; })()"
```
Expected: `bannerSectionBg` (blush) differs from `gridSectionBg` (parchment), `hasFlourish: true`, `cardOpacity: "1"`.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/shop/shop.ts src/app/features/shop/shop.html
git commit -m "feat(shop): add bloom banner section, corner flourish, parchment product section, reveal-on-scroll cards, fix caption contrast"
```

---

## Task 5: Final QA pass across all four pages

**Files:** none (verification only — no code changes expected; if a check fails, fix the specific file it points to and re-run that task's own build/verify steps before returning here).

**Interfaces:** none.

- [ ] **Step 1: Full build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors or warnings introduced by this phase.

- [ ] **Step 2: Desktop + mobile sweep, all four routes**

For each of `/`, `/portfolio`, `/eventi`, `/shop`, run at both `1440` and `390`:

```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/<route>" "(() => ({ scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.getBoundingClientRect().width }))()"
node .superpowers/verify/cdp-check.mjs 390 "http://localhost:4200/<route>" "(() => ({ scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.getBoundingClientRect().width }))()"
```
Expected for every route/width pair: `innerWidth` matches the requested width, and `result.scrollWidth` equals that same width (no horizontal overflow introduced by the new corner flourishes, badges, or bloom backgrounds).

- [ ] **Step 3: Contrast spot-check**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(() => { const caption = document.querySelector('.grid p.font-body'); return getComputedStyle(caption).color; })()"
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/shop" "(() => { const desc = document.querySelector('article p.text-xs'); return getComputedStyle(desc).color; })()"
```
Expected: both print `result: "rgb(107, 88, 66)"` (`#6B5842`, `gray-600`) — confirms the contrast fix landed in both files, not just one.

- [ ] **Step 4: Reduced-motion sweep**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(() => { const t = document.querySelector('.reveal-on-scroll'); return getComputedStyle(t).transitionDuration; })()" reduce
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/shop" "(() => { const t = document.querySelector('.reveal-on-scroll'); return getComputedStyle(t).transitionDuration; })()" reduce
```
Expected: both print `result: "0s"`.

- [ ] **Step 5: Stop the dev server**

Stop the `npx ng serve` background process started in Task 1.

- [ ] **Step 6: Commit**

If Steps 1–4 required no fixes, this is a verification-only checkpoint — commit nothing new. If any fix was needed, it was already committed as part of re-running the owning task's steps; just confirm `git status` is clean:

```bash
git status --short
```
Expected: no output (working tree clean) other than any pre-existing unrelated local changes.

---

## Self-review notes

- **Spec coverage:** §1 rhythm → Tasks 2/3/4 section splits. §2 bloom → Task 1 (CSS) + Tasks 1/3/4 (usage). §3 dividers → Tasks 2/3/4. §4 showcase frames → Task 1 (Home, with rotation/tilt) and Tasks 3/4 (Eventi/Shop, flourish-only — deviation documented above with rationale). §5 badges → Task 3. §6 animations → Task 2 (directive + CSS) + Tasks 2/4 (usage) + reduced-motion checks in both. §7 contrast → every task touches its file's `gray-400`/`gray-500` instances.
- **Type/name consistency:** `RevealOnScroll` (class name) / `appRevealOnScroll` (selector) is identical across Task 2 (definition), Task 2 (Portfolio usage), and Task 4 (Shop usage). `.bg-bloom` class name is identical across Task 1 (definition) and Tasks 3/4 (usage).
- **No placeholders:** every step has literal file content or literal commands with literal expected output.
