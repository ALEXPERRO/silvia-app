# Gestione Eventi — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 4 hardcoded workshop events from `content.service.ts` into the
`eventi` Supabase table, and rewire the public Eventi page and Home page's "Prossimo
Workshop" section to read events from the database instead of a static array.

**Architecture:** Extend the existing `eventi` table with new columns (description,
date/time, location, price, poster URL, published flag), backfill the 4 existing rows,
then switch `Eventi` and `Home` components from a synchronous `ContentService.events`
property to an async fetch via a new `SupabaseService.getPublishedEvents()` method —
using the same `afterNextRender` + signal pattern already used today for seat counts.
Italian date/time display strings are computed client-side via a small lookup-table
utility (no Angular locale registration). No admin UI is built in this phase.

**Tech Stack:** Angular 20 standalone components/signals, Supabase (Postgres + JS
client), Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-07-15-gestione-eventi-fase1-design.md` — read it
first if anything below is ambiguous; the SQL, field names and code shapes here are
transcribed directly from it.

## Global Constraints

- Exact column names on `eventi`: `descrizione`, `data`, `ora_inizio`, `ora_fine`,
  `luogo`, `indirizzo`, `prezzo`, `locandina_url`, `pubblicato`. No `not null`
  constraints added on the new columns in this phase (see spec Sezione 1).
- Exact TypeScript field names on `PaintEvent`: `descrizione`, `data`, `oraInizio`,
  `oraFine`, `luogo`, `indirizzo`, `prezzo`, `locandinaUrl` (camelCase; the mapping
  from snake_case DB columns happens only inside `getPublishedEvents()`).
- `PaintEventWithSeats` (used only by the Eventi page) additionally carries
  `seatsAvailable`, `isSoldOut`, `dateLabel`, `timeLabel`, `mapsUrl` — all computed,
  never stored.
- No new `*.spec.ts` test files: this codebase has zero unit tests for services,
  utils, or feature components (only the default Angular scaffold `app.spec.ts`
  exists) — follow that existing convention. Each task instead verifies via
  `npm run build` (must succeed with zero TypeScript errors) and, where noted, a
  manual check. Do not add Karma/Jasmine spec files.
- Do not touch `getEventSeats()`, `prenotaPosto()`, `insertNewsletterSignup()` in
  `supabase.service.ts`, or any RLS policy / RPC function — this phase only adds a
  new read method and new columns already covered by existing `select` policies.
- Do not add a price display anywhere in the public UI yet (deferred to Fase 2 per
  spec Sezione 4) — `prezzo` is fetched and typed but not rendered.
- The SQL migration (Task 1) must be run manually by the user in the Supabase SQL
  Editor — no subagent can do this. After Task 1's review is clean, pause and ask
  the user to run `supabase/gestione_eventi_fase1.sql` before treating the feature
  as end-to-end verifiable (Tasks 2-6 still compile and can be built/reviewed
  without the DB being migrated yet).

---

### Task 1: SQL migration — schema + backfill

**Files:**
- Create: `supabase/gestione_eventi_fase1.sql`

**Interfaces:**
- Produces: 9 new nullable columns on `eventi` (`descrizione text`, `data date`,
  `ora_inizio time`, `ora_fine time`, `luogo text`, `indirizzo text`,
  `prezzo numeric(10,2)`, `locandina_url text`, `pubblicato boolean default true`),
  backfilled for rows `id` 1-4. Later tasks' `getPublishedEvents()` (Task 4) reads
  these exact column names.

- [ ] **Step 1: Write the migration file**

Create `supabase/gestione_eventi_fase1.sql` with this exact content:

```sql
-- Fase 1 di "gestione eventi": porta i dati dei workshop dal codice
-- (content.service.ts) al database, aggiungendo le colonne che oggi mancano
-- sulla tabella "eventi" e popolandole per i 4 eventi già esistenti.
-- Vedi docs/superpowers/specs/2026-07-15-gestione-eventi-fase1-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

alter table eventi add column if not exists descrizione text not null default '';
alter table eventi add column if not exists data date;
alter table eventi add column if not exists ora_inizio time;
alter table eventi add column if not exists ora_fine time;
alter table eventi add column if not exists luogo text not null default '';
alter table eventi add column if not exists indirizzo text not null default '';
alter table eventi add column if not exists prezzo numeric(10,2) not null default 0;
alter table eventi add column if not exists locandina_url text;
alter table eventi add column if not exists pubblicato boolean not null default true;

-- Backfill dei 4 eventi esistenti (dati presi da content.service.ts).
update eventi set
  descrizione = 'Per questa festa ti chiedo di abbandonare ogni forma di serietà e celebrare quel senso di meraviglia e drammaticità che si prova durante l''infanzia. Non c''è cosa più bella di entrare nell''età adulta portandosi dietro un po'' di magia! Non vedo l''ora di divertirci insieme.',
  data = '2026-06-28', ora_inizio = '10:00', ora_fine = '13:00',
  luogo = 'Villa Peripato', indirizzo = 'Taranto', prezzo = 0
where id = 1;

update eventi set
  descrizione = 'Bari si tinge dei colori della fantasia! Unisciti a noi per una mattinata di pittura libera e condivisa a due passi dal mare. Porta la tua voglia di sperimentare e lascia che il pennello parli per te. Nessuna regola, solo pura espressione cromatica.',
  data = '2026-06-29', ora_inizio = '18:00', ora_fine = '21:00',
  luogo = 'Piazza del Ferrarese', indirizzo = 'Bari (BA)', prezzo = 0
where id = 2;

update eventi set
  descrizione = 'Sotto il cielo barocco di Lecce, accendiamo la miccia della creatività. Questa sessione speciale unisce le sfumature della pittura all''energia del Salento. Un''esperienza immersiva studiata per riconnetterci con la gioia dell''arte condivisa.',
  data = '2026-07-04', ora_inizio = '20:30', ora_fine = '23:30',
  luogo = 'Piazza del Duomo', indirizzo = 'Lecce (LE)', prezzo = 0
where id = 3;

update eventi set
  descrizione = 'Chiudiamo il cerchio con un appuntamento esplosivo a Foggia. Un pomeriggio all''insegna del divertimento visivo, dei colori accesi e delle risate. Lasciati travolgere dal format che rompe le barriere tra pubblico e cavalletto!',
  data = '2026-07-12', ora_inizio = '16:00', ora_fine = '19:00',
  luogo = 'Corso Vittorio Emanuele', indirizzo = 'Foggia (FG)', prezzo = 0
where id = 4;
```

- [ ] **Step 2: Report status**

This file is not run by the implementer (no Supabase credentials available to
subagents). Report `DONE_WITH_CONCERNS` with the concern: "SQL file created but not
executed — requires the human to run it in the Supabase SQL Editor."

- [ ] **Step 3: Commit**

```bash
git add supabase/gestione_eventi_fase1.sql
git commit -m "feat: aggiunge colonne evento (descrizione, data, orari, luogo, prezzo, locandina, pubblicato) e backfill"
```

**Model:** haiku (verbatim transcription of the SQL above, no design judgment).

---

### Task 2: Update `event.model.ts`

**Files:**
- Modify: `src/app/core/models/event.model.ts`

**Interfaces:**
- Produces: `PaintEvent` (id, title, descrizione, data, oraInizio, oraFine, luogo,
  indirizzo, prezzo, locandinaUrl) and `PaintEventWithSeats` (extends `PaintEvent`
  with seatsAvailable, isSoldOut, dateLabel, timeLabel, mapsUrl). Task 3 (utils),
  Task 4 (`getPublishedEvents()`), Task 5 (`eventi.ts`/`.html`) and Task 6
  (`home.ts`/`.html`) all depend on this exact shape.

- [ ] **Step 1: Replace the file content**

Replace the entire content of `src/app/core/models/event.model.ts` with:

```ts
export interface PaintEvent {
  id: number;
  title: string;
  descrizione: string;
  data: string;
  oraInizio: string;
  oraFine: string;
  luogo: string;
  indirizzo: string;
  prezzo: number;
  locandinaUrl: string | null;
}

export interface PaintEventWithSeats extends PaintEvent {
  seatsAvailable: number;
  isSoldOut: boolean;
  dateLabel: string;
  timeLabel: string;
  mapsUrl: string;
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: fails with TypeScript errors in `content.service.ts` and `eventi.ts` (they
still reference the old `PaintEvent`/`EventMessage` shape and `mapEmbedUrl`/`mapLink`).
This is expected at this point in the plan — those files are fixed in Tasks 5 and 7.
Confirm the errors are ONLY in those two files (not e.g. a typo in this task's file).

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/event.model.ts
git commit -m "refactor: PaintEvent riflette le colonne del database (Fase 1 gestione eventi)"
```

**Model:** haiku (verbatim transcription of the interface above).

---

### Task 3: Create Italian date/time formatting utility

**Files:**
- Create: `src/app/core/utils/event-format.util.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no Angular DI — same style as the existing
  `src/app/core/utils/text.util.ts`).
- Produces: `formatDataItaliana(data: string): string`,
  `formatFasciaOraria(oraInizio: string, oraFine: string): string`,
  `buildMapsUrl(luogo: string, indirizzo: string): string`. Task 5 (`eventi.ts`) and
  Task 6 (`home.ts`) both import all three.

- [ ] **Step 1: Write the utility file**

Create `src/app/core/utils/event-format.util.ts` with this exact content:

```ts
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/** Es. "2026-06-28" -> "Domenica 28 Giugno". */
export function formatDataItaliana(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  return `${GIORNI[d.getDay()]} ${d.getDate().toString().padStart(2, '0')} ${MESI[d.getMonth()]}`;
}

/** Es. ("10:00:00", "13:00:00") -> "Dalle 10:00 alle 13:00". */
export function formatFasciaOraria(oraInizio: string, oraFine: string): string {
  const hhmm = (t: string) => t.slice(0, 5);
  return `Dalle ${hhmm(oraInizio)} alle ${hhmm(oraFine)}`;
}

/** Link "Apri in Maps" generato dalla combinazione luogo + indirizzo. */
export function buildMapsUrl(luogo: string, indirizzo: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${luogo}, ${indirizzo}`)}`;
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: same pre-existing errors as after Task 2 (in `content.service.ts` and
`eventi.ts`), plus no NEW errors from this new file. This file isn't imported by
anything yet, so it must compile cleanly on its own.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/utils/event-format.util.ts
git commit -m "feat: utility per date/orari in italiano e link Maps senza registrare il locale Angular"
```

**Model:** haiku (verbatim transcription, pure functions, no integration).

---

### Task 4: Add `getPublishedEvents()` to `SupabaseService`

**Files:**
- Modify: `src/app/core/services/supabase.service.ts`

**Interfaces:**
- Consumes: `PaintEvent` from `../models/event.model`.
- Produces: `getPublishedEvents(): Promise<PaintEvent[]>`. Task 5 (`eventi.ts`) and
  Task 6 (`home.ts`) both call this method.

- [ ] **Step 1: Add the import**

In `src/app/core/services/supabase.service.ts`, add this import at the top,
alongside the existing `environment` import:

```ts
import { PaintEvent } from '../models/event.model';
```

- [ ] **Step 2: Add the method**

Add this method to the `SupabaseService` class, directly after `getEventSeats()`
and its `invalidateSeatsCache()`/`fetchEventSeats()` (i.e. before `prenotaPosto()`):

```ts
  /** Eventi pubblicati, ordinati per data crescente (usato da Eventi e Home). */
  async getPublishedEvents(): Promise<PaintEvent[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('eventi')
      .select('*')
      .eq('pubblicato', true)
      .order('data', { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row['id'],
      title: row['titolo'],
      descrizione: row['descrizione'],
      data: row['data'],
      oraInizio: row['ora_inizio'],
      oraFine: row['ora_fine'],
      luogo: row['luogo'],
      indirizzo: row['indirizzo'],
      prezzo: row['prezzo'],
      locandinaUrl: row['locandina_url'],
    }));
  }
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: same pre-existing errors as before (in `content.service.ts` and
`eventi.ts` only) — no new errors from this file.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/supabase.service.ts
git commit -m "feat: SupabaseService.getPublishedEvents per leggere gli eventi dal database"
```

**Model:** haiku (verbatim transcription, single additive method, no existing code touched besides one import line).

---

### Task 5: Rewire the public Eventi page

**Files:**
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:**
- Consumes: `PaintEvent`/`PaintEventWithSeats` from Task 2, `formatDataItaliana`/
  `formatFasciaOraria`/`buildMapsUrl` from Task 3, `getPublishedEvents()` from Task 4.
- Produces: nothing consumed by later tasks (Home, Task 6, is independent of Eventi).

- [ ] **Step 1: Update `eventi.ts` imports and remove map-sanitizer code**

In `src/app/features/eventi/eventi.ts`:
- Change the `@angular/platform-browser` import from
  `import { DomSanitizer, Meta, SafeResourceUrl } from '@angular/platform-browser';`
  to `import { Meta } from '@angular/platform-browser';`.
- Remove the `ContentService` import and the
  `import { PaintEventWithSeats } from '../../core/models/event.model';` line;
  replace with:
  ```ts
  import { PaintEvent, PaintEventWithSeats } from '../../core/models/event.model';
  import { formatDataItaliana, formatFasciaOraria, buildMapsUrl } from '../../core/utils/event-format.util';
  ```
- Remove the class fields `private readonly content = inject(ContentService);`,
  `private readonly sanitizer = inject(DomSanitizer);`, and
  `private readonly trustedUrlCache = new Map<string, SafeResourceUrl>();`.
- Remove the `trustedMapUrl(url: string): SafeResourceUrl { ... }` method entirely.

- [ ] **Step 2: Switch `events` to an async-loaded signal**

Replace this line:
```ts
  protected readonly events = this.content.events;
```
with:
```ts
  protected readonly events = signal<PaintEvent[]>([]);
  protected readonly eventsLoaded = signal(false);
```
(`signal` is already imported at the top of the file — no new import needed.)

- [ ] **Step 3: Update `eventsWithSeats` to read the new fields and events signal**

Replace the `eventsWithSeats` computed with:
```ts
  protected readonly eventsWithSeats = computed<PaintEventWithSeats[]>(() => {
    const seatMap = this.seats();
    return this.events().map((ev) => {
      const seatsAvailable = seatMap[ev.id] ?? DEFAULT_SEATS;
      return {
        ...ev,
        seatsAvailable,
        isSoldOut: seatsAvailable <= 0,
        dateLabel: formatDataItaliana(ev.data),
        timeLabel: formatFasciaOraria(ev.oraInizio, ev.oraFine),
        mapsUrl: buildMapsUrl(ev.luogo, ev.indirizzo),
      };
    });
  });
```

- [ ] **Step 4: Fetch events alongside seats in the constructor**

In the constructor's existing `afterNextRender(() => { ... })` block (which today
only fetches seats), add the events fetch so the block reads:
```ts
    afterNextRender(() => {
      // di norma risolve subito: la cache è già stata scaldata all'avvio (vedi App)
      this.supabase.getEventSeats().then((seatMap) => {
        this.seats.set(seatMap);
        this.seatsLoaded.set(true);
      });
      this.supabase.getPublishedEvents().then((events) => {
        this.events.set(events);
        this.eventsLoaded.set(true);
      });
    });
```

- [ ] **Step 5: Fix `onSubmit()`'s event lookup**

In `onSubmit()`, change:
```ts
    const matchingEvent = this.events.find((ev) => ev.id === eventId);
```
to:
```ts
    const matchingEvent = this.events().find((ev) => ev.id === eventId);
```

- [ ] **Step 6: Update `eventi.html` — slider section**

In `src/app/features/eventi/eventi.html`, wrap the existing
`<!-- CONTENITORE PRINCIPALE CON FRECCE ESTERNE -->` div (the one starting at
`<div class="relative w-full max-w-5xl ...">`, currently the direct child of the
`<!-- SEZIONE EVENTI SLIDER -->` section) in a loading/empty-state check. The
section should become:
```html
<!-- SEZIONE EVENTI SLIDER -->
<section class="bg-blush min-h-[70vh] py-10 px-4 relative flex flex-col items-center justify-center">
  @if (!eventsLoaded()) {
    <p class="text-gray-600 text-sm">Caricamento eventi…</p>
  } @else if (eventsWithSeats().length === 0) {
    <p class="text-gray-600 text-sm text-center max-w-md">Nessun evento in programma al momento, torna a trovarci presto!</p>
  } @else {
  <!-- CONTENITORE PRINCIPALE CON FRECCE ESTERNE -->
  <div class="relative w-full max-w-5xl flex items-center justify-center md:px-12 -translate-y-6 md:translate-y-0">
    ... (existing content of this div, unchanged except the field renames in Step 7 below) ...
  </div>
  }
</section>
```
Only the wrapping `@if/@else if/@else` and the extra closing `}` are new structure —
do not otherwise reformat the existing div's contents beyond the renames below.

- [ ] **Step 7: Update `eventi.html` — field renames inside the card**

Within that same `@for (ev of eventsWithSeats(); track ev.id)` loop:
- `<p class="text-sm text-gray-600 font-medium leading-relaxed mb-6">{{ ev.message.body }}</p>`
  becomes `<p class="text-sm text-gray-600 font-medium leading-relaxed mb-6">{{ ev.descrizione }}</p>`
- `<p class="flex items-center gap-2"><app-icon name="calendar" [size]="15" /> <span>{{ ev.date }}</span> • <span>{{ ev.time }}</span></p>`
  becomes `<p class="flex items-center gap-2"><app-icon name="calendar" [size]="15" /> <span>{{ ev.dateLabel }}</span> • <span>{{ ev.timeLabel }}</span></p>`
- `<p class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" /> <span>{{ ev.location }}</span>, <span class="text-gray-600">{{ ev.address }}</span></p>`
  becomes `<p class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" /> <span>{{ ev.luogo }}</span>, <span class="text-gray-600">{{ ev.indirizzo }}</span></p>`
- `<a [href]="ev.mapLink" target="_blank" class="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold tracking-widest px-4 py-3 rounded hover:bg-gray-50 hover:border-brand transition-colors uppercase"><app-icon name="map" [size]="14" /> Mappa</a>`
  becomes `<a [href]="ev.mapsUrl" target="_blank" class="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold tracking-widest px-4 py-3 rounded hover:bg-gray-50 hover:border-brand transition-colors uppercase"><app-icon name="map" [size]="14" /> Mappa</a>`

- [ ] **Step 8: Update `eventi.html` — replace the map iframe with a locandina placeholder**

Replace this block:
```html
          <div class="hidden md:block md:w-1/2 md:min-h-full bg-gray-50">
            <iframe [src]="trustedMapUrl(ev.mapEmbedUrl)" width="100%" height="100%" style="border:0" allowfullscreen loading="lazy" class="w-full h-full object-cover min-h-70"></iframe>
          </div>
```
with:
```html
          <div class="hidden md:flex md:w-1/2 md:min-h-full bg-gray-50 items-center justify-center">
            @if (ev.locandinaUrl) {
              <img [src]="ev.locandinaUrl" [alt]="ev.title" class="w-full h-full object-cover" />
            } @else {
              <span class="text-gray-400 text-xs uppercase tracking-widest">Locandina in arrivo</span>
            }
          </div>
```

- [ ] **Step 9: Update `eventi.html` — booking form's event dropdown**

Change:
```html
              <option [ngValue]="ev.id" [disabled]="ev.isSoldOut">
                {{ ev.title }} ({{ ev.date }}){{ seatsLoaded() ? (ev.isSoldOut ? ' - SOLD OUT' : ' - Posti: ' + ev.seatsAvailable) : '' }}
              </option>
```
to:
```html
              <option [ngValue]="ev.id" [disabled]="ev.isSoldOut">
                {{ ev.title }} ({{ ev.dateLabel }}){{ seatsLoaded() ? (ev.isSoldOut ? ' - SOLD OUT' : ' - Posti: ' + ev.seatsAvailable) : '' }}
              </option>
```

- [ ] **Step 10: Verify the build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors (the only remaining pre-existing
error, in `content.service.ts`, is fixed in Task 7 — confirm the build output
mentions ONLY `content.service.ts` at this point, nothing in `eventi.ts` or
`eventi.html`).

- [ ] **Step 11: Commit**

```bash
git add src/app/features/eventi/eventi.ts src/app/features/eventi/eventi.html
git commit -m "feat(eventi): carica gli eventi dal database, rimuove la mappa incorporata"
```

**Model:** sonnet (multi-file integration: signal wiring, computed rewrite, and
precise template surgery across several non-adjacent blocks — higher risk of
transcription error than the earlier pure-addition tasks).

---

### Task 6: Rewire Home's "Prossimo Workshop"

**Files:**
- Modify: `src/app/features/home/home.ts`
- Modify: `src/app/features/home/home.html`

**Interfaces:**
- Consumes: `PaintEvent` from Task 2, `formatDataItaliana`/`formatFasciaOraria` from
  Task 3, `getPublishedEvents()` from Task 4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update `home.ts` imports**

In `src/app/features/home/home.ts`, change:
```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
```
to:
```ts
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
```
Add these two imports below the existing `ContentService` import:
```ts
import { SupabaseService } from '../../core/services/supabase.service';
import { PaintEvent } from '../../core/models/event.model';
import { formatDataItaliana, formatFasciaOraria } from '../../core/utils/event-format.util';
```

- [ ] **Step 2: Add the events fetch and replace `nextEvent`**

Add a `private readonly supabase = inject(SupabaseService);` field alongside the
existing `private readonly content = inject(ContentService);`.

In the constructor, after the existing `inject(Meta).updateTag({...})` call, add:
```ts
    afterNextRender(() => {
      this.supabase.getPublishedEvents().then((events) => {
        const oggi = new Date().toISOString().slice(0, 10);
        this.nextEvent.set(events.find((ev) => ev.data >= oggi) ?? null);
      });
    });
```

Replace this line:
```ts
  protected readonly nextEvent = this.content.events[0];
```
with:
```ts
  protected readonly nextEvent = signal<PaintEvent | null>(null);
  protected readonly nextEventDisplay = computed(() => {
    const ev = this.nextEvent();
    if (!ev) return null;
    return { ...ev, dateLabel: formatDataItaliana(ev.data), timeLabel: formatFasciaOraria(ev.oraInizio, ev.oraFine) };
  });
```

- [ ] **Step 3: Update `home.html`**

Replace this block:
```html
<!-- PROSSIMO EVENTO -->
<section class="bg-blush py-14 sm:py-20 px-4">
  <div class="max-w-3xl mx-auto text-center">
    <h2 class="text-3xl md:text-5xl text-gray-900 font-title mb-3 tracking-wide">Prossimo Workshop</h2>
    <p class="text-gray-600 max-w-xl mx-auto text-sm md:text-base font-body mb-10">
      Vieni a dipingere con me: posti limitati, meraviglia garantita.
    </p>

    <div class="relative bg-white rounded shadow-lg border border-gray-200 p-6 md:p-10 text-left">
      <h3 class="text-2xl md:text-3xl font-title font-medium text-gray-900 mb-4 tracking-wide">{{ nextEvent.title }}</h3>
      <div class="space-y-2 mb-6 text-xs md:text-sm text-gray-600 font-medium border-l-2 border-gray-200 pl-4">
        <p class="flex items-center gap-2"><app-icon name="calendar" [size]="15" /> <span>{{ nextEvent.date }}</span> • <span>{{ nextEvent.time }}</span></p>
        <p class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" /> <span>{{ nextEvent.location }}</span>, <span>{{ nextEvent.address }}</span></p>
      </div>
      <a routerLink="/eventi" class="flex w-fit mx-auto items-center gap-1.5 bg-action text-white text-xs font-semibold tracking-widest px-6 py-3.5 rounded hover:bg-action-hover transition-colors uppercase">
        <app-icon name="ticket" [size]="14" /> Scopri e prenota
      </a>
    </div>
  </div>
</section>
```
with:
```html
<!-- PROSSIMO EVENTO -->
@if (nextEventDisplay(); as ev) {
<section class="bg-blush py-14 sm:py-20 px-4">
  <div class="max-w-3xl mx-auto text-center">
    <h2 class="text-3xl md:text-5xl text-gray-900 font-title mb-3 tracking-wide">Prossimo Workshop</h2>
    <p class="text-gray-600 max-w-xl mx-auto text-sm md:text-base font-body mb-10">
      Vieni a dipingere con me: posti limitati, meraviglia garantita.
    </p>

    <div class="relative bg-white rounded shadow-lg border border-gray-200 p-6 md:p-10 text-left">
      <h3 class="text-2xl md:text-3xl font-title font-medium text-gray-900 mb-4 tracking-wide">{{ ev.title }}</h3>
      <div class="space-y-2 mb-6 text-xs md:text-sm text-gray-600 font-medium border-l-2 border-gray-200 pl-4">
        <p class="flex items-center gap-2"><app-icon name="calendar" [size]="15" /> <span>{{ ev.dateLabel }}</span> • <span>{{ ev.timeLabel }}</span></p>
        <p class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" /> <span>{{ ev.luogo }}</span>, <span>{{ ev.indirizzo }}</span></p>
      </div>
      <a routerLink="/eventi" class="flex w-fit mx-auto items-center gap-1.5 bg-action text-white text-xs font-semibold tracking-widest px-6 py-3.5 rounded hover:bg-action-hover transition-colors uppercase">
        <app-icon name="ticket" [size]="14" /> Scopri e prenota
      </a>
    </div>
  </div>
</section>
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: same single pre-existing error as after Task 5 (in `content.service.ts`
only, fixed next in Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/home/home.ts src/app/features/home/home.html
git commit -m "feat(home): 'Prossimo Workshop' mostra il prossimo evento pubblicato dal database"
```

**Model:** sonnet (signal + computed wiring plus template restructuring around a
conditional block — same risk profile as Task 5, smaller surface).

---

### Task 7: Remove the static events array from `ContentService`

**Files:**
- Modify: `src/app/core/services/content.service.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing (this is pure removal; nothing depends on `content.events`
  anymore after Tasks 5 and 6).

- [ ] **Step 1: Remove the import and the events array**

In `src/app/core/services/content.service.ts`:
- Remove the line `import { PaintEvent } from '../models/event.model';`.
- Remove the entire `readonly events: PaintEvent[] = [ ... ];` block (currently
  lines 25-78 — the four event objects for Taranto/Bari/Lecce/Foggia). Leave
  `cover`, `footer`, `shopUrl`, `shopProducts`, `galleryCategories`, `galleryItems`,
  and `buildGalleryItems()` untouched.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors and zero warnings about unused
imports.

- [ ] **Step 3: Confirm nothing else references `content.events`**

Run: `grep -rn "content.events" src/` (or the Grep tool)
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/content.service.ts
git commit -m "refactor: rimuove l'array eventi statico da ContentService (ora nel database)"
```

**Model:** haiku (pure deletion, no new logic).

---

## Post-implementation verification (not a subagent task)

After all 7 tasks are committed and reviewed:

1. Ask the user to run `supabase/gestione_eventi_fase1.sql` in the Supabase SQL
   Editor (per Global Constraints — this cannot be automated).
2. Verify the backfill via a read-only `curl` against the public `eventi` REST
   endpoint (uses the anon key already public in `environment.ts`) — confirm all
   4 rows have non-null `descrizione`/`data`/`ora_inizio`/`ora_fine`/`luogo`/
   `indirizzo` and `pubblicato = true`.
3. Push the branch and check the deployed Eventi page and Home page in a real
   browser: correct Italian dates/times render, the "Apri in Maps" link opens the
   right place, the map iframe is gone (replaced by "Locandina in arrivo"), and
   Home's "Prossimo Workshop" shows the nearest future event (or disappears
   entirely if all 4 backfilled events are already in the past relative to today).
