# Redesign Card Evento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public Eventi page's two-column card (text left, poster/placeholder right) with a single poster-as-background card with text in a bottom overlay, and move the event description into the booking form instead of dropping it from the site.

**Architecture:** Template-only change to `src/app/features/eventi/eventi.html`. No changes to `eventi.ts`, the data model, or any service — every field the new markup uses (`ev.locandinaUrl`, `ev.prezzo`, `ev.dateLabel`, `ev.timeLabel`, `ev.luogo`, `ev.indirizzo`, `ev.mapsUrl`, `ev.isSoldOut`, `ev.seatsAvailable`, `ev.descrizione`) already exists on `PaintEventWithSeats`/`selectedEvent()`.

**Tech Stack:** Angular 20 standalone component templates, Tailwind CSS v4 (existing theme tokens only — `action`, `brand`, `bark`, `gray-950`).

**Spec:** `docs/superpowers/specs/2026-07-16-eventi-card-redesign-design.md` — read it
first if anything below is ambiguous; the markup here is transcribed directly
from it.

## Global Constraints

- Only `src/app/features/eventi/eventi.html` changes. Do not touch `eventi.ts`
  or any other file — this is a template-only restyle.
- No new `*.spec.ts` test files: this codebase has zero unit tests for
  components (only the default Angular scaffold `app.spec.ts` exists).
  Verification is `npm run build` (must succeed with zero errors) plus a
  visual check.
- The badge posti-disponibili/esaurito logic (which of the three states
  shows) must stay behaviorally identical to today — only its CSS classes
  change (solid pill background instead of plain colored text), never the
  `@if`/`@else if`/`@else` condition structure itself.
- The "Mappa" and "Prenotati"/"Esaurito" buttons keep their existing
  `(click)`/`[disabled]`/`[ngClass]` bindings unchanged — only their Tailwind
  classes change (bordo/sfondo adattati per lo sfondo scuro).

---

### Task 1: Rewrite the event card as poster-background overlay + move description to the booking form

**Files:**
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:**
- Consumes: `PaintEventWithSeats` fields (all already exist, no model changes),
  `selectedEvent()` (already exists in `eventi.ts`, returns
  `PaintEventWithSeats | null`).
- Produces: nothing consumed elsewhere — this is the only task in the plan.

- [ ] **Step 1: Replace the card markup inside the events slider**

In `src/app/features/eventi/eventi.html`, replace the entire
`@for (ev of eventsWithSeats(); track ev.id) { ... }` block inside the
`#sliderRef` div (today a two-column `<div class="relative w-full min-w-full bg-white rounded shadow-lg overflow-hidden z-10 flex flex-col md:flex-row border border-gray-200 snap-start shrink-0">`
with the locandina/placeholder in a separate right-hand column) with this
exact markup:

```html
      @for (ev of eventsWithSeats(); track ev.id) {
        <div class="relative w-full min-w-full h-[440px] md:h-[500px] rounded shadow-lg overflow-hidden snap-start shrink-0 border border-gray-200">
          @if (ev.locandinaUrl) {
            <img [src]="ev.locandinaUrl" [alt]="ev.title" class="absolute inset-0 w-full h-full object-cover" />
          } @else {
            <div class="absolute inset-0 bg-gradient-to-br from-action via-bark to-brand"></div>
            <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 28px 28px;"></div>
          }

          <div class="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent"></div>

          <span class="absolute top-4 right-4 bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
            € {{ ev.prezzo | number: '1.2-2' }}
          </span>

          <div class="absolute inset-x-0 bottom-0 p-6 md:p-8 text-white">
            <p
              class="inline-flex w-fit items-center gap-1.5 text-xs md:text-sm font-title italic mb-3 px-3 py-1.5 rounded-full text-white"
              [class.bg-red-500]="seatsLoaded() && ev.isSoldOut"
              [class.bg-brand]="!seatsLoaded() || !ev.isSoldOut"
            >
              @if (!seatsLoaded()) {
                <app-icon name="sparkles" [size]="16" /> Verifica disponibilità in corso…
              } @else if (ev.isSoldOut) {
                <app-icon name="alert-triangle" [size]="16" /> Attenzione: Posti esauriti per questa data
              } @else {
                <app-icon name="sparkles" [size]="16" /> Solo {{ ev.seatsAvailable }} posti ancora disponibili
              }
            </p>

            <h3 class="text-2xl md:text-4xl font-title font-medium mb-1 tracking-wide">{{ ev.title }}</h3>

            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm opacity-90 mb-5">
              <span class="flex items-center gap-1.5"><app-icon name="calendar" [size]="15" /> {{ ev.dateLabel }} · {{ ev.timeLabel }}</span>
              <span class="flex items-center gap-1.5"><app-icon name="map-pin" [size]="15" /> {{ ev.luogo }}, {{ ev.indirizzo }}</span>
            </p>

            <div class="flex flex-wrap gap-3">
              <a
                [href]="ev.mapsUrl"
                target="_blank"
                class="flex items-center gap-1.5 border border-white/40 text-white text-xs font-semibold tracking-widest px-4 py-3 rounded hover:bg-white/10 transition-colors uppercase"
              ><app-icon name="map" [size]="14" /> Mappa</a>
              <button
                type="button"
                [disabled]="ev.isSoldOut"
                (click)="selectEventAndScroll(ev.id)"
                class="flex items-center gap-1.5 text-xs font-semibold tracking-widest px-5 py-3 rounded transition-all uppercase"
                [ngClass]="ev.isSoldOut ? 'bg-white/20 cursor-not-allowed text-white/60' : 'bg-action text-white hover:bg-action-hover'"
              >
                @if (ev.isSoldOut) {
                  <app-icon name="ban" [size]="14" /> Esaurito
                } @else {
                  <app-icon name="ticket" [size]="14" /> Prenotati
                }
              </button>
            </div>
          </div>
        </div>
      }
```

Everything outside this `@for` block (the prev/next arrow buttons, the
swipe-hint overlay, the navigation dots, the outer slider container) stays
exactly as it is today — do not touch it.

- [ ] **Step 2: Move the event description into the booking form**

Still in `src/app/features/eventi/eventi.html`, find the event-selector
block in the booking form:

```html
        <div>
          <label for="event-select" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Seleziona l'evento *</label>
          <select id="event-select" formControlName="eventId" class="w-full p-3 border border-gray-200 rounded bg-white focus:border-brand focus:outline-none font-medium text-gray-800 transition-colors">
            <option [ngValue]="null" disabled>Seleziona un appuntamento...</option>
            @for (ev of eventsWithSeats(); track ev.id) {
              <option [ngValue]="ev.id" [disabled]="ev.isSoldOut">
                {{ ev.title }} ({{ ev.dateLabel }}){{ seatsLoaded() ? (ev.isSoldOut ? ' - SOLD OUT' : ' - Posti: ' + ev.seatsAvailable) : '' }}
              </option>
            }
          </select>
        </div>
```

Add this immediately before the closing `</div>` of that block (i.e. right
after the `</select>`):

```html
          @if (selectedEvent(); as ev) {
            <p class="text-xs text-gray-600 mt-2 leading-relaxed">{{ ev.descrizione }}</p>
          }
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: succeeds with zero TypeScript/template errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/eventi/eventi.html
git commit -m "feat(eventi): redesign card evento con locandina a sfondo, descrizione spostata nel form"
```

**Model:** sonnet (a single file, but the card markup is a substantial,
precise template rewrite with several interdependent conditional/class
bindings — worth the extra care over the cheapest tier).

---

## Post-implementation verification (not a subagent task)

After the task is committed and reviewed, start the dev server and check the
Eventi page in a real browser: confirm the card reads correctly with no
locandina (the gradient fallback), that text stays legible over the scrim at
both the mobile and desktop card heights, that the sold-out state still
disables "Prenotati" and shows the red pill, and that the description now
appears under the event dropdown once an event is selected in the booking
form.
