# Gestione Eventi — Fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin UI that lets Silvia create, edit, and hide workshop events
(with poster upload, price, and seat count) from the existing `/gestione-prenotazioni`
page, and show the price on the public Eventi page.

**Architecture:** Add RLS policies so an authenticated user can insert/update
`eventi` rows, plus a public-read Storage bucket for poster images. Add admin-only
service methods (`AdminService.getAllEvents`/`createEvent`/`updateEvent`/
`togglePubblicato`/`uploadLocandina`). Restructure `gestione.ts`/`.html` with a
two-tab switcher ("Prenotazioni" | "Eventi"); the new "Eventi" tab holds an event
list plus a create/edit form. The form's "posti totali" field is translated to the
stored `posti_disponibili` column by subtracting already-booked seats (computed
client-side from booking data already loaded for the Prenotazioni tab — no extra
query). Finally, add a price badge to the public Eventi page.

**Tech Stack:** Angular 20 standalone components/signals, Supabase (Postgres +
Storage), Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-07-16-gestione-eventi-fase2-design.md` —
read it first if anything below is ambiguous; the SQL and code shapes here are
transcribed directly from it (with one internal simplification noted in Task 4:
the "current locandina URL" is tracked in its own signal instead of being looked
up from the events list on every read — same behavior, less redundant lookup
code).

## Global Constraints

- Exact new columns/policies: `eventi` gets `insert`/`update` RLS for
  `authenticated` (no `delete` policy — hiding an event never removes its row).
  A new public Storage bucket `locandine` with public `select`, `authenticated`
  `insert`/`update`.
- Exact TypeScript field names: `PaintEventAdmin` extends `PaintEvent` with
  `postiDisponibili: number` and `pubblicato: boolean`. `EventFormValue` has
  `titolo`, `luogo`, `indirizzo`, `data`, `oraInizio`, `oraFine`, `descrizione`,
  `prezzo`, `capienzaTotale`, `locandinaUrl`, `pubblicato`.
- The form's `capienzaTotale` field represents TOTAL seats for the event, not the
  live `posti_disponibili` counter. Before every save, compute
  `postiDisponibili = capienzaTotale - postiGiaPrenotati` (where
  `postiGiaPrenotati` sums `numero_posti` from non-cancelled bookings for that
  event, read from the `bookings` signal already loaded for the Prenotazioni
  tab — never a new query). Block the save with an error message if this would
  go negative.
- No new `*.spec.ts` test files: this codebase has zero unit tests for services,
  utils, or feature components (only the default Angular scaffold `app.spec.ts`
  exists) — follow that existing convention. Each task instead verifies via
  `npm run build` (must succeed with zero TypeScript errors) and, where noted, a
  manual check.
- Do not touch `getEventSeats()`, `prenotaPosto()`, `invalidateSeatsCache()`,
  `getPublishedEvents()` in `supabase.service.ts`, or `prenota_posto`/
  `annulla_prenotazione`/their RLS — this phase only adds new, additive
  permissions and methods.
- No event deletion anywhere in the UI — only hide/publish via `pubblicato`.
- No automatic cleanup of replaced poster images in Storage (accepted trade-off,
  documented in the spec).
- The SQL migration (Task 1) must be run manually by the user in the Supabase SQL
  Editor — no subagent can do this. After Task 1's review is clean, pause and
  ask the user to run `supabase/gestione_eventi_fase2.sql` before the feature is
  end-to-end testable in a real browser (Tasks 2-5 still compile and can be
  built/reviewed without the DB/Storage being migrated yet, except that a live
  save/upload will fail against production until the SQL has run).

---

### Task 1: SQL migration — RLS policies + Storage bucket

**Files:**
- Create: `supabase/gestione_eventi_fase2.sql`

**Interfaces:**
- Produces: `insert`/`update` RLS policies on `eventi` for `authenticated`; a
  public Storage bucket `locandine` with `select`/`insert`/`update` policies.
  Task 3 (`AdminService`) assumes these exist when calling `.insert()`/`.update()`
  on `eventi` and `.storage.from('locandine')`.

- [ ] **Step 1: Write the migration file**

Create `supabase/gestione_eventi_fase2.sql` with this exact content:

```sql
-- Fase 2 di "gestione eventi": permette a un utente autenticato (Silvia) di
-- creare e modificare eventi, e aggiunge lo storage per le locandine.
-- Vedi docs/superpowers/specs/2026-07-16-gestione-eventi-fase2-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

-- Silvia (autenticata) può creare e modificare eventi. Nessuna policy di
-- delete: gli eventi si nascondono (pubblicato = false), non si cancellano.
drop policy if exists "eventi_insert_autenticato" on eventi;
create policy "eventi_insert_autenticato"
  on eventi for insert
  to authenticated
  with check (true);

drop policy if exists "eventi_update_autenticato" on eventi;
create policy "eventi_update_autenticato"
  on eventi for update
  to authenticated
  using (true)
  with check (true);

-- Bucket pubblico per le locandine: lettura aperta a tutti (il sito pubblico
-- deve poter mostrare l'immagine), scrittura solo per un utente autenticato.
insert into storage.buckets (id, name, public)
values ('locandine', 'locandine', true)
on conflict (id) do nothing;

drop policy if exists "locandine_select_pubblico" on storage.objects;
create policy "locandine_select_pubblico"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'locandine');

drop policy if exists "locandine_insert_autenticato" on storage.objects;
create policy "locandine_insert_autenticato"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'locandine');

drop policy if exists "locandine_update_autenticato" on storage.objects;
create policy "locandine_update_autenticato"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'locandine');
```

- [ ] **Step 2: Report status**

This file is not run by the implementer (no Supabase credentials available to
subagents). Report `DONE_WITH_CONCERNS` with the concern: "SQL file created but
not executed — requires the human to run it in the Supabase SQL Editor."

- [ ] **Step 3: Commit**

```bash
git add supabase/gestione_eventi_fase2.sql
git commit -m "feat: RLS insert/update su eventi per utenti autenticati e bucket Storage per le locandine"
```

**Model:** haiku (verbatim transcription, no design judgment).

---

### Task 2: Add `PaintEventAdmin` and `EventFormValue` to `event.model.ts`

**Files:**
- Modify: `src/app/core/models/event.model.ts`

**Interfaces:**
- Produces: `PaintEventAdmin` and `EventFormValue`, both consumed by Task 3
  (`AdminService`) and Task 4 (`gestione.ts`).

- [ ] **Step 1: Append the two new interfaces**

Add this to the end of `src/app/core/models/event.model.ts` (keep the existing
`PaintEvent`/`PaintEventWithSeats` interfaces unchanged, above this):

```ts

/** Vista admin di un evento: espone anche i campi gestionali che il pubblico
 *  non deve mai vedere (posti "grezzi" e stato di pubblicazione). */
export interface PaintEventAdmin extends PaintEvent {
  postiDisponibili: number;
  pubblicato: boolean;
}

/** Valori del form di creazione/modifica evento. `capienzaTotale` è il numero
 *  totale di posti pensati per l'evento, non il contatore live posti_disponibili
 *  (vedi gestione.ts per come si traduce l'uno nell'altro prima del salvataggio). */
export interface EventFormValue {
  titolo: string;
  luogo: string;
  indirizzo: string;
  data: string;
  oraInizio: string;
  oraFine: string;
  descrizione: string;
  prezzo: number;
  capienzaTotale: number;
  locandinaUrl: string | null;
  pubblicato: boolean;
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: succeeds with zero errors (these are new, unused-so-far exports;
nothing consumes them yet, which is not an error in TypeScript).

- [ ] **Step 3: Commit**

```bash
git add src/app/core/models/event.model.ts
git commit -m "feat: aggiunge PaintEventAdmin ed EventFormValue per il pannello di amministrazione eventi"
```

**Model:** haiku (verbatim transcription of the interfaces above).

---

### Task 3: Add event-management methods to `AdminService`

**Files:**
- Modify: `src/app/core/services/admin.service.ts`

**Interfaces:**
- Consumes: `PaintEventAdmin`, `EventFormValue` from Task 2.
- Produces: `getAllEvents()`, `createEvent()`, `updateEvent()`,
  `togglePubblicato()`, `uploadLocandina()`. Task 4 (`gestione.ts`) calls all
  five.

- [ ] **Step 1: Replace the file content**

Replace the entire content of `src/app/core/services/admin.service.ts` with:

```ts
import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Prenotazione } from '../models/prenotazione.model';
import { EventFormValue, PaintEventAdmin } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  // Client separato da SupabaseService: qui la sessione va persistita (Silvia
  // resta loggata tra un caricamento e l'altro), a differenza del client
  // pubblico che deve restare compatibile con l'SSR/prerendering. Questo
  // client viene creato solo quando la pagina di gestione lo usa, l'unica
  // rotta esclusa dal prerendering (vedi app.routes.server.ts).
  private clientPromise: Promise<SupabaseClient> | null = null;

  private getClient(): Promise<SupabaseClient> {
    if (!this.clientPromise) {
      this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        }),
      );
    }
    return this.clientPromise;
  }

  async signIn(email: string, password: string): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error };
  }

  async signOut(): Promise<void> {
    const client = await this.getClient();
    await client.auth.signOut();
  }

  async getSession(): Promise<boolean> {
    const client = await this.getClient();
    const { data } = await client.auth.getSession();
    return data.session !== null;
  }

  async getBookings(): Promise<Prenotazione[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('prenotazioni')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) {
      console.error('Errore nel recupero delle prenotazioni:', error);
      return [];
    }
    return data as Prenotazione[];
  }

  async setPaid(id: number, pagato: boolean): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('prenotazioni').update({ pagato }).eq('id', id);
    return { error };
  }

  async cancelBooking(id: number): Promise<{ success: boolean; error: unknown }> {
    const client = await this.getClient();
    const { data, error } = await client.rpc('annulla_prenotazione', { p_prenotazione_id: id });
    return { success: data === true, error };
  }

  /** Tutti gli eventi (pubblicati e nascosti), ordinati per data crescente. */
  async getAllEvents(): Promise<PaintEventAdmin[]> {
    const client = await this.getClient();
    const { data, error } = await client.from('eventi').select('*').order('data', { ascending: true });
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
      postiDisponibili: row['posti_disponibili'],
      pubblicato: row['pubblicato'],
    }));
  }

  async createEvent(fields: EventFormValue, postiDisponibili: number): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('eventi').insert([this.toRow(fields, postiDisponibili)]);
    return { error };
  }

  async updateEvent(id: number, fields: EventFormValue, postiDisponibili: number): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('eventi').update(this.toRow(fields, postiDisponibili)).eq('id', id);
    return { error };
  }

  async togglePubblicato(id: number, pubblicato: boolean): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('eventi').update({ pubblicato }).eq('id', id);
    return { error };
  }

  async uploadLocandina(file: File): Promise<{ url: string | null; error: unknown }> {
    const client = await this.getClient();
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await client.storage.from('locandine').upload(path, file);
    if (error) return { url: null, error };
    const { data } = client.storage.from('locandine').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  private toRow(fields: EventFormValue, postiDisponibili: number) {
    return {
      titolo: fields.titolo,
      luogo: fields.luogo,
      indirizzo: fields.indirizzo,
      data: fields.data,
      ora_inizio: fields.oraInizio,
      ora_fine: fields.oraFine,
      descrizione: fields.descrizione,
      prezzo: fields.prezzo,
      posti_disponibili: postiDisponibili,
      locandina_url: fields.locandinaUrl,
      pubblicato: fields.pubblicato,
    };
  }
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: succeeds with zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/admin.service.ts
git commit -m "feat: AdminService gestisce creazione, modifica e pubblicazione degli eventi"
```

**Model:** haiku (verbatim transcription; all six pre-existing methods are
reproduced unchanged plus five new additive methods — no logic to design).

---

### Task 4: Rewire `gestione.ts`/`.html` with the Eventi tab

**Files:**
- Modify: `src/app/features/gestione/gestione.ts`
- Modify: `src/app/features/gestione/gestione.html`

**Interfaces:**
- Consumes: `PaintEventAdmin`, `EventFormValue` from Task 2; all five new
  `AdminService` methods from Task 3; `formatFasciaOraria` from
  `../../core/utils/event-format.util` (already created in Fase 1, exports
  `formatDataItaliana`, `formatFasciaOraria`, `buildMapsUrl`).
- Produces: nothing consumed by later tasks (Task 5 is independent).

This is the largest task in the plan — both files are given as full
replacements below to avoid transcription errors from partial-diff instructions
on files this size. One deliberate simplification versus the spec: the
"current locandina URL" (shown as a preview in the edit form, and reused as the
fallback when no new file is selected) is tracked in its own signal
(`currentLocandinaUrl`), set once when the form opens, instead of being looked
up from `adminEvents()` by `.find()` every time it's needed. Same behavior,
avoids a repeated array scan and keeps the template simpler.

- [ ] **Step 1: Replace `gestione.ts`**

Replace the entire content of `src/app/features/gestione/gestione.ts` with:

```ts
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Prenotazione } from '../../core/models/prenotazione.model';
import { EventFormValue, PaintEventAdmin } from '../../core/models/event.model';
import { formatFasciaOraria } from '../../core/utils/event-format.util';

@Component({
  selector: 'app-gestione',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, NgClass],
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

  protected readonly activeTab = signal<'prenotazioni' | 'eventi'>('prenotazioni');
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

  selectTab(tab: 'prenotazioni' | 'eventi'): void {
    this.activeTab.set(tab);
    if (tab === 'eventi' && !this.eventsTabLoaded()) {
      this.admin.getAllEvents().then((events) => {
        this.adminEvents.set(events);
        this.eventsTabLoaded.set(true);
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
      capienzaTotale: ev.postiDisponibili + giaPrenotati,
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
}
```

- [ ] **Step 2: Replace `gestione.html`**

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
      } @else {
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
      }
    </div>
  </section>
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/gestione/gestione.ts src/app/features/gestione/gestione.html
git commit -m "feat(gestione): scheda Eventi con elenco, creazione, modifica e pubblicazione"
```

**Model:** sonnet (largest, highest-integration-risk task in this plan —
signal wiring across ~10 new pieces of state, a full reactive form, and a
sizeable template with nested conditionals).

---

### Task 5: Show the price on the public Eventi page

**Files:**
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/features/eventi/eventi.html`

**Interfaces:**
- Consumes: `ev.prezzo` — already present on `PaintEventWithSeats` since Fase 1
  (it extends `PaintEvent`, which has had `prezzo: number` since Fase 1's model
  change). The `eventsWithSeats` computed already spreads the full event object,
  so `prezzo` is already available on `ev` in the template — no change needed
  to that computed. The only `eventi.ts` change needed is registering
  `DecimalPipe` so the template's new `| number` pipe usage compiles (Angular
  standalone components must explicitly list every pipe they use — `DatePipe`/
  `NgClass` are already listed in this file for the same reason, but the
  `number` pipe, backed by `DecimalPipe`, isn't used anywhere in this file yet).

- [ ] **Step 1: Register `DecimalPipe` in `eventi.ts`**

In `src/app/features/eventi/eventi.ts`, change:
```ts
import { NgClass } from '@angular/common';
```
to:
```ts
import { DecimalPipe, NgClass } from '@angular/common';
```
And change the component's `imports` array from:
```ts
  imports: [ReactiveFormsModule, NgClass, Icon],
```
to:
```ts
  imports: [ReactiveFormsModule, NgClass, DecimalPipe, Icon],
```

- [ ] **Step 2: Add the price badge under the event title**

In `src/app/features/eventi/eventi.html`, find this line (inside the
`@for (ev of eventsWithSeats(); track ev.id)` loop, right after the opening of
the left column):
```html
            <h3 class="text-2xl md:text-4xl font-title font-medium text-gray-900 mb-1 tracking-wide">{{ ev.title }}</h3>
```
Add this line immediately after it:
```html
            <p class="text-sm font-title italic text-brand mb-2">€ {{ ev.prezzo | number: '1.2-2' }}</p>
```

- [ ] **Step 3: Add the price to the booking form's seat summary**

Find this line (inside the booking form, shown once an event is selected):
```html
            <p class="text-xs text-gray-600 mt-2">Posti disponibili per questo evento: {{ ev.seatsAvailable }}</p>
```
Replace it with:
```html
            <p class="text-xs text-gray-600 mt-2">Posti disponibili per questo evento: {{ ev.seatsAvailable }} · € {{ ev.prezzo | number: '1.2-2' }} a persona</p>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors. This step matters more than
usual for this task: if `DecimalPipe` weren't registered (Step 1), this build
would fail with an `NG8004`-style "no pipe found with name 'number'" error —
confirm the build is clean, not just that it runs.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/eventi/eventi.ts src/app/features/eventi/eventi.html
git commit -m "feat(eventi): mostra il prezzo sulla pagina pubblica e nel riepilogo di prenotazione"
```

**Model:** haiku (small, mechanical: one pipe registration plus a two-line
template addition, no logic).

---

## Post-implementation verification (not a subagent task)

After all 5 tasks are committed and reviewed:

1. Ask the user to run `supabase/gestione_eventi_fase2.sql` in the Supabase SQL
   Editor (per Global Constraints — this cannot be automated).
2. Push the branch and, in a real browser, log in to `/gestione-prenotazioni`
   and manually walk through: switching to the "Eventi" tab, creating a new
   event (with and without a locandina), editing an existing event (confirm
   the "posti totali" pre-fill and the "già prenotati" note are correct for an
   event with real bookings), hiding and re-publishing an event, and
   confirming the hidden event disappears from the public Eventi page while
   staying visible (as "Nascosto") in the admin list. Also confirm the price
   badge appears correctly on the public Eventi page and in the booking
   summary.
3. This is a live-credentialed, interactive checklist that only the human
   owner (or a browser automation session with real Supabase Auth credentials)
   can complete — no subagent has access to sign in as Silvia.
