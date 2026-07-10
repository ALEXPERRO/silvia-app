# Quick fixes + Fase 2 (ridotta) + Fase 3 + Fase 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the navbar (dropping the logo/wordmark), refresh the Home hero (remove the leaf icon, add the `title.png` wordmark above the photo, add four decorative artwork accents), clean up dead code the user's own edit orphaned in Eventi, add a working newsletter signup + placeholder Instagram link to the footer, add a booking-form progress indicator and slider position dots to Eventi, and add lightbox prev/next navigation + basic image-drag/right-click protection to Portfolio — per `docs/superpowers/specs/2026-07-10-fixes-and-phases-2-4-design.md`.

**Architecture:** Continues directly on top of the Fase 1 visual-polish design system (same tokens, same `Icon` component pattern, same reactive-forms/Supabase patterns already used by the Eventi booking form). One new Supabase table (`iscrizioni_newsletter`) and one new `SupabaseService` method. One new `Icon` case (`instagram`). No routing changes, no changes to the booking form's existing field set/validators/submission logic, no changes to gallery-filtering logic.

**Tech Stack:** Angular 20 standalone components, Tailwind CSS v4, `NgOptimizedImage`, Reactive Forms, Supabase JS client.

## Global Constraints

- **Existing color tokens only**: parchment `#F7EFDF`, blush `#EEDCC7`, surface/"white" `#FBF6EC`, moss `#5C6B33`, moss-hover `#47531F`, sage `#8A9A6E`, bark `#7C6248`, plum `#6E4F6B`, plum-hover `#5A3F58`, gray-200/rule `#CDAF80`, gray-600 `#6B5842`, gray-900/ink `#2C2415`. Caption/label text stays `text-gray-600` minimum (established in Fase 1) — do not introduce new `text-gray-400`/`text-gray-500` instances.
- **No changes to**: routing, gallery-filtering logic (`activeCategory`, `filteredItems`), the booking form's field set/validators/`onSubmit`/Supabase seat-decrement logic, the event slider's scroll-snap mechanics (`scrollToNext`/`scrollToPrev`/`onSliderScroll`), `ContentService`'s `events`/`shopProducts`/`galleryItems` data.
- **New `Icon` cases follow the existing organic line-icon convention exactly**: `viewBox="0 0 24 24"`, inherited `stroke="currentColor"` / `stroke-width="1.7"` / `stroke-linecap="round"` / `stroke-linejoin="round"` from the shared `<svg>` wrapper — a new `@case` only adds `<path>` elements, nothing else.
- **NgOptimizedImage**: every new `<img [ngSrc]>`/`<img ngSrc>` needs `width`/`height` attributes matching the source file's real aspect ratio (not the displayed CSS size) to avoid a console warning. Decorative images get `alt=""` and no `priority` (lazy-load is correct for them).
- **No unit test suite exists for this project.** Verification is `npx ng build` plus the CDP-based visual check via `.superpowers/verify/cdp-check.mjs` (created in the Fase 1 plan; if it's missing from disk when a task runs, recreate it verbatim from `docs/superpowers/plans/2026-07-10-visual-polish-phase1.md` Task 1 Step 1 before proceeding — do not invent a different script). Do not trust plain `--window-size=W,H` headless-Edge screenshots for mobile widths; always use `Emulation.setDeviceMetricsOverride` and confirm `window.innerWidth` first.
- **The newsletter feature requires a manual step from the user** (running SQL in their Supabase dashboard) before end-to-end submission works. The implementing task must build and verify everything that doesn't require that step (rendering, client-side validation, error-state UI) and clearly flag in its report that live-insert verification is blocked on the user running the SQL — this is expected, not a task failure.
- Every task ends with `npx ng build` passing and a commit. Commit only the files the task lists.

---

## Task 1: Navbar — remove logo/wordmark, center the tabs

**Files:**
- Modify: `src/app/layout/navbar/navbar.html`
- Modify: `src/app/layout/navbar/navbar.ts`

**Interfaces:** None — purely presentational, no new bindings.

- [ ] **Step 1: Rewrite `src/app/layout/navbar/navbar.html`**

Replace the entire file content with:

```html
<nav class="fixed top-0 left-0 w-full bg-parchment text-gray-800 z-50 shadow-sm border-b border-gray-200">
  <div class="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-center gap-4">
    <ul class="flex items-center gap-4 md:gap-7 font-semibold text-[11px] md:text-sm tracking-widest uppercase">
      @for (item of navItems; track item.path) {
        <li>
          <a
            [routerLink]="item.path"
            routerLinkActive="active text-moss"
            [routerLinkActiveOptions]="{ exact: item.path === '/' }"
            class="nav-link hover:text-moss transition-colors whitespace-nowrap"
          >
            {{ item.label }}
          </a>
        </li>
      }
    </ul>
  </div>
</nav>
```

(Only change from the previous version: the `<a routerLink="/">` logo+wordmark block is removed; the container's `justify-between` becomes `justify-center`; the `<ul>`'s `gap-2` becomes `gap-4` now that there's no adjacent logo competing for space at narrow widths.)

- [ ] **Step 2: Rewrite `src/app/layout/navbar/navbar.ts`**

Replace the entire file content with:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
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

(Only change: the `NgOptimizedImage` import and its entry in the `imports` array are removed — nothing in the new template uses `ngSrc` anymore.)

- [ ] **Step 3: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors, no "unused import" warnings.

- [ ] **Step 4: Visual verification**

Start the dev server if not already running: `npx ng serve --port 4200`, wait for `Application bundle generation complete`.

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/" "(() => { const nav = document.querySelector('nav > div'); const hasLogo = !!document.querySelector('nav img'); const links = [...document.querySelectorAll('nav a')].map(a => a.textContent.trim()); return { justifyContent: getComputedStyle(nav).justifyContent, hasLogo, links }; })()"
```
Expected: `justifyContent: "center"`, `hasLogo: false`, `links` is exactly `["About me","Portfolio","Eventi","Shop"]`.

Repeat at width `390` and confirm `innerWidth: 390`, same `hasLogo: false`, and no horizontal overflow:
```bash
node .superpowers/verify/cdp-check.mjs 390 "http://localhost:4200/" "(() => ({ scrollWidth: document.documentElement.scrollWidth }))()"
```
Expected: `result: {"scrollWidth":390}`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout/navbar/navbar.html src/app/layout/navbar/navbar.ts
git commit -m "feat(navbar): remove logo/wordmark and center the nav tabs"
```

---

## Task 2: Home hero — remove leaf, add title.png wordmark, add artwork accents

**Files:**
- Modify: `src/app/features/home/home.html`
- Modify: `src/app/features/home/home.ts`
- Modify: `src/app/core/services/content.service.ts`

**Interfaces:** `ContentService.cover.logo` changes from pointing at `images/logo/logo.png` (the circular deer-wreath mark, unused anywhere else in the app — confirmed) to `images/logo/title.png` (the hand-lettered wordmark) — this is a repurpose of an already-unused field, not a new one.

- [ ] **Step 1: Update `cover.logo` in `src/app/core/services/content.service.ts`**

Find this block (near the top of the class):

```ts
  readonly cover = {
    main: { src: 'images/about_me/silvia.jpeg', scale: 1 } satisfies CoverImage,
    logo: { src: 'images/logo/logo.png', scale: 1.3 } satisfies CoverImage,
  };
```

Replace it with:

```ts
  readonly cover = {
    main: { src: 'images/about_me/silvia.jpeg', scale: 1 } satisfies CoverImage,
    logo: { src: 'images/logo/title.png', scale: 1 } satisfies CoverImage,
  };
```

- [ ] **Step 2: Rewrite `src/app/features/home/home.html`**

Replace the entire file content with:

```html
<header class="relative bg-blush bg-bloom min-h-[calc(100vh-64px)] flex items-center px-4 py-16 md:py-0">
  <img ngSrc="images/composizioni/coniglio.png" width="200" height="200" alt="" class="hidden lg:block absolute top-24 left-[4%] w-20 h-20 object-cover rounded border-4 border-white shadow-lg -rotate-6 pointer-events-none" />
  <img ngSrc="images/composizioni/tigre e fiori.png" width="283" height="200" alt="" class="hidden lg:block absolute top-10 right-[6%] w-24 h-24 object-cover rounded border-4 border-white shadow-lg rotate-6 pointer-events-none" />
  <img ngSrc="images/composizioni/maggio.png" width="200" height="250" alt="" class="hidden lg:block absolute bottom-28 left-[8%] w-16 h-16 object-cover rounded border-4 border-white shadow-lg rotate-3 pointer-events-none" />
  <img ngSrc="images/composizioni/topo.png" width="200" height="200" alt="" class="hidden lg:block absolute bottom-12 right-[10%] w-16 h-16 object-cover rounded border-4 border-white shadow-lg -rotate-4 pointer-events-none" />

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
        <img [ngSrc]="cover.logo.src" width="350" height="247" alt="Blooming Wild ART" class="w-40 md:w-48 mx-auto mb-4" />
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

(Changes from the previous version: the `<app-icon name="leaf">` is gone; four decorative `<img>` accents were added as the header's first children, `hidden` below the `lg` breakpoint; a `cover.logo.src` wordmark image was added above the photo frame, inside the photo column.)

- [ ] **Step 3: Rewrite `src/app/features/home/home.ts`**

Replace the entire file content with:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ContentService } from '../../core/services/content.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NgOptimizedImage],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly content = inject(ContentService);

  protected readonly cover = this.content.cover;
}
```

(Only change: the `Icon` import and its entry in the `imports` array are removed — the leaf icon was the only `<app-icon>` usage in this template.)

- [ ] **Step 4: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors, no NgOptimizedImage aspect-ratio warnings for any of the five new/changed `<img>` tags.

- [ ] **Step 5: Visual verification**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/" "(() => { const header = document.querySelector('header'); const decorativeImgs = header.querySelectorAll('img[alt=\"\"]').length; const wordmark = document.querySelector('img[alt=\"Blooming Wild ART\"]'); const leafIcon = document.querySelector('header [class*=leaf]'); return { decorativeImgs, hasWordmark: !!wordmark, hasLeafIcon: !!leafIcon }; })()"
```
Expected: `decorativeImgs: 4`, `hasWordmark: true`, `hasLeafIcon: false`.

Run at `390` to confirm mobile isn't cluttered and has no overflow:
```bash
node .superpowers/verify/cdp-check.mjs 390 "http://localhost:4200/" "(() => { const header = document.querySelector('header'); const visibleDecorative = [...header.querySelectorAll('img[alt=\"\"]')].filter(img => img.getBoundingClientRect().width > 0).length; return { scrollWidth: document.documentElement.scrollWidth, visibleDecorative }; })()"
```
Expected: `scrollWidth: 390` (no overflow), `visibleDecorative: 0` (the four accents are `hidden` below `lg`, i.e. below 1024px, so at 390px none should have a nonzero rendered width).

- [ ] **Step 6: Commit**

```bash
git add src/app/features/home/home.html src/app/features/home/home.ts src/app/core/services/content.service.ts
git commit -m "feat(home): remove leaf icon, add title.png wordmark above the photo, add artwork accents"
```

---

## Task 3: Eventi — remove dead code orphaned by the removed definition block

**Files:**
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/core/models/event.model.ts`
- Modify: `src/app/core/services/content.service.ts`

**Interfaces:** Removes `currentDefinition` (was a `computed<string[]>`, had zero remaining template consumers after the user's manual edit removed the only `<div>` that read it) and the `definition: string[]` field it read. **Keeps** `currentIndex` (signal) and `onSliderScroll()` — Task 5 (slider dots) consumes both.

- [ ] **Step 1: Remove `definition` from `EventMessage` in `src/app/core/models/event.model.ts`**

Find:

```ts
export interface EventMessage {
  definition: string[];
  body: string;
}
```

Replace with:

```ts
export interface EventMessage {
  body: string;
}
```

- [ ] **Step 2: Remove the four `definition: [...]` lines in `src/app/core/services/content.service.ts`**

Each of the four events in the `events` array has a `message: { definition: [...], body: '...' }` block. Remove only the `definition: [...]` line from each (keep `body` and everything else unchanged). The four lines to delete, verbatim:

```ts
        definition: ['whim • sy', "noun  ||  '(h)wim-zel", '1 : playful charm and wonder', '2 : filling life with joy and pleasure', '3 : pure enchantment'],
```
```ts
        definition: ['ar • tis • try', "noun  ||  'är-tə-strē", '1 : artistic quality or ability', '2 : the pursuit of pure expression', '3 : magic on canvas'],
```
```ts
        definition: ['won • der', "noun  ||  'wən-dər", '1 : a feeling of surprise mingled with admiration', '2 : a cause of astonishment', '3 : lightweight dreaming'],
```
```ts
        definition: ['spark', "noun  ||  'spärk", '1 : a small fiery particle', '2 : a latent feeling activated', '3 : the beginning of a masterpiece'],
```

Each event's `message: { ... }` block goes from two lines (`definition:`, `body:`) to one (`body:`).

- [ ] **Step 3: Remove `currentDefinition` from `src/app/features/eventi/eventi.ts`**

Find:

```ts
  protected readonly currentDefinition = computed(() => {
    return this.eventsWithSeats()[this.currentIndex()]?.message.definition ?? [];
  });

```

Delete this block entirely (including the trailing blank line). Do **not** remove `currentIndex` (the signal declared just above it) or `onSliderScroll()` (declared later in the file) — both stay, Task 5 depends on them.

- [ ] **Step 4: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors. Confirm there is no leftover reference to `currentDefinition` or `.message.definition` anywhere (`grep -rn "currentDefinition\|message.definition" src` should return nothing).

- [ ] **Step 5: Visual verification**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/eventi" "(() => ({ scrollWidth: document.documentElement.scrollWidth, hasDefinitionBlock: !!document.querySelector('.font-title.italic.text-base') }))()"
```
Expected: `scrollWidth: 1440` (page still renders correctly), `hasDefinitionBlock: false` (confirms the block stays removed and nothing regenerated it).

- [ ] **Step 6: Commit**

```bash
git add src/app/features/eventi/eventi.ts src/app/core/models/event.model.ts src/app/core/services/content.service.ts
git commit -m "chore(eventi): remove currentDefinition and its definition data field, orphaned by the removed definition block"
```

---

## Task 4: Icon set — add `instagram`

**Files:**
- Modify: `src/app/shared/icon/icon.ts`
- Modify: `src/app/shared/icon/icon.html`

**Interfaces:** Adds `'instagram'` to the `IconName` union — consumed by Task 5 (`<app-icon name="instagram">` in the footer).

- [ ] **Step 1: Add `'instagram'` to the `IconName` union in `src/app/shared/icon/icon.ts`**

Find:

```ts
export type IconName =
  | 'calendar'
  | 'map-pin'
  | 'map'
  | 'ticket'
  | 'sparkles'
  | 'alert-triangle'
  | 'ban'
  | 'x'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'leaf';
```

Replace with:

```ts
export type IconName =
  | 'calendar'
  | 'map-pin'
  | 'map'
  | 'ticket'
  | 'sparkles'
  | 'alert-triangle'
  | 'ban'
  | 'x'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'leaf'
  | 'instagram';
```

- [ ] **Step 2: Add the `instagram` case in `src/app/shared/icon/icon.html`**

Find the `leaf` case (the last one in the `@switch`):

```html
    @case ('leaf') {
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    }
```

Replace with (adds a new `instagram` case right after it):

```html
    @case ('leaf') {
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    }
    @case ('instagram') {
      <path d="M7.2 3.5h9.6c2 0 3.7 1.7 3.7 3.8v9.4c0 2.1-1.7 3.8-3.7 3.8H7.2c-2 0-3.7-1.7-3.7-3.8V7.3c0-2.1 1.7-3.8 3.7-3.8Z" />
      <path d="M12 15.4c1.9 0 3.4-1.5 3.4-3.4S13.9 8.6 12 8.6 8.6 10.1 8.6 12s1.5 3.4 3.4 3.4Z" />
      <path d="M16.6 7v.1" />
    }
```

- [ ] **Step 3: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual verification**

There's no page using the icon yet (Task 5 wires it in), so verify the icon renders in isolation by temporarily checking it compiles and the SVG path data is well-formed — run:
```bash
node -e "const fs = require('fs'); const html = fs.readFileSync('src/app/shared/icon/icon.html', 'utf8'); if (!html.includes(\"case ('instagram')\")) { throw new Error('instagram case missing'); } console.log('instagram case present, ' + (html.match(/<path/g) || []).length + ' total <path> elements in file'); "
```
Expected: prints `instagram case present, N total <path> elements in file` with no error (N should be the previous count + 3).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/icon/icon.ts src/app/shared/icon/icon.html
git commit -m "feat(icons): add instagram icon in the existing organic line-icon style"
```

---

## Task 5: Footer — Instagram link + working newsletter signup

**Files:**
- Modify: `src/app/core/services/supabase.service.ts`
- Modify: `src/app/layout/footer/footer.ts`
- Modify: `src/app/layout/footer/footer.html`

**Interfaces:**
- Consumes: `instagram` icon (Task 4).
- Produces: `SupabaseService.insertNewsletterSignup(email: string): Promise<{ error: unknown }>`.
- Requires a manual step from the user (documented in this task's report, not performed by the implementer): running the SQL below in their Supabase project's SQL editor before live submissions will succeed.

**SQL the user must run (include verbatim in your report so the controller can relay it):**

```sql
create table if not exists public.iscrizioni_newsletter (
  id bigint generated always as identity primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.iscrizioni_newsletter enable row level security;

create policy "Consenti iscrizione anonima" on public.iscrizioni_newsletter
  for insert
  to anon
  with check (true);
```

- [ ] **Step 1: Add `insertNewsletterSignup` to `src/app/core/services/supabase.service.ts`**

Find:

```ts
  async decrementSeats(eventId: number, newSeatCount: number): Promise<{ error: unknown }> {
    const { error } = await this.client
      .from('eventi')
      .update({ posti_disponibili: newSeatCount })
      .eq('id', eventId);
    return { error };
  }
}
```

Replace with:

```ts
  async decrementSeats(eventId: number, newSeatCount: number): Promise<{ error: unknown }> {
    const { error } = await this.client
      .from('eventi')
      .update({ posti_disponibili: newSeatCount })
      .eq('id', eventId);
    return { error };
  }

  async insertNewsletterSignup(email: string): Promise<{ error: unknown }> {
    const { error } = await this.client.from('iscrizioni_newsletter').insert([{ email }]);
    return { error };
  }
}
```

- [ ] **Step 2: Rewrite `src/app/layout/footer/footer.ts`**

Replace the entire file content with:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContentService } from '../../core/services/content.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  private readonly content = inject(ContentService);
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

  protected readonly footer = this.content.footer;

  protected readonly newsletterForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly newsletterSubmitting = signal(false);
  protected readonly newsletterSuccess = signal(false);
  protected readonly newsletterError = signal<string | null>(null);

  async onNewsletterSubmit(): Promise<void> {
    this.newsletterError.set(null);

    if (this.newsletterForm.invalid) {
      this.newsletterForm.markAllAsTouched();
      return;
    }

    this.newsletterSubmitting.set(true);
    const email = this.newsletterForm.getRawValue().email;

    const { error } = await this.supabase.insertNewsletterSignup(email);

    if (error) {
      const isDuplicate = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
      this.newsletterError.set(isDuplicate ? 'Questa email è già iscritta.' : 'Si è verificato un problema. Riprova.');
      this.newsletterSubmitting.set(false);
      return;
    }

    this.newsletterSubmitting.set(false);
    this.newsletterSuccess.set(true);
  }
}
```

- [ ] **Step 3: Rewrite `src/app/layout/footer/footer.html`**

Replace the entire file content with:

```html
<footer class="bg-white text-gray-800 text-center py-10 px-4 border-t border-gray-200 z-20 relative text-sm">
  <p class="font-title italic text-2xl tracking-wide text-moss">{{ footer.text }}</p>

  <a href="#" target="_blank" rel="noopener" aria-label="Instagram" class="inline-flex items-center justify-center mt-5 text-gray-600 hover:text-plum transition-colors">
    <app-icon name="instagram" [size]="22" />
  </a>

  <form [formGroup]="newsletterForm" (ngSubmit)="onNewsletterSubmit()" class="max-w-sm mx-auto mt-6 flex flex-col items-center gap-2">
    @if (!newsletterSuccess()) {
      <label for="newsletter-email" class="text-xs font-bold text-gray-600 uppercase tracking-widest">Resta aggiornata/o sulle novità</label>
      <div class="flex w-full gap-2">
        <input
          type="email"
          id="newsletter-email"
          formControlName="email"
          placeholder="La tua email"
          class="flex-1 p-2.5 border border-gray-200 rounded bg-white focus:border-moss focus:outline-none text-gray-800 text-sm"
        />
        <button
          type="submit"
          [disabled]="newsletterSubmitting()"
          class="bg-moss text-white text-xs font-semibold tracking-widest uppercase px-4 py-2.5 rounded hover:bg-moss-hover transition-all disabled:opacity-50"
        >
          {{ newsletterSubmitting() ? '...' : 'Iscriviti' }}
        </button>
      </div>
      @if (newsletterError(); as err) {
        <p class="text-red-500 text-xs">{{ err }}</p>
      }
    } @else {
      <p class="text-moss font-medium text-sm flex items-center gap-1.5">
        <app-icon name="sparkles" [size]="16" /> Iscrizione confermata, grazie!
      </p>
    }
  </form>

  <p class="text-xs text-gray-500 tracking-wider font-light mt-6">{{ footer.credits }}</p>
</footer>
```

- [ ] **Step 4: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 5: Visual verification — rendering and client-side validation**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/" "(() => { const igLink = document.querySelector('footer a[aria-label=\"Instagram\"]'); const form = document.querySelector('footer form'); const input = document.getElementById('newsletter-email'); const button = form.querySelector('button[type=submit]'); return { hasInstagramLink: !!igLink, hasForm: !!form, hasEmailInput: !!input, buttonText: button.textContent.trim() }; })()"
```
Expected: `hasInstagramLink: true`, `hasForm: true`, `hasEmailInput: true`, `buttonText: "Iscriviti"`.

Verify client-side validation without needing the Supabase table to exist yet — submit with an invalid email and confirm the form does NOT call Supabase (stays on the invalid state, no submitting spinner):
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/" "(() => { const input = document.getElementById('newsletter-email'); const form = document.querySelector('footer form'); input.value = 'not-an-email'; input.dispatchEvent(new Event('input')); form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); return { formStillVisible: !!document.querySelector('footer form'), successMessageShown: !!document.querySelector('footer form + *')?.textContent?.includes('confermata') }; })()"
```
Expected: `formStillVisible: true` (an invalid email must not proceed to the success state).

Do **not** attempt to verify a successful live submission — the `iscrizioni_newsletter` table does not exist until the user runs the SQL above. Note this explicitly in your report rather than treating it as a failure.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/supabase.service.ts src/app/layout/footer/footer.ts src/app/layout/footer/footer.html
git commit -m "feat(footer): add Instagram placeholder link and a working newsletter signup"
```

---

## Task 6: Eventi — booking-form progress indicator

**Files:**
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:** Adds three `computed<boolean>` signals (`step1Complete`, `step2Complete`, `step3Complete`) — presentation-only, do not affect `onSubmit()` or any validator.

- [ ] **Step 1: Add the step-completion computed signals to `src/app/features/eventi/eventi.ts`**

Find:

```ts
  protected readonly isPrivato = computed(() => this.billingType() === 'privato');
```

Replace with:

```ts
  protected readonly isPrivato = computed(() => this.billingType() === 'privato');

  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  protected readonly step1Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    return c.eventId.valid && c.name.valid && c.email.valid;
  });

  protected readonly step2Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    return this.isPrivato() ? c.cf.valid : c.companyName.valid && c.companyPiva.valid && c.companySdi.valid;
  });

  protected readonly step3Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    return c.address.valid && c.cap.valid && c.city.valid;
  });
```

(`toSignal` and `computed` are already imported in this file — no new imports needed. `this.formStatus()` is called only to create a reactive dependency on the form's status stream; its value is discarded, the actual completeness check reads each control's `.valid` getter directly, same idiom already used by `isPrivato`/`selectedEvent` in this file.)

- [ ] **Step 2: Add the progress indicator to `src/app/features/eventi/eventi.html`**

Find:

```html
    @if (!bookingSuccess()) {
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6 text-left text-sm">
```

Replace with:

```html
    @if (!bookingSuccess()) {
      <div class="flex items-center justify-center gap-2 mb-8 text-[10px] md:text-xs font-semibold tracking-widest uppercase">
        <span class="flex items-center gap-1.5" [class.text-moss]="step1Complete()" [class.text-gray-400]="!step1Complete()">
          <span
            class="w-5 h-5 rounded-full border flex items-center justify-center"
            [class.bg-moss]="step1Complete()"
            [class.border-moss]="step1Complete()"
            [class.text-white]="step1Complete()"
            [class.border-gray-300]="!step1Complete()"
          >1</span>
          Dati
        </span>
        <span class="w-6 h-px bg-gray-200"></span>
        <span class="flex items-center gap-1.5" [class.text-moss]="step2Complete()" [class.text-gray-400]="!step2Complete()">
          <span
            class="w-5 h-5 rounded-full border flex items-center justify-center"
            [class.bg-moss]="step2Complete()"
            [class.border-moss]="step2Complete()"
            [class.text-white]="step2Complete()"
            [class.border-gray-300]="!step2Complete()"
          >2</span>
          Fatturazione
        </span>
        <span class="w-6 h-px bg-gray-200"></span>
        <span class="flex items-center gap-1.5" [class.text-moss]="step3Complete()" [class.text-gray-400]="!step3Complete()">
          <span
            class="w-5 h-5 rounded-full border flex items-center justify-center"
            [class.bg-moss]="step3Complete()"
            [class.border-moss]="step3Complete()"
            [class.text-white]="step3Complete()"
            [class.border-gray-300]="!step3Complete()"
          >3</span>
          Indirizzo
        </span>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6 text-left text-sm">
```

- [ ] **Step 3: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual verification**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/eventi" "(() => { const steps = [...document.querySelectorAll('form')[0].previousElementSibling.querySelectorAll('span.w-5.h-5')]; return steps.map(s => getComputedStyle(s).backgroundColor); })()"
```
Expected: an array of 3 colors, all matching the un-filled state (`rgba(0, 0, 0, 0)` or the gray-300 border color, since no field is filled yet) — confirms all three steps render in their "incomplete" visual state on a fresh page load.

Then simulate filling step 1 and confirm it flips to `moss`:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/eventi" "(() => { const select = document.getElementById('event-select'); select.value = select.options[1].value; select.dispatchEvent(new Event('change', { bubbles: true })); const name = document.getElementById('user-name'); name.value = 'Test'; name.dispatchEvent(new Event('input', { bubbles: true })); const email = document.getElementById('user-email'); email.value = 'test@example.com'; email.dispatchEvent(new Event('input', { bubbles: true })); const step1Dot = document.querySelectorAll('span.w-5.h-5')[0]; return getComputedStyle(step1Dot).backgroundColor; })()"
```
Expected: `result: "rgb(92, 107, 51)"` (moss, `#5C6B33`) — confirms the indicator reacts to real form state, not just renders statically.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/eventi/eventi.ts src/app/features/eventi/eventi.html
git commit -m "feat(eventi): add a booking-form progress indicator (1 Dati / 2 Fatturazione / 3 Indirizzo)"
```

---

## Task 7: Eventi — slider position dots

**Files:**
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:** Adds `goToSlide(index: number): void`. Consumes the existing `currentIndex` signal (kept alive by Task 3) and the existing `sliderRef` ViewChild.

- [ ] **Step 1: Add `goToSlide` to `src/app/features/eventi/eventi.ts`**

Find:

```ts
  onSliderScroll(event: Event): void {
    const el = event.target as HTMLDivElement;
    const width = el.getBoundingClientRect().width;
    if (width > 0) {
      this.currentIndex.set(Math.round(el.scrollLeft / width));
    }
  }
```

Replace with:

```ts
  onSliderScroll(event: Event): void {
    const el = event.target as HTMLDivElement;
    const width = el.getBoundingClientRect().width;
    if (width > 0) {
      this.currentIndex.set(Math.round(el.scrollLeft / width));
    }
  }

  goToSlide(index: number): void {
    const el = this.sliderRef?.nativeElement;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    el.scrollTo({ left: index * width, behavior: 'smooth' });
  }
```

- [ ] **Step 2: Add the dots row to `src/app/features/eventi/eventi.html`**

Find (the closing tag of the slider's outer flex container, right before the outer `<button (click)="scrollToNext()">` closes and the container `</div>` follows — locate this exact three-line sequence that ends the slider block):

```html
    <button
      type="button"
      (click)="scrollToNext()"
      class="absolute right-0 md:-right-4 z-30 bg-white text-gray-700 w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center shadow-md hover:bg-gray-50 hover:border-plum active:scale-95 transition-all select-none"
    >
      <app-icon name="chevron-right" [size]="20" />
    </button>
  </div>
</section>
```

Replace with:

```html
    <button
      type="button"
      (click)="scrollToNext()"
      class="absolute right-0 md:-right-4 z-30 bg-white text-gray-700 w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center shadow-md hover:bg-gray-50 hover:border-plum active:scale-95 transition-all select-none"
    >
      <app-icon name="chevron-right" [size]="20" />
    </button>
  </div>

  <div class="flex items-center justify-center gap-2 mt-4">
    @for (ev of eventsWithSeats(); track ev.id; let i = $index) {
      <button
        type="button"
        (click)="goToSlide(i)"
        [attr.aria-label]="'Vai a ' + ev.title"
        class="w-2.5 h-2.5 rounded-full transition-colors"
        [class.bg-moss]="i === currentIndex()"
        [class.bg-gray-200]="i !== currentIndex()"
      ></button>
    }
  </div>
</section>
```

(The dots row is a new sibling `<div>` inside `<section>`, after the slider's `<div class="relative w-full max-w-5xl ...">` container closes, before `</section>`.)

- [ ] **Step 3: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual verification**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/eventi" "(() => { const dots = [...document.querySelectorAll('button[aria-label^=\"Vai a\"]')]; return { count: dots.length, firstDotColor: getComputedStyle(dots[0]).backgroundColor }; })()"
```
Expected: `count` equals the number of events (4, per `content.service.ts`), `firstDotColor: "rgb(92, 107, 51)"` (moss — the first slide is active by default since `currentIndex` starts at 0).

Click the third dot and confirm the active dot changes:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/eventi" "(async () => { const dots = [...document.querySelectorAll('button[aria-label^=\"Vai a\"]')]; dots[2].click(); await new Promise(r => setTimeout(r, 800)); return { thirdDotColor: getComputedStyle(dots[2]).backgroundColor, firstDotColor: getComputedStyle(dots[0]).backgroundColor }; })()"
```
Expected: `thirdDotColor: "rgb(92, 107, 51)"`, `firstDotColor` no longer moss (the `onSliderScroll` handler fires from the smooth-scroll and updates `currentIndex`).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/eventi/eventi.ts src/app/features/eventi/eventi.html
git commit -m "feat(eventi): add clickable slider position dots"
```

---

## Task 8: Portfolio — lightbox prev/next navigation + basic image protection

**Files:**
- Modify: `src/app/features/portfolio/portfolio.ts`
- Modify: `src/app/features/portfolio/portfolio.html`

**Interfaces:** Adds `lightboxIndex` (computed), `showNext()`, `showPrev()`, and a document-level keydown listener — all scoped to when the lightbox is open. No change to `filteredItems`/`setCategory`/`openLightbox`/`closeLightbox`.

- [ ] **Step 1: Rewrite `src/app/features/portfolio/portfolio.ts`**

Replace the entire file content with:

```ts
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
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
  private readonly content = inject(ContentService);
  private readonly allItems = this.content.galleryItems;

  protected readonly categories = this.content.galleryCategories;
  protected readonly activeCategory = signal<GalleryCategory | 'tutte'>('tutte');
  protected readonly lightboxItem = signal<GalleryItem | null>(null);

  protected readonly filteredItems = computed(() => {
    const category = this.activeCategory();
    return category === 'tutte' ? this.allItems : this.allItems.filter((item) => item.category === category);
  });

  protected readonly lightboxIndex = computed(() => {
    const item = this.lightboxItem();
    if (!item) return -1;
    return this.filteredItems().findIndex((i) => i.src === item.src);
  });

  setCategory(category: GalleryCategory | 'tutte'): void {
    this.activeCategory.set(category);
  }

  openLightbox(item: GalleryItem): void {
    this.lightboxItem.set(item);
  }

  closeLightbox(): void {
    this.lightboxItem.set(null);
  }

  showNext(): void {
    const items = this.filteredItems();
    const idx = this.lightboxIndex();
    if (idx === -1 || items.length === 0) return;
    this.lightboxItem.set(items[(idx + 1) % items.length]);
  }

  showPrev(): void {
    const items = this.filteredItems();
    const idx = this.lightboxIndex();
    if (idx === -1 || items.length === 0) return;
    this.lightboxItem.set(items[(idx - 1 + items.length) % items.length]);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.lightboxItem()) return;
    if (event.key === 'ArrowRight') this.showNext();
    if (event.key === 'ArrowLeft') this.showPrev();
    if (event.key === 'Escape') this.closeLightbox();
  }
}
```

- [ ] **Step 2: Update the lightbox and grid thumbnail markup in `src/app/features/portfolio/portfolio.html`**

Find the grid thumbnail `<img>`:

```html
          <img
            [ngSrc]="item.src"
            fill
            loading="lazy"
            [alt]="item.title"
            class="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          />
```

Replace with:

```html
          <img
            [ngSrc]="item.src"
            fill
            loading="lazy"
            [alt]="item.title"
            class="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            (contextmenu)="$event.preventDefault()"
            draggable="false"
          />
```

Find the entire lightbox block:

```html
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

Replace with:

```html
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
    <button
      type="button"
      (click)="$event.stopPropagation(); showPrev()"
      class="absolute left-4 md:left-8 text-white hover:text-plum-hover transition-colors"
      aria-label="Immagine precedente"
    >
      <app-icon name="chevron-left" [size]="32" />
    </button>
    <button
      type="button"
      (click)="$event.stopPropagation(); showNext()"
      class="absolute right-4 md:right-8 text-white hover:text-plum-hover transition-colors"
      aria-label="Immagine successiva"
    >
      <app-icon name="chevron-right" [size]="32" />
    </button>
    <figure class="max-w-2xl w-full" (click)="$event.stopPropagation()">
      <div class="relative w-full aspect-square bg-white border-[6px] border-white overflow-hidden">
        <img [ngSrc]="item.src" fill [alt]="item.title" class="object-contain p-6" (contextmenu)="$event.preventDefault()" draggable="false" />
      </div>
      <figcaption class="text-center text-white font-body text-[11px] tracking-[0.15em] uppercase mt-4">{{ item.title }}</figcaption>
    </figure>
  </div>
}
```

- [ ] **Step 3: Build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 4: Visual verification**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(async () => { document.querySelector('.grid button').click(); await new Promise(r => setTimeout(r, 200)); const caption1 = document.querySelector('figcaption').textContent.trim(); document.querySelector('button[aria-label=\"Immagine successiva\"]').click(); await new Promise(r => setTimeout(r, 200)); const caption2 = document.querySelector('figcaption').textContent.trim(); return { caption1, caption2, changed: caption1 !== caption2 }; })()"
```
Expected: `changed: true` — clicking "next" inside the lightbox moves to a different item.

Confirm keyboard navigation and Escape:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(async () => { document.querySelector('.grid button').click(); await new Promise(r => setTimeout(r, 200)); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise(r => setTimeout(r, 200)); return { lightboxOpen: !!document.querySelector('figcaption') }; })()"
```
Expected: `lightboxOpen: false`.

Confirm the image-protection attributes are present:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(() => { const img = document.querySelector('.grid img'); return { draggable: img.getAttribute('draggable') }; })()"
```
Expected: `draggable: "false"`.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/portfolio/portfolio.ts src/app/features/portfolio/portfolio.html
git commit -m "feat(portfolio): add lightbox prev/next navigation (click + keyboard) and basic image-drag/right-click protection"
```

---

## Task 9: Final QA pass across all four pages

**Files:** none (verification only — no code changes expected; if a check fails, fix the specific file it points to and re-run that task's own build/verify steps before returning here).

**Interfaces:** none.

- [ ] **Step 1: Full build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors or warnings introduced by this work.

- [ ] **Step 2: Desktop + mobile sweep, all four routes**

For each of `/`, `/portfolio`, `/eventi`, `/shop`, run at both `1440` and `390`:

```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/<route>" "(() => ({ scrollWidth: document.documentElement.scrollWidth }))()"
node .superpowers/verify/cdp-check.mjs 390 "http://localhost:4200/<route>" "(() => ({ scrollWidth: document.documentElement.scrollWidth }))()"
```
Expected for every route/width pair: `innerWidth` matches the requested width and `result.scrollWidth` equals that same width (no horizontal overflow from any of the changes in Tasks 1-8).

- [ ] **Step 3: Confirm the full feature set is present in one pass**

Run:
```bash
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/" "(() => { const nav = document.querySelector('nav'); return { navCentered: getComputedStyle(nav.querySelector('div')).justifyContent === 'center', navHasNoLogo: !document.querySelector('nav img'), homeHasWordmark: !!document.querySelector('img[alt=\"Blooming Wild ART\"]'), homeHasNoLeaf: !document.querySelector('header [class*=leaf]'), footerHasInstagram: !!document.querySelector('footer a[aria-label=\"Instagram\"]'), footerHasNewsletter: !!document.querySelector('footer form') }; })()"
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/eventi" "(() => { const noDefinitionBlock = !document.querySelector('.font-title.italic.text-base'); const hasProgressIndicator = document.querySelectorAll('span.w-5.h-5').length === 3; const hasDots = document.querySelectorAll('button[aria-label^=\"Vai a\"]').length > 0; return { noDefinitionBlock, hasProgressIndicator, hasDots }; })()"
node .superpowers/verify/cdp-check.mjs 1440 "http://localhost:4200/portfolio" "(() => ({ hasReveal: !!document.querySelector('.reveal-on-scroll') }))()"
```
Expected: every boolean in every result is `true` (the third check just confirms Fase 1's reveal-on-scroll survived this round of edits untouched).

- [ ] **Step 4: Stop the dev server**

Stop the `npx ng serve` background process.

- [ ] **Step 5: Report the manual Supabase step**

In your report, restate the SQL from Task 5 verbatim and flag clearly: **the newsletter form is fully built and client-side-verified, but end-to-end submission has not been tested against a live table** — that requires the user to run the SQL in their Supabase project first. This is expected, not a defect.

- [ ] **Step 6: Commit**

If Steps 1–3 required no fixes, this is a verification-only checkpoint — commit nothing new. If any fix was needed, it was already committed as part of re-running the owning task's steps; just confirm:

```bash
git status --short
```
Expected: no output other than any pre-existing unrelated local changes (e.g. `.claude/settings.local.json`), which must be left untouched.

---

## Self-review notes

- **Spec coverage:** Part A (navbar, home, eventi cleanup) → Tasks 1-3. Part B (social + newsletter) → Tasks 4-5. Part C (progress indicator + slider dots) → Tasks 6-7. Part D (lightbox nav + protection) → Task 8. Fase 5 correctly has no task (excluded per spec).
- **Type/name consistency:** `cover.logo` (repurposed field) is read the same way in Task 2 as `cover.main` already is. `insertNewsletterSignup` (Task 5) matches the method name used nowhere else, no collision with `insertBooking`. `currentIndex`/`onSliderScroll` are explicitly preserved in Task 3 and explicitly consumed in Task 7 — no task deletes them. `instagram` icon name is identical between its Task 4 definition and its Task 5 usage.
- **No placeholders:** every step has literal file content, literal find/replace blocks, or literal commands with literal expected output. The one deliberately-incomplete piece (the newsletter's live-insert path) is called out explicitly as a manual user step, not left ambiguous.
