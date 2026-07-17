# Gestione Portfolio — Fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin UI that lets Silvia upload new portfolio images (in
batches, with a shared category and per-image title), reorder them via drag &
drop, edit their title/category, and hide/publish them — from the existing
`/gestione-prenotazioni` page.

**Architecture:** Add RLS policies letting an authenticated user insert/update
`portfolio_immagini`, plus a public-read Supabase Storage bucket for newly
uploaded images (existing images stay served from `public/images/...`). Add six
new `AdminService` methods. Add a third tab ("Portfolio") to `gestione.ts`/`.html`
alongside "Prenotazioni"/"Eventi", using `@angular/cdk/drag-drop` (a new
dependency — the project's first beyond Angular/Tailwind/Supabase) for
touch-compatible manual reordering. Finally, adjust the already-shipped public
Portfolio page to render images with plain `<img>` instead of `NgOptimizedImage`,
so both old (local-path) and new (Supabase-Storage absolute-URL) images render
identically without a custom image loader.

**Tech Stack:** Angular 20 standalone components/signals, `@angular/cdk/drag-drop`,
Supabase (Postgres + Storage), Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-07-17-portfolio-fase2-design.md` — read it
first if anything below is ambiguous; the SQL and code shapes here are
transcribed directly from it (including two gaps the spec's own self-review
caught and fixed: the "+ Aggiungi immagini" button's visibility guard, and the
shared `<datalist>` needing to live outside the add-form so the edit-form can
use it too).

## Global Constraints

- Exact new policies: `eventi`-style `insert`/`update` RLS for `authenticated`
  on `portfolio_immagini` (no `delete` policy — hiding an image never removes
  its row). A new public Storage bucket `portfolio` with public `select`,
  `authenticated` `insert` (no `update`/`delete` policy on the bucket itself —
  images aren't replaced in-place, per spec).
- Exact new dependency: `@angular/cdk@^20.3.0` (matches this project's
  `@angular/core` version). Install with `npm install @angular/cdk@^20.3.0`.
- Exact TypeScript field names: `GalleryItemAdmin` extends `GalleryItem`
  (id, src, title, category, ordine) with `pubblicato: boolean`.
- `existingCategorie` (the datalist source) and the `<datalist id="categorie-esistenti">`
  element must be usable by BOTH the add-form and the edit-form regardless of
  which is open — the datalist is declared once, outside both forms' `@if`
  blocks, at the top of the Portfolio tab's content.
- The "+ Aggiungi immagini" button must be hidden whenever the add-form or the
  edit-form is open (`@if (!showAddPortfolioForm() && !editingPortfolioItem())`).
- No new `*.spec.ts` test files: this codebase has zero unit tests for
  services, utils, or feature components (only the default Angular scaffold
  `app.spec.ts` exists) — follow that existing convention. Each task instead
  verifies via `npm run build` (must succeed with zero TypeScript errors) and,
  where noted, a manual check.
- Do not touch any Eventi-tab or Prenotazioni-tab code/logic in `gestione.ts`/
  `.html` beyond adding the third tab alongside them — `togglePaid`,
  `armCancel`/`confirmCancel`, `groupedBookings`, `openNewEventForm`/
  `openEditEventForm`/`onSubmitEvent`/`toggleEventoPubblicato`, and all Eventi/
  Prenotazioni state must stay byte-identical.
- Do not modify any RPC function, `prenotazioni` RLS, or the `eventi`/
  `locandine`-bucket policies — this phase only adds new, additive permissions
  scoped to `portfolio_immagini`/the `portfolio` bucket.
- No deletion of portfolio images anywhere in the UI — only hide/publish via
  `pubblicato`, and no replacement of an existing image's file (title/category
  only are editable, per spec).
- The SQL migration (Task 1) must be run manually by the user in the Supabase
  SQL Editor — no subagent can do this. After Task 1's review is clean, pause
  and ask the user to run `supabase/portfolio_fase2.sql` before the feature is
  end-to-end testable in a real browser (Tasks 2-5 still compile and can be
  built/reviewed without the DB/Storage being migrated yet, except that a live
  save/upload will fail against production until the SQL has run).

---

### Task 1: SQL migration — RLS policies + Storage bucket

**Files:**
- Create: `supabase/portfolio_fase2.sql`

**Interfaces:**
- Produces: `insert`/`update` RLS policies on `portfolio_immagini` for
  `authenticated`; a public Storage bucket `portfolio` with `select`/`insert`
  policies. Task 3 (`AdminService`) assumes these exist when calling
  `.insert()`/`.update()` on `portfolio_immagini` and
  `.storage.from('portfolio')`.

- [ ] **Step 1: Write the migration file**

Create `supabase/portfolio_fase2.sql` with this exact content:

```sql
-- Fase 2 di "gestione portfolio": permette a un utente autenticato (Silvia) di
-- caricare, modificare e pubblicare/nascondere immagini portfolio, e aggiunge
-- lo storage per le immagini caricate da ora in poi (quelle già esistenti
-- restano in public/images/, non vengono spostate). Vedi
-- docs/superpowers/specs/2026-07-17-portfolio-fase2-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

-- Silvia (autenticata) può creare e modificare immagini portfolio. Nessuna
-- policy di delete: si nascondono (pubblicato = false), non si eliminano mai.
drop policy if exists "portfolio_immagini_insert_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_insert_autenticato"
  on portfolio_immagini for insert
  to authenticated
  with check (true);

drop policy if exists "portfolio_immagini_update_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_update_autenticato"
  on portfolio_immagini for update
  to authenticated
  using (true)
  with check (true);

-- Bucket pubblico per le immagini portfolio caricate da Silvia (quelle già
-- esistenti restano in public/images/, solo le nuove finiscono qui).
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "portfolio_select_pubblico" on storage.objects;
create policy "portfolio_select_pubblico"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "portfolio_insert_autenticato" on storage.objects;
create policy "portfolio_insert_autenticato"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio');
```

- [ ] **Step 2: Report status**

This file is not run by the implementer (no Supabase credentials available to
subagents). Report `DONE_WITH_CONCERNS` with the concern: "SQL file created but
not executed — requires the human to run it in the Supabase SQL Editor."

- [ ] **Step 3: Commit**

```bash
git add supabase/portfolio_fase2.sql
git commit -m "feat: RLS insert/update su portfolio_immagini per utenti autenticati e bucket Storage per le immagini caricate"
```

**Model:** haiku (verbatim transcription, no design judgment).

---

### Task 2: Add `GalleryItemAdmin` to `gallery-item.model.ts`

**Files:**
- Modify: `src/app/core/models/gallery-item.model.ts`

**Interfaces:**
- Produces: `GalleryItemAdmin`, consumed by Task 3 (`AdminService`) and Task 4
  (`gestione.ts`).

- [ ] **Step 1: Append the new interface**

Add this to the end of `src/app/core/models/gallery-item.model.ts` (keep the
existing `GalleryItem`/`GalleryCategoryOption` interfaces unchanged, above
this):

```ts

/** Vista admin di un'immagine portfolio: espone anche lo stato di pubblicazione,
 *  che il pubblico non deve mai vedere/gestire. */
export interface GalleryItemAdmin extends GalleryItem {
  pubblicato: boolean;
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: succeeds with zero errors (this is a new, unused-so-far export;
nothing consumes it yet, which is not an error in TypeScript).

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/gallery-item.model.ts
git commit -m "feat: aggiunge GalleryItemAdmin per il pannello di amministrazione portfolio"
```

**Model:** haiku (verbatim transcription of the interface above).

---

### Task 3: Add portfolio-management methods to `AdminService`

**Files:**
- Modify: `src/app/core/services/admin.service.ts`

**Interfaces:**
- Consumes: `GalleryItemAdmin` from Task 2.
- Produces: `getAllPortfolioItems()`, `uploadPortfolioImage()`,
  `createPortfolioItems()`, `updatePortfolioItem()`,
  `togglePortfolioPubblicato()`, `reorderPortfolioItems()`. Task 4
  (`gestione.ts`) calls all six.

- [ ] **Step 1: Add the import**

In `src/app/core/services/admin.service.ts`, change:
```ts
import { EventFormValue, PaintEventAdmin } from '../models/event.model';
```
to:
```ts
import { EventFormValue, PaintEventAdmin } from '../models/event.model';
import { GalleryItemAdmin } from '../models/gallery-item.model';
```

- [ ] **Step 2: Add the six methods**

Add these methods directly after `uploadLocandina()` and before the private
`toRow()` helper:

```ts
  /** Tutte le immagini portfolio (pubblicate e nascoste), ordinate per categoria poi ordine. */
  async getAllPortfolioItems(): Promise<GalleryItemAdmin[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('portfolio_immagini')
      .select('*')
      .order('categoria', { ascending: true })
      .order('ordine', { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row['id'],
      src: row['src'],
      title: row['titolo'],
      category: row['categoria'],
      ordine: row['ordine'],
      pubblicato: row['pubblicato'],
    }));
  }

  async uploadPortfolioImage(file: File): Promise<{ url: string | null; error: unknown }> {
    const client = await this.getClient();
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await client.storage.from('portfolio').upload(path, file);
    if (error) return { url: null, error };
    const { data } = client.storage.from('portfolio').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  /** Inserisce più immagini insieme (upload multiplo), già con src/titolo/categoria/ordine calcolati dal chiamante. */
  async createPortfolioItems(
    items: { src: string; titolo: string; categoria: string; ordine: number }[],
  ): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('portfolio_immagini').insert(
      items.map((i) => ({ src: i.src, titolo: i.titolo, categoria: i.categoria, ordine: i.ordine })),
    );
    return { error };
  }

  async updatePortfolioItem(
    id: number,
    titolo: string,
    categoria: string,
    ordine: number,
  ): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client
      .from('portfolio_immagini')
      .update({ titolo, categoria, ordine })
      .eq('id', id);
    return { error };
  }

  async togglePortfolioPubblicato(id: number, pubblicato: boolean): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('portfolio_immagini').update({ pubblicato }).eq('id', id);
    return { error };
  }

  /** Dopo un trascinamento: salva il nuovo ordine di tutte le immagini della categoria toccata
   *  (una update per riga: nessuna funzione SQL dedicata, il numero di immagini per
   *  categoria è troppo piccolo per giustificarne una). */
  async reorderPortfolioItems(updates: { id: number; ordine: number }[]): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const results = await Promise.all(
      updates.map((u) => client.from('portfolio_immagini').update({ ordine: u.ordine }).eq('id', u.id)),
    );
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  }

```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: succeeds with zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/admin.service.ts
git commit -m "feat: AdminService gestisce caricamento, modifica, riordino e pubblicazione delle immagini portfolio"
```

**Model:** haiku (verbatim transcription; all pre-existing methods are
reproduced unchanged plus six new additive methods — no logic to design).

---

### Task 4: Add the Portfolio tab to `gestione.ts`/`.html`

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `src/app/features/gestione/gestione.ts`
- Modify: `src/app/features/gestione/gestione.html`

**Interfaces:**
- Consumes: `GalleryItemAdmin` from Task 2; all six new `AdminService` methods
  from Task 3; `CdkDragDrop`/`moveItemInArray`/`DragDropModule` from
  `@angular/cdk/drag-drop`.
- Produces: nothing consumed by later tasks (Task 5 is independent).

This is the largest task in the plan. Both files are given as full
replacements below to avoid transcription errors from partial-diff
instructions on files this size, and to guarantee the pre-existing
Prenotazioni/Eventi tab logic survives completely untouched.

- [ ] **Step 1: Install the new dependency**

Run: `npm install @angular/cdk@^20.3.0`
Expected: `package.json`/`package-lock.json` gain `@angular/cdk` as a
dependency. Commit these two files together with the rest of this task (do
not commit them separately).

- [ ] **Step 2: Replace `gestione.ts`**

Replace the entire content of `src/app/features/gestione/gestione.ts` with:

```ts
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AdminService } from '../../core/services/admin.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Prenotazione } from '../../core/models/prenotazione.model';
import { EventFormValue, PaintEventAdmin } from '../../core/models/event.model';
import { GalleryItemAdmin } from '../../core/models/gallery-item.model';
import { formatFasciaOraria } from '../../core/utils/event-format.util';

@Component({
  selector: 'app-gestione',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, NgClass, DragDropModule],
  templateUrl: './gestione.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gestione {
  private readonly admin = inject(AdminService);
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);

  protected readonly checkingSession = signal(true);
  protected readonly authenticated = signal(false);
  protected readonly loginError = signal<string | null>(null);
  protected readonly signingIn = signal(false);
  protected readonly bookings = signal<Prenotazione[]>([]);
  protected readonly seats = signal<Record<number, number>>({});
  protected readonly showCancelled = signal(false);
  protected readonly confirmingCancelId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly activeTab = signal<'prenotazioni' | 'eventi' | 'portfolio'>('prenotazioni');
  protected readonly adminEvents = signal<PaintEventAdmin[]>([]);
  protected readonly eventsTabLoaded = signal(false);
  protected readonly eventActionError = signal<string | null>(null);
  // riusa la stessa utility della pagina pubblica Eventi (Fase 1) invece di
  // duplicare la logica di formattazione orario nel template.
  protected readonly formatOrario = formatFasciaOraria;

  protected readonly showEventForm = signal(false);
  protected readonly editingEventId = signal<number | null>(null);
  protected readonly selectedLocandinaFile = signal<File | null>(null);
  protected readonly currentLocandinaUrl = signal<string | null>(null);
  protected readonly savingEvent = signal(false);
  protected readonly eventFormError = signal<string | null>(null);
  // mostrato nel form ("Di cui N già prenotati"), calcolato una volta all'apertura
  protected readonly giaPrenotatiCorrente = signal(0);

  protected readonly adminPortfolio = signal<GalleryItemAdmin[]>([]);
  protected readonly portfolioTabLoaded = signal(false);
  protected readonly portfolioActionError = signal<string | null>(null);

  protected readonly groupedPortfolio = computed(() => {
    const groups = new Map<string, GalleryItemAdmin[]>();
    for (const item of this.adminPortfolio()) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category)!.push(item);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  });

  protected readonly existingCategorie = computed(() =>
    Array.from(new Set(this.adminPortfolio().map((i) => i.category))),
  );

  protected readonly showAddPortfolioForm = signal(false);
  protected readonly newPortfolioCategoria = signal('');
  protected readonly newPortfolioRows = signal<{ file: File; titolo: string; previewUrl: string }[]>([]);
  protected readonly savingPortfolio = signal(false);
  protected readonly portfolioFormError = signal<string | null>(null);

  protected readonly editingPortfolioItem = signal<GalleryItemAdmin | null>(null);
  protected readonly editPortfolioForm = this.fb.nonNullable.group({
    titolo: ['', Validators.required],
    categoria: ['', Validators.required],
  });

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly eventForm = this.fb.nonNullable.group({
    titolo: ['', Validators.required],
    luogo: ['', Validators.required],
    indirizzo: ['', Validators.required],
    data: ['', Validators.required],
    oraInizio: ['', Validators.required],
    oraFine: ['', Validators.required],
    descrizione: ['', Validators.required],
    prezzo: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    capienzaTotale: this.fb.nonNullable.control(10, [Validators.required, Validators.min(0)]),
    pubblicato: [true],
  });

  protected readonly groupedBookings = computed(() => {
    const all = this.bookings();
    const showCancelled = this.showCancelled();
    const seatMap = this.seats();

    const groups = new Map<string, { titolo: string; postiDisponibili: number | null; prenotazioni: Prenotazione[] }>();
    for (const b of all) {
      if (b.cancellata && !showCancelled) continue;
      if (!groups.has(b.evento_titolo)) {
        const posti = b.evento_id !== null && seatMap[b.evento_id] !== undefined ? seatMap[b.evento_id] : null;
        groups.set(b.evento_titolo, { titolo: b.evento_titolo, postiDisponibili: posti, prenotazioni: [] });
      }
      groups.get(b.evento_titolo)!.prenotazioni.push(b);
    }
    return Array.from(groups.values());
  });

  constructor() {
    // pagina privata, non pensata per essere indicizzata o linkata
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });

    afterNextRender(() => {
      this.admin
        .getSession()
        .then((hasSession) => {
          this.authenticated.set(hasSession);
          if (hasSession) {
            this.loadData();
          }
        })
        .catch(() => {
          this.loginError.set('Impossibile contattare il server. Riprova.');
        })
        .finally(() => {
          this.checkingSession.set(false);
        });
    });
  }

  async onLogin(): Promise<void> {
    this.loginError.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.signingIn.set(true);
    const { email, password } = this.loginForm.getRawValue();
    try {
      const { error } = await this.admin.signIn(email, password);
      if (error) {
        this.loginError.set('Email o password non corretti.');
        return;
      }
      this.authenticated.set(true);
      this.loadData();
    } catch {
      this.loginError.set('Impossibile contattare il server. Riprova.');
    } finally {
      this.signingIn.set(false);
    }
  }

  async onLogout(): Promise<void> {
    try {
      await this.admin.signOut();
    } finally {
      this.authenticated.set(false);
    }
  }

  private loadData(): void {
    this.admin.getBookings().then((data) => this.bookings.set(data));
    this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
  }

  async togglePaid(booking: Prenotazione): Promise<void> {
    this.actionError.set(null);
    try {
      const { error } = await this.admin.setPaid(booking.id, !booking.pagato);
      if (error) {
        this.actionError.set('Impossibile aggiornare lo stato del pagamento. Riprova.');
        return;
      }
      this.bookings.update((list) =>
        list.map((b) => (b.id === booking.id ? { ...b, pagato: !booking.pagato } : b)),
      );
    } catch {
      this.actionError.set('Impossibile aggiornare lo stato del pagamento. Riprova.');
    }
  }

  armCancel(id: number): void {
    this.confirmingCancelId.set(id);
  }

  async confirmCancel(id: number): Promise<void> {
    this.actionError.set(null);
    try {
      const { success, error } = await this.admin.cancelBooking(id);
      if (error || !success) {
        this.actionError.set('Impossibile annullare la prenotazione. Riprova.');
        return;
      }
      this.bookings.update((list) => list.map((b) => (b.id === id ? { ...b, cancellata: true } : b)));
      this.supabase.invalidateSeatsCache();
      this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
    } catch {
      this.actionError.set('Impossibile annullare la prenotazione. Riprova.');
    } finally {
      this.confirmingCancelId.set(null);
    }
  }

  selectTab(tab: 'prenotazioni' | 'eventi' | 'portfolio'): void {
    this.activeTab.set(tab);
    if (tab === 'eventi' && !this.eventsTabLoaded()) {
      this.admin.getAllEvents().then((events) => {
        this.adminEvents.set(events);
        this.eventsTabLoaded.set(true);
      });
    }
    if (tab === 'portfolio' && !this.portfolioTabLoaded()) {
      this.admin.getAllPortfolioItems().then((items) => {
        this.adminPortfolio.set(items);
        this.portfolioTabLoaded.set(true);
      });
    }
  }

  /** Somma i posti delle prenotazioni attive (non annullate) collegate a un evento,
   *  riusando i dati già caricati per la scheda Prenotazioni (nessuna query extra). */
  private postiGiaPrenotati(eventoId: number): number {
    return this.bookings()
      .filter((b) => b.evento_id === eventoId && !b.cancellata)
      .reduce((sum, b) => sum + b.numero_posti, 0);
  }

  openNewEventForm(): void {
    this.editingEventId.set(null);
    this.eventFormError.set(null);
    this.selectedLocandinaFile.set(null);
    this.currentLocandinaUrl.set(null);
    this.giaPrenotatiCorrente.set(0);
    this.eventForm.reset({ prezzo: 0, capienzaTotale: 10, pubblicato: true });
    this.showEventForm.set(true);
  }

  openEditEventForm(ev: PaintEventAdmin): void {
    this.editingEventId.set(ev.id);
    this.eventFormError.set(null);
    this.selectedLocandinaFile.set(null);
    this.currentLocandinaUrl.set(ev.locandinaUrl);
    const giaPrenotati = this.postiGiaPrenotati(ev.id);
    this.giaPrenotatiCorrente.set(giaPrenotati);
    this.eventForm.reset({
      titolo: ev.title,
      luogo: ev.luogo,
      indirizzo: ev.indirizzo,
      data: ev.data,
      oraInizio: ev.oraInizio.slice(0, 5),
      oraFine: ev.oraFine.slice(0, 5),
      descrizione: ev.descrizione,
      prezzo: ev.prezzo,
      capienzaTotale: ev.postiTotali,
      pubblicato: ev.pubblicato,
    });
    this.showEventForm.set(true);
  }

  closeEventForm(): void {
    this.showEventForm.set(false);
  }

  onLocandinaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedLocandinaFile.set(input.files?.[0] ?? null);
  }

  async toggleEventoPubblicato(ev: PaintEventAdmin): Promise<void> {
    this.eventActionError.set(null);
    try {
      const { error } = await this.admin.togglePubblicato(ev.id, !ev.pubblicato);
      if (error) {
        this.eventActionError.set("Impossibile aggiornare lo stato dell'evento. Riprova.");
        return;
      }
      this.adminEvents.update((list) =>
        list.map((e) => (e.id === ev.id ? { ...e, pubblicato: !ev.pubblicato } : e)),
      );
    } catch {
      this.eventActionError.set("Impossibile aggiornare lo stato dell'evento. Riprova.");
    }
  }

  async onSubmitEvent(): Promise<void> {
    this.eventFormError.set(null);
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      this.eventFormError.set('Controlla i campi evidenziati: alcuni dati mancano o non sono validi.');
      return;
    }

    const editingId = this.editingEventId();
    const giaPrenotati = editingId !== null ? this.postiGiaPrenotati(editingId) : 0;
    const v = this.eventForm.getRawValue();
    const postiDisponibili = v.capienzaTotale - giaPrenotati;

    if (postiDisponibili < 0) {
      this.eventFormError.set(
        `Ci sono già ${giaPrenotati} persone prenotate: non puoi impostare meno di ${giaPrenotati} posti totali.`,
      );
      return;
    }

    this.savingEvent.set(true);
    try {
      let locandinaUrl = this.currentLocandinaUrl();

      const file = this.selectedLocandinaFile();
      if (file) {
        const { url, error } = await this.admin.uploadLocandina(file);
        if (error) {
          this.eventFormError.set('Impossibile caricare la locandina. Riprova.');
          return;
        }
        locandinaUrl = url;
      }

      const fields: EventFormValue = { ...v, locandinaUrl };
      const { error } = editingId !== null
        ? await this.admin.updateEvent(editingId, fields, postiDisponibili)
        : await this.admin.createEvent(fields, postiDisponibili);

      if (error) {
        this.eventFormError.set("Impossibile salvare l'evento. Riprova.");
        return;
      }

      this.showEventForm.set(false);
      this.eventsTabLoaded.set(false);
      this.selectTab('eventi');
    } catch {
      this.eventFormError.set("Impossibile salvare l'evento. Riprova.");
    } finally {
      this.savingEvent.set(false);
    }
  }

  async onPortfolioDrop(event: CdkDragDrop<GalleryItemAdmin[]>, group: { items: GalleryItemAdmin[] }): Promise<void> {
    moveItemInArray(group.items, event.previousIndex, event.currentIndex);
    const updates = group.items.map((item, i) => ({ id: item.id, ordine: i }));
    updates.forEach((u, i) => (group.items[i].ordine = u.ordine));
    this.portfolioActionError.set(null);
    const { error } = await this.admin.reorderPortfolioItems(updates);
    if (error) this.portfolioActionError.set('Impossibile salvare il nuovo ordine. Riprova.');
  }

  async togglePortfolioPubblicato(item: GalleryItemAdmin): Promise<void> {
    this.portfolioActionError.set(null);
    try {
      const { error } = await this.admin.togglePortfolioPubblicato(item.id, !item.pubblicato);
      if (error) {
        this.portfolioActionError.set("Impossibile aggiornare lo stato dell'immagine. Riprova.");
        return;
      }
      this.adminPortfolio.update((list) =>
        list.map((i) => (i.id === item.id ? { ...i, pubblicato: !item.pubblicato } : i)),
      );
    } catch {
      this.portfolioActionError.set("Impossibile aggiornare lo stato dell'immagine. Riprova.");
    }
  }

  openAddPortfolioForm(): void {
    this.portfolioFormError.set(null);
    this.newPortfolioCategoria.set('');
    this.newPortfolioRows.set([]);
    this.showAddPortfolioForm.set(true);
  }

  closeAddPortfolioForm(): void {
    this.showAddPortfolioForm.set(false);
  }

  onPortfolioFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.newPortfolioRows.set(files.map((file) => ({ file, titolo: '', previewUrl: URL.createObjectURL(file) })));
  }

  updatePortfolioRowTitle(index: number, titolo: string): void {
    this.newPortfolioRows.update((rows) => rows.map((r, i) => (i === index ? { ...r, titolo } : r)));
  }

  private nextOrdineForCategoria(categoria: string): number {
    const existing = this.adminPortfolio().filter((i) => i.category === categoria);
    return existing.length > 0 ? Math.max(...existing.map((i) => i.ordine)) + 1 : 0;
  }

  async onSubmitAddPortfolio(): Promise<void> {
    this.portfolioFormError.set(null);
    const categoria = this.newPortfolioCategoria().trim();
    const rows = this.newPortfolioRows();

    if (!categoria) {
      this.portfolioFormError.set('Scegli o scrivi una categoria.');
      return;
    }
    if (rows.length === 0) {
      this.portfolioFormError.set('Seleziona almeno un file.');
      return;
    }
    if (rows.some((r) => !r.titolo.trim())) {
      this.portfolioFormError.set('Ogni immagine ha bisogno di un titolo.');
      return;
    }

    this.savingPortfolio.set(true);
    try {
      let nextOrdine = this.nextOrdineForCategoria(categoria);
      const items: { src: string; titolo: string; categoria: string; ordine: number }[] = [];

      for (const row of rows) {
        const { url, error } = await this.admin.uploadPortfolioImage(row.file);
        if (error || !url) {
          this.portfolioFormError.set(`Impossibile caricare "${row.file.name}". Riprova.`);
          return;
        }
        items.push({ src: url, titolo: row.titolo.trim(), categoria, ordine: nextOrdine });
        nextOrdine++;
      }

      const { error } = await this.admin.createPortfolioItems(items);
      if (error) {
        this.portfolioFormError.set('Immagini caricate ma non salvate nel database. Riprova.');
        return;
      }

      this.showAddPortfolioForm.set(false);
      this.portfolioTabLoaded.set(false);
      this.selectTab('portfolio');
    } catch {
      this.portfolioFormError.set('Impossibile completare il caricamento. Riprova.');
    } finally {
      this.savingPortfolio.set(false);
    }
  }

  openEditPortfolioForm(item: GalleryItemAdmin): void {
    this.editingPortfolioItem.set(item);
    this.portfolioFormError.set(null);
    this.editPortfolioForm.reset({ titolo: item.title, categoria: item.category });
  }

  closeEditPortfolioForm(): void {
    this.editingPortfolioItem.set(null);
  }

  async onSubmitEditPortfolio(): Promise<void> {
    this.portfolioFormError.set(null);
    if (this.editPortfolioForm.invalid) {
      this.editPortfolioForm.markAllAsTouched();
      return;
    }
    const item = this.editingPortfolioItem();
    if (!item) return;

    const { titolo, categoria } = this.editPortfolioForm.getRawValue();
    const categoriaTrim = categoria.trim();
    const ordine = categoriaTrim !== item.category ? this.nextOrdineForCategoria(categoriaTrim) : item.ordine;

    this.savingPortfolio.set(true);
    try {
      const { error } = await this.admin.updatePortfolioItem(item.id, titolo.trim(), categoriaTrim, ordine);
      if (error) {
        this.portfolioFormError.set("Impossibile salvare le modifiche. Riprova.");
        return;
      }
      this.editingPortfolioItem.set(null);
      this.portfolioTabLoaded.set(false);
      this.selectTab('portfolio');
    } catch {
      this.portfolioFormError.set("Impossibile salvare le modifiche. Riprova.");
    } finally {
      this.savingPortfolio.set(false);
    }
  }
}
```

- [ ] **Step 3: Replace `gestione.html`**

Replace the entire content of `src/app/features/gestione/gestione.html` with:

```html
@if (checkingSession()) {
  <section class="min-h-screen flex items-center justify-center bg-parchment">
    <p class="text-gray-600 text-sm">Caricamento…</p>
  </section>
} @else if (!authenticated()) {
  <section class="min-h-screen flex items-center justify-center bg-parchment px-4">
    <div class="max-w-sm w-full bg-white rounded shadow-lg border border-gray-200 p-8">
      <h1 class="text-2xl font-title font-medium text-gray-900 mb-6 text-center tracking-wide">Accedi</h1>
      <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-4 text-sm">
        <div>
          <label for="admin-email" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Email</label>
          <input type="email" id="admin-email" formControlName="email" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
        </div>
        <div>
          <label for="admin-password" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Password</label>
          <input type="password" id="admin-password" formControlName="password" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
        </div>
        @if (loginError(); as err) {
          <p class="text-red-500 text-xs font-semibold text-center">{{ err }}</p>
        }
        <button type="submit" [disabled]="signingIn()" class="w-full bg-action text-white font-medium text-sm tracking-widest py-3 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
          {{ signingIn() ? 'Accesso in corso...' : 'Accedi' }}
        </button>
      </form>
    </div>
  </section>
} @else {
  <section class="min-h-screen bg-parchment px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] md:pt-24 pb-10">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <h1 class="text-3xl font-title font-medium text-gray-900 tracking-wide">Gestione prenotazioni</h1>
        <button type="button" (click)="onLogout()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 border border-gray-200 rounded px-4 py-2 hover:border-brand hover:text-brand transition-colors">Esci</button>
      </div>

      <div class="flex gap-2 mb-8">
        <button
          type="button"
          (click)="selectTab('prenotazioni')"
          [ngClass]="activeTab() === 'prenotazioni' ? 'bg-action text-white' : 'border border-gray-200 text-gray-600'"
          class="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded transition-colors"
        >Prenotazioni</button>
        <button
          type="button"
          (click)="selectTab('eventi')"
          [ngClass]="activeTab() === 'eventi' ? 'bg-action text-white' : 'border border-gray-200 text-gray-600'"
          class="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded transition-colors"
        >Eventi</button>
        <button
          type="button"
          (click)="selectTab('portfolio')"
          [ngClass]="activeTab() === 'portfolio' ? 'bg-action text-white' : 'border border-gray-200 text-gray-600'"
          class="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded transition-colors"
        >Portfolio</button>
      </div>

      @if (activeTab() === 'prenotazioni') {
        <label class="flex items-center gap-2 text-xs text-gray-600 mb-8">
          <input type="checkbox" [checked]="showCancelled()" (change)="showCancelled.set(!showCancelled())" class="accent-brand" />
          Mostra annullate
        </label>

        @if (actionError(); as err) {
          <p class="text-red-500 text-xs font-semibold text-center mb-6">{{ err }}</p>
        }

        @if (groupedBookings().length === 0) {
          <p class="text-gray-600 text-sm">Nessuna prenotazione ancora.</p>
        }

        @for (group of groupedBookings(); track group.titolo) {
          <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide">{{ group.titolo }}</h2>
              @if (group.postiDisponibili !== null) {
                <span class="text-xs text-gray-600 font-medium">{{ group.postiDisponibili }} posti disponibili</span>
              }
            </div>

            @for (b of group.prenotazioni; track b.id) {
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-t border-gray-200 text-sm">
                <div>
                  <p class="font-medium text-gray-900">
                    {{ b.nome_completo }}
                    <span class="text-xs text-gray-600 font-normal">({{ b.codice_fiscale ? 'privato' : 'azienda' }})</span>
                    @if (b.numero_posti > 1) {
                      <span class="text-xs text-brand font-semibold">— {{ b.numero_posti }} persone</span>
                    }
                  </p>
                  <p class="text-xs text-gray-600">{{ b.email }} — {{ b.created_at | date: 'dd/MM/yyyy' }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="togglePaid(b)"
                    [ngClass]="b.pagato ? 'bg-action text-white' : 'border border-gray-200 text-gray-600'"
                    class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded transition-colors"
                  >
                    {{ b.pagato ? 'Pagato' : 'Non pagato' }}
                  </button>
                  @if (confirmingCancelId() === b.id) {
                    <button type="button" (click)="confirmCancel(b.id)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded bg-red-500 text-white">
                      Conferma annullamento?
                    </button>
                  } @else if (!b.cancellata) {
                    <button type="button" (click)="armCancel(b.id)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors">
                      Annulla prenotazione
                    </button>
                  } @else {
                    <span class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 text-gray-400">Annullata</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      } @else if (activeTab() === 'eventi') {
        @if (eventActionError(); as err) {
          <p class="text-red-500 text-xs font-semibold text-center mb-6">{{ err }}</p>
        }

        @if (!showEventForm()) {
          <button type="button" (click)="openNewEventForm()" class="bg-action text-white text-xs font-semibold tracking-widest uppercase px-5 py-3 rounded mb-6 hover:bg-action-hover transition-colors">
            + Nuovo evento
          </button>
        }

        @if (showEventForm()) {
          <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
            <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide mb-4">
              {{ editingEventId() !== null ? 'Modifica evento' : 'Nuovo evento' }}
            </h2>
            <form [formGroup]="eventForm" (ngSubmit)="onSubmitEvent()" class="space-y-4 text-left text-sm">
              <div>
                <label for="ev-titolo" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Titolo *</label>
                <input type="text" id="ev-titolo" formControlName="titolo" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="ev-luogo" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Luogo *</label>
                  <input type="text" id="ev-luogo" formControlName="luogo" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Villa Peripato">
                </div>
                <div>
                  <label for="ev-indirizzo" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Indirizzo *</label>
                  <input type="text" id="ev-indirizzo" formControlName="indirizzo" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Taranto">
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label for="ev-data" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Data *</label>
                  <input type="date" id="ev-data" formControlName="data" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
                </div>
                <div>
                  <label for="ev-ora-inizio" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Ora inizio *</label>
                  <input type="time" id="ev-ora-inizio" formControlName="oraInizio" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
                </div>
                <div>
                  <label for="ev-ora-fine" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Ora fine *</label>
                  <input type="time" id="ev-ora-fine" formControlName="oraFine" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
                </div>
              </div>

              <div>
                <label for="ev-descrizione" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Descrizione *</label>
                <textarea id="ev-descrizione" formControlName="descrizione" rows="4" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800"></textarea>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="ev-prezzo" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Prezzo (€) *</label>
                  <input type="number" id="ev-prezzo" formControlName="prezzo" step="0.01" min="0" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
                </div>
                <div>
                  <label for="ev-capienza" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Posti totali *</label>
                  <input type="number" id="ev-capienza" formControlName="capienzaTotale" step="1" min="0" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
                  @if (editingEventId() !== null) {
                    <p class="text-xs text-gray-600 mt-2">Di cui {{ giaPrenotatiCorrente() }} già prenotati</p>
                  }
                </div>
              </div>

              <div>
                <label for="ev-locandina" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Locandina</label>
                @if (currentLocandinaUrl(); as url) {
                  <img [src]="url" alt="Locandina attuale" class="w-32 h-32 object-cover rounded border border-gray-200 mb-2">
                }
                <input type="file" id="ev-locandina" accept="image/*" (change)="onLocandinaSelected($event)" class="w-full text-sm text-gray-600">
              </div>

              <label class="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" formControlName="pubblicato" class="accent-brand" />
                Pubblica subito
              </label>

              @if (eventFormError(); as err) {
                <p class="text-red-500 text-xs font-semibold text-center">{{ err }}</p>
              }

              <div class="flex items-center gap-3 pt-2">
                <button type="submit" [disabled]="savingEvent()" class="bg-action text-white font-medium text-xs tracking-widest py-3 px-6 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
                  {{ savingEvent() ? 'Salvataggio...' : 'Salva evento' }}
                </button>
                <button type="button" (click)="closeEventForm()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 border border-gray-200 rounded px-6 py-3 hover:border-brand hover:text-brand transition-colors">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        }

        @if (adminEvents().length === 0 && eventsTabLoaded()) {
          <p class="text-gray-600 text-sm">Nessun evento ancora. Creane uno con "Nuovo evento".</p>
        }

        @for (ev of adminEvents(); track ev.id) {
          <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-4 flex items-center justify-between gap-4">
            <div>
              <p class="font-medium text-gray-900">
                {{ ev.title }}
                <span
                  class="text-[10px] font-semibold tracking-widest uppercase px-2 py-1 rounded ml-2"
                  [ngClass]="ev.pubblicato ? 'bg-action text-white' : 'bg-gray-200 text-gray-600'"
                >{{ ev.pubblicato ? 'Pubblicato' : 'Nascosto' }}</span>
              </p>
              <p class="text-xs text-gray-600 mt-1">
                {{ ev.data | date: 'dd/MM/yyyy' }} · {{ formatOrario(ev.oraInizio, ev.oraFine) }} ·
                {{ ev.postiDisponibili }} posti disponibili · € {{ ev.prezzo | number: '1.2-2' }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button type="button" (click)="openEditEventForm(ev)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">Modifica</button>
              <button type="button" (click)="toggleEventoPubblicato(ev)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors">
                {{ ev.pubblicato ? 'Nascondi' : 'Pubblica' }}
              </button>
            </div>
          </div>
        }
      } @else {
        <datalist id="categorie-esistenti">
          @for (c of existingCategorie(); track c) {
            <option [value]="c"></option>
          }
        </datalist>

        @if (portfolioActionError(); as err) {
          <p class="text-red-500 text-xs font-semibold text-center mb-6">{{ err }}</p>
        }

        @if (!showAddPortfolioForm() && !editingPortfolioItem()) {
          <button type="button" (click)="openAddPortfolioForm()" class="bg-action text-white text-xs font-semibold tracking-widest uppercase px-5 py-3 rounded mb-6 hover:bg-action-hover transition-colors">
            + Aggiungi immagini
          </button>
        }

        @if (showAddPortfolioForm()) {
          <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
            <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide mb-4">Aggiungi immagini</h2>

            <div class="mb-4">
              <label for="new-portfolio-categoria" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Categoria *</label>
              <input
                type="text"
                id="new-portfolio-categoria"
                list="categorie-esistenti"
                [value]="newPortfolioCategoria()"
                (input)="newPortfolioCategoria.set($any($event.target).value)"
                placeholder="Scegli o scrivi una categoria"
                class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800"
              />
            </div>

            <div class="mb-4">
              <label for="new-portfolio-files" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Immagini *</label>
              <input type="file" id="new-portfolio-files" accept="image/*" multiple (change)="onPortfolioFilesSelected($event)" class="w-full text-sm text-gray-600">
            </div>

            @if (newPortfolioRows().length > 0) {
              <div class="space-y-3 mb-4">
                @for (row of newPortfolioRows(); track row.previewUrl; let i = $index) {
                  <div class="flex items-center gap-3">
                    <img [src]="row.previewUrl" alt="" class="w-16 h-16 object-cover rounded border border-gray-200 shrink-0">
                    <input
                      type="text"
                      [value]="row.titolo"
                      (input)="updatePortfolioRowTitle(i, $any($event.target).value)"
                      placeholder="Titolo di questa immagine"
                      class="flex-1 p-2.5 border border-gray-200 rounded focus:border-brand focus:outline-none text-sm text-gray-800"
                    />
                  </div>
                }
              </div>
            }

            @if (portfolioFormError(); as err) {
              <p class="text-red-500 text-xs font-semibold text-center mb-4">{{ err }}</p>
            }

            <div class="flex items-center gap-3">
              <button type="button" [disabled]="savingPortfolio()" (click)="onSubmitAddPortfolio()" class="bg-action text-white font-medium text-xs tracking-widest py-3 px-6 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
                {{ savingPortfolio() ? 'Caricamento...' : 'Salva immagini' }}
              </button>
              <button type="button" (click)="closeAddPortfolioForm()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 border border-gray-200 rounded px-6 py-3 hover:border-brand hover:text-brand transition-colors">
                Annulla
              </button>
            </div>
          </div>
        }

        @if (editingPortfolioItem(); as item) {
          <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
            <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide mb-4">Modifica immagine</h2>
            <form [formGroup]="editPortfolioForm" (ngSubmit)="onSubmitEditPortfolio()" class="space-y-4 text-left text-sm">
              <div>
                <label for="edit-portfolio-titolo" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Titolo *</label>
                <input type="text" id="edit-portfolio-titolo" formControlName="titolo" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
              </div>
              <div>
                <label for="edit-portfolio-categoria" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Categoria *</label>
                <input type="text" id="edit-portfolio-categoria" formControlName="categoria" list="categorie-esistenti" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
              </div>
              @if (portfolioFormError(); as err) {
                <p class="text-red-500 text-xs font-semibold text-center">{{ err }}</p>
              }
              <div class="flex items-center gap-3">
                <button type="submit" [disabled]="savingPortfolio()" class="bg-action text-white font-medium text-xs tracking-widest py-3 px-6 rounded hover:bg-action-hover transition-all uppercase disabled:opacity-50">
                  {{ savingPortfolio() ? 'Salvataggio...' : 'Salva modifiche' }}
                </button>
                <button type="button" (click)="closeEditPortfolioForm()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 border border-gray-200 rounded px-6 py-3 hover:border-brand hover:text-brand transition-colors">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        }

        @if (adminPortfolio().length === 0 && portfolioTabLoaded()) {
          <p class="text-gray-600 text-sm">Nessuna immagine ancora.</p>
        }

        @for (group of groupedPortfolio(); track group.category) {
          <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-6">
            <h2 class="text-lg font-title font-medium text-gray-900 tracking-wide mb-4">{{ group.category }}</h2>
            <div cdkDropList (cdkDropListDropped)="onPortfolioDrop($event, group)" class="space-y-2">
              @for (item of group.items; track item.id) {
                <div cdkDrag class="flex items-center gap-3 py-2 border-t border-gray-200 first:border-t-0 bg-white">
                  <span cdkDragHandle class="cursor-move text-gray-400 hover:text-gray-600 shrink-0 text-lg">⠿</span>
                  <img [src]="item.src" [alt]="item.title" class="w-12 h-12 object-cover rounded border border-gray-200 shrink-0">
                  <p class="flex-1 text-sm font-medium text-gray-900">
                    {{ item.title }}
                    <span
                      class="text-[10px] font-semibold tracking-widest uppercase px-2 py-1 rounded ml-2"
                      [ngClass]="item.pubblicato ? 'bg-action text-white' : 'bg-gray-200 text-gray-600'"
                    >{{ item.pubblicato ? 'Pubblicato' : 'Nascosto' }}</span>
                  </p>
                  <div class="flex items-center gap-2 shrink-0">
                    <button type="button" (click)="openEditPortfolioForm(item)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">Modifica</button>
                    <button type="button" (click)="togglePortfolioPubblicato(item)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500 transition-colors">
                      {{ item.pubblicato ? 'Nascondi' : 'Pubblica' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  </section>
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/app/features/gestione/gestione.ts src/app/features/gestione/gestione.html
git commit -m "feat(gestione): scheda Portfolio con caricamento multiplo, riordino drag&drop e pubblicazione"
```

**Model:** sonnet (largest, highest-integration-risk task in this plan — three
tabs' worth of state coexisting, drag-and-drop wiring, and a sizeable template
with several nested conditionals; also the only task in this plan touching a
new npm dependency).

---

### Task 5: Adjust the public Portfolio page's image rendering

**Files:**
- Modify: `src/app/features/portfolio/portfolio.ts`
- Modify: `src/app/features/portfolio/portfolio.html`

**Interfaces:**
- Consumes: nothing new — this task only changes how already-fetched
  `GalleryItem`/`item.src` values are rendered, not what's fetched.
- Produces: nothing consumed by later tasks (this is the last task in the plan).

- [ ] **Step 1: Remove the `NgOptimizedImage` import and its use**

In `src/app/features/portfolio/portfolio.ts`, change:
```ts
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
```
to:
```ts
import { DOCUMENT } from '@angular/common';
```
And change the component's `imports` array from:
```ts
  imports: [NgOptimizedImage, Icon, RevealOnScroll],
```
to:
```ts
  imports: [Icon, RevealOnScroll],
```

- [ ] **Step 2: Replace the grid image in `portfolio.html`**

Change:
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
to:
```html
            <img
              [src]="item.src"
              loading="lazy"
              [alt]="item.title"
              class="absolute inset-0 w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
              (contextmenu)="$event.preventDefault()"
              draggable="false"
            />
```

- [ ] **Step 3: Replace the lightbox image in `portfolio.html`**

Change:
```html
        <img [ngSrc]="item.src" fill [alt]="item.title" class="object-contain p-6" (contextmenu)="$event.preventDefault()" draggable="false" />
```
to:
```html
        <img [src]="item.src" [alt]="item.title" class="absolute inset-0 w-full h-full object-contain p-6" (contextmenu)="$event.preventDefault()" draggable="false" />
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors across the whole repo — this is
the final task in the plan.

- [ ] **Step 5: Manual visual check**

Since this changes how every portfolio image renders, this task also needs a
quick visual check (not just a type-check): start the dev server, open
`/portfolio`, confirm the grid thumbnails and the lightbox both still display
images correctly filling their containers (no stretching, no overflow) exactly
as before this change. This can be done by the implementer if a dev server is
available, or noted as pending for the controller's post-implementation
verification if not.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/portfolio/portfolio.ts src/app/features/portfolio/portfolio.html
git commit -m "refactor(portfolio): usa <img> normale invece di NgOptimizedImage per supportare URL Supabase Storage"
```

**Model:** sonnet (small in line count, but a rendering-behavior change to an
already-shipped page — worth the extra care of a visual check over the
cheapest tier).

---

## Post-implementation verification (not a subagent task)

After all 5 tasks are committed and reviewed:

1. Ask the user to run `supabase/portfolio_fase2.sql` in the Supabase SQL
   Editor (per Global Constraints — this cannot be automated).
2. Push the branch and, in a real browser, log in to `/gestione-prenotazioni`
   and manually walk through: switching to the "Portfolio" tab, uploading 2-3
   images together in one batch (with a shared category — try both an
   existing one via the datalist suggestion and a brand-new one typed by
   hand), confirming each got its own title, dragging an image to a new
   position within its category and confirming the order persists after a
   page reload, editing an image's title and category, hiding then
   re-publishing an image, and confirming a hidden image disappears from the
   public Portfolio page's category filter/grid while staying visible (as
   "Nascosto") in the admin list.
3. Confirm the public Portfolio page (grid and lightbox) renders both old
   (local-path) and newly-uploaded (Supabase-Storage) images correctly side
   by side in the same category.
4. This is a live-credentialed, interactive checklist that only the human
   owner (or a browser automation session with real Supabase Auth
   credentials) can complete — no subagent has access to sign in as Silvia.
