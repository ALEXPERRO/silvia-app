# Blooming Wild ART — Quick fixes + Fase 2 (ridotta) + Fase 3 + Fase 4

## Context

Fase 1 (visual polish) is complete and live. The user then asked for a batch of concrete UI fixes plus "all remaining phases" from the roadmap established during Fase 1's brainstorming (Fase 2 content/engagement, Fase 3 Eventi UX, Fase 4 Portfolio, Fase 5 Shop reale). The user had also independently edited `eventi.html` — removing the "Blocco Definizione Dinamico" card — while this conversation was in progress; that edit is treated as intentional and this spec includes cleaning up the code it orphaned.

Because Fase 2 and Fase 5 depend on real-world data the user doesn't have yet (no active Etsy shop, no chosen newsletter provider, no social handles), this spec **trims Fase 2** to what's buildable without inventing anything, and **fully excludes Fase 5** (no shop exists — nothing to build).

This spec was produced via `superpowers:brainstorming`, validated through a series of targeted questions (artwork placement, Fase 2/4/5 readiness, Eventi form approach, social/newsletter data-readiness).

## What stays the same (out of scope)

- Routing, gallery filtering, event slider scroll mechanics, the reactive booking form's field set/validators, Supabase booking/seat-decrement logic — unchanged except where explicitly listed below.
- Fase 5 (Shop/Etsy real integration) — no active shop exists; the placeholder stays as-is.
- No new bio copy, no "dietro le quinte" content section — both require real personal content/photos from the user that don't exist yet; inventing placeholder narrative text would violate the established "no invented content" principle from Fase 1.

## Part A — Quick fixes

### Navbar
Remove the logo + "Blooming Wild ART" wordmark link entirely. The four nav links become a single centered row (the bar's inner container switches from `justify-between` to `justify-center`). "About me" (path `/`) already covers the Home link, so no navigation capability is lost. `NgOptimizedImage` becomes unused in `navbar.ts` and is removed from its imports.

### Home hero
- Remove the decorative `<app-icon name="leaf">` in the top-right corner.
- Add `public/images/logo/title.png` (the hand-lettered "Blooming Wild ART" wordmark, transparent PNG, 3508×2480) centered above the main photo frame, inside the photo column.
- Add four small decorative illustration accents at the hero's corners (own artwork, not stock/invented): `composizioni/coniglio.png`, `composizioni/tigre e fiori.png`, `composizioni/maggio.png`, `composizioni/topo.png` — each a small (64–96px) rounded, white-bordered, slightly-rotated square crop (`object-cover`), `hidden` below the `lg` breakpoint to avoid crowding tablet/mobile, `pointer-events-none` (purely decorative, `alt=""` since they carry no informational content beyond the already-fully-described page).

### Eventi cleanup (resolves the user's manual edit)
The user removed the "Blocco Definizione Dinamico" markup that displayed `currentDefinition()`. That computed signal (and the `message.definition` data field it read) has no other consumer — confirmed via a full-codebase search. Remove:
- `currentDefinition` computed signal from `eventi.ts`.
- `definition: string[]` from the `EventMessage` interface (`event.model.ts`) and the four `definition: [...]` array literals in `content.service.ts`.

**Keep** `currentIndex` (signal) and `onSliderScroll()` — Part C's slider-position dots consume them, so they are not actually dead code.

## Part B — Fase 2, trimmed (footer: social + working newsletter)

### Social link
One Instagram icon link in the footer, `href="#"` as an explicit placeholder (no real handle exists yet — swapping it later is a one-line change). Requires a new `instagram` icon added to the `Icon` component's organic line-icon set (same viewBox/stroke conventions as the existing 12 icons: rounded-square outline + circle lens + small dot).

### Newsletter signup (functional, not a placeholder)
A real signup form in the footer, following the exact pattern already used by the Eventi booking form (`ReactiveFormsModule`, a `FormBuilder` group, `submitting`/`success`/`error` signals) and the exact pattern already used by `SupabaseService` (anon-key client, one insert method per table). It writes to a new Supabase table:

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

The user must run this SQL in their Supabase project before the feature works end-to-end (the plan will call this out as a manual step, not something the implementation can do for them). A duplicate-email submit (unique-constraint violation, Postgres error code `23505`) is shown as "Questa email è già iscritta." rather than a generic error — this is a real, expected case (someone submits twice), not an edge case to skip.

## Part C — Fase 3 (Eventi UX)

### Booking-form progress indicator
A small 3-step indicator (1 Dati → 2 Fatturazione → 3 Indirizzo) above the form, each step lighting up in `moss` once its own fields are valid. Computed from the existing `form` — no new validators, no change to submission logic, no restructuring into a hidden-step wizard (the form stays fully visible/scrollable, per the user's explicit choice of the lower-risk approach over a true wizard).

### Slider position dots
A row of small dots below the event slider, one per event, the active one filled in `moss`. Clicking a dot scrolls the slider to that event (reusing the existing `sliderRef` and the same `scrollTo` mechanism `scrollToNext()`/`scrollToPrev()` already use). Reuses the existing `currentIndex` signal (see Part A) — this is precisely the reuse that justified keeping it during the Eventi cleanup.

## Part D — Fase 4 (Portfolio)

### Lightbox prev/next navigation
Left/right arrow controls inside the open lightbox (reusing the existing `chevron-left`/`chevron-right` icons already drawn for the Eventi slider — no new icon needed), cycling through the currently-filtered gallery items (`filteredItems()`), wrapping around at both ends. Also bound to the keyboard (`ArrowLeft`/`ArrowRight` navigate, `Escape` closes) via a document-level listener that's only active while the lightbox is open.

### Basic image protection
`(contextmenu)="$event.preventDefault()"` and `draggable="false"` on the Portfolio grid thumbnails and the lightbox's enlarged image. This is a deterrent, not real DRM — screenshots remain possible — which the user was told explicitly before choosing it.

## Non-goals / explicitly out of scope
- Fase 5 (real Etsy integration) — no shop exists, nothing to build.
- "Dietro le quinte" content section — no real content exists to show; will not be scaffolded with placeholder/invented narrative.
- A true multi-step wizard for the Eventi form (hidden steps, Avanti/Indietro navigation) — the user chose the lower-risk progress-indicator approach instead.
- Real social handles — Instagram link stays `href="#"` until the user provides a real URL.
- Watermarking or server-side image protection — only the client-side deterrent described in Part D.
