# Gestione Prenotazioni Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a login-protected `/gestione-prenotazioni` page where Silvia can see all bookings grouped by event, mark them paid/unpaid, and cancel one with the seat automatically restored.

**Architecture:** Three layers, one per task: (1) a Supabase SQL migration adding the columns/RLS/RPC this feature needs, (2) a new `AdminService` (its own persisted-session Supabase client, separate from the public SSR-safe one) plus a login-only version of the `Gestione` component wired into routing, (3) the full booking list/grouping/actions built on top of that scaffold. Each task ends in something you can actually exercise (a curl-callable RPC, then a working login screen, then the full feature) rather than inert code.

**Tech Stack:** Angular 20 (standalone components, Reactive Forms, signals, `@angular/ssr` per-route render modes), Supabase (Postgres RLS + Auth + RPC), Tailwind CSS v4.

## Global Constraints

- No PayPal integration, no password-reset UI, no self-service signup, no un-cancel action — all explicitly out of scope per the approved spec (`docs/superpowers/specs/2026-07-16-gestione-prenotazioni-design.md`).
- The admin page is never linked from `Navbar`/`BottomNav`/`Footer` — reachable only by URL.
- The admin page's Supabase client is separate from the existing `SupabaseService`'s client — the existing one must keep `persistSession: false` (it runs during SSR/prerendering); the new one uses `persistSession: true`.
- `/gestione-prenotazioni` is excluded from static prerendering (`RenderMode.Client`), added to `app.routes.server.ts` **before** the existing `**` wildcard.
- Authenticated writes to `prenotazioni` are restricted to the `pagato` and `cancellata` columns only (column-level grant), never the customer's fiscal/contact fields.
- `eventi`'s existing public `select` policy is scoped `to anon` and does **not** cover an authenticated session — a separate `to authenticated` policy is required (`anon` and `authenticated` are distinct Postgres roles).
- Verification method for this codebase: SQL changes are applied by the human running them in the Supabase SQL editor (I cannot run DDL through the public anon-key REST API) — verify afterward with safe, non-destructive `curl` calls against the live project, the same pattern already used for `prenota_posto.sql` and `rls_lockdown.sql` earlier in this project's history. App-layer changes are verified with `npx ng build` plus a real browser check (this project has no unit/component test suite).
- Literal copy (Italian), not placeholders — use exactly: login heading "Accedi", login error "Email o password non corretti.", empty state "Nessuna prenotazione ancora.", toggle label "Mostra annullate", cancel button resting state "Annulla prenotazione", cancel button armed state "Conferma annullamento?", logout button "Esci".

---

### Task 1: Database migration — columns, RPC, RLS

**Files:**
- Create: `supabase/admin_gestione.sql`

**Interfaces:**
- Consumes: the existing `prenotazioni` and `eventi` tables, and the existing `prenota_posto` function (from `supabase/prenota_posto.sql`, already live).
- Produces: `prenotazioni.evento_id` (bigint, nullable), `prenotazioni.pagato` (boolean, default false), `prenotazioni.cancellata` (boolean, default false); a `prenota_posto` that now also stores `evento_id`; a new RPC `annulla_prenotazione(p_prenotazione_id bigint) returns boolean`; RLS policies granting the `authenticated` role `select` on `eventi` and `prenotazioni`, and column-scoped `update(pagato, cancellata)` on `prenotazioni`. Tasks 2 and 3 call `annulla_prenotazione` via `client.rpc('annulla_prenotazione', { p_prenotazione_id })` and read/write the three new columns by name.

- [ ] **Step 1: Write the migration file**

Create `supabase/admin_gestione.sql` with this exact content:

```sql
-- Fase "gestione prenotazioni": aggiunge il tracciamento del pagamento e
-- l'annullamento con ripristino posto, riservati a un account autenticato
-- (Silvia). Vedi docs/superpowers/specs/2026-07-16-gestione-prenotazioni-design.md.
--
-- COME ATTIVARLO:
-- 1. Aprire il progetto su https://supabase.com -> SQL Editor
-- 2. Incollare ed eseguire questo intero file
-- 3. Creare l'account di Silvia in Authentication -> Users -> Add user
--    (email + password a vostra scelta) se non esiste già: è un passo
--    manuale nel pannello Supabase, non fatto da questo file.

alter table prenotazioni add column if not exists evento_id bigint references eventi(id);
alter table prenotazioni add column if not exists pagato boolean not null default false;
alter table prenotazioni add column if not exists cancellata boolean not null default false;

-- prenota_posto aggiornata per salvare anche l'evento_id che già riceve
-- (prima lo usava solo per scalare il posto, senza mai salvarlo sulla riga).
create or replace function prenota_posto(
  p_evento_id bigint,
  p_evento_titolo text,
  p_nome_completo text,
  p_email text,
  p_codice_fiscale text,
  p_ragione_sociale text,
  p_partita_iva text,
  p_sdi text,
  p_indirizzo text,
  p_cap text,
  p_citta text
) returns boolean
language plpgsql
security definer
as $$
declare
  righe_aggiornate integer;
begin
  update eventi
     set posti_disponibili = posti_disponibili - 1
   where id = p_evento_id
     and posti_disponibili > 0;

  get diagnostics righe_aggiornate = row_count;
  if righe_aggiornate = 0 then
    return false;
  end if;

  insert into prenotazioni (
    evento_id, evento_titolo, nome_completo, email, codice_fiscale,
    ragione_sociale, partita_iva, sdi, indirizzo, cap, citta
  ) values (
    p_evento_id, p_evento_titolo, p_nome_completo, p_email, p_codice_fiscale,
    p_ragione_sociale, p_partita_iva, p_sdi, p_indirizzo, p_cap, p_citta
  );

  return true;
end;
$$;

grant execute on function prenota_posto to anon;

-- Annulla una prenotazione e ripristina il posto, in un'unica transazione.
-- Fa la propria ricerca autorevole dell'evento (invece di fidarsi di un id
-- passato dal client): prima usa evento_id se presente sulla riga, altrimenti
-- risale tramite il titolo per le prenotazioni fatte prima di questa migrazione.
create or replace function annulla_prenotazione(p_prenotazione_id bigint)
returns boolean
language plpgsql
security definer
as $$
declare
  v_evento_id bigint;
  v_righe integer;
begin
  select evento_id into v_evento_id from prenotazioni where id = p_prenotazione_id;

  if v_evento_id is null then
    select e.id into v_evento_id
      from eventi e
      join prenotazioni p on p.evento_titolo = e.titolo
      where p.id = p_prenotazione_id
      limit 1;
  end if;

  update prenotazioni set cancellata = true
    where id = p_prenotazione_id and cancellata = false;

  get diagnostics v_righe = row_count;
  if v_righe = 0 then
    return false;
  end if;

  if v_evento_id is not null then
    update eventi set posti_disponibili = posti_disponibili + 1 where id = v_evento_id;
  end if;

  return true;
end;
$$;

grant execute on function annulla_prenotazione to authenticated;

-- Lettura prenotazioni riservata a un utente autenticato (mai al pubblico anonimo).
drop policy if exists "prenotazioni_select_autenticato" on prenotazioni;
create policy "prenotazioni_select_autenticato"
  on prenotazioni for select
  to authenticated
  using (true);

-- Scrittura riservata a un utente autenticato, e solo sulle colonne
-- pagato/cancellata: mai sui dati fiscali/di contatto del cliente.
drop policy if exists "prenotazioni_update_autenticato" on prenotazioni;
create policy "prenotazioni_update_autenticato"
  on prenotazioni for update
  to authenticated
  using (true)
  with check (true);

revoke update on prenotazioni from authenticated;
grant update (pagato, cancellata) on prenotazioni to authenticated;

-- eventi: la policy pubblica esistente è "to anon" e non copre una sessione
-- autenticata (ruoli distinti in Postgres/Supabase) — ne serve una propria.
drop policy if exists "eventi_select_autenticato" on eventi;
create policy "eventi_select_autenticato"
  on eventi for select
  to authenticated
  using (true);
```

- [ ] **Step 2: Ask the human to run the migration and confirm Silvia's admin account exists**

Tell the human: "Please run `supabase/admin_gestione.sql` in the Supabase SQL editor (same process as the previous two SQL files), and confirm you've created Silvia's login under Authentication → Users → Add user in the Supabase dashboard (any email/password — you'll need it for Task 2's login check). Let me know when both are done." Wait for their confirmation before continuing — Step 3 needs the SQL live, and Task 2 needs the account to exist.

- [ ] **Step 3: Verify the migration is live, without touching real data**

Run these two `curl` checks (same safe pattern already used earlier in this project's history — a nonexistent id can't affect a real booking or event):

```bash
curl -s "https://exykuzvxhphfokulfgcw.supabase.co/rest/v1/rpc/annulla_prenotazione" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -d '{"p_prenotazione_id":999999}' \
  -w "\nHTTP_STATUS:%{http_code}\n"
```

Expected: `HTTP_STATUS:401` or a permission-denied JSON error — this RPC is granted to `authenticated` only, so an anonymous caller must be rejected. (If instead you get `HTTP_STATUS:200` with body `false`, that would mean the function ran as anon, which means the `grant execute ... to authenticated` in Step 1 didn't take effect — stop and re-check the SQL before continuing.)

```bash
curl -s "https://exykuzvxhphfokulfgcw.supabase.co/rest/v1/prenotazioni?select=*&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -w "\nHTTP_STATUS:%{http_code}\n"
```

Expected: `[]` with `HTTP_STATUS:200` — anon still cannot read bookings (this must not have regressed from the 2026-07-14 lockdown).

- [ ] **Step 4: Commit**

```bash
git add supabase/admin_gestione.sql
git commit -m "$(cat <<'EOF'
feat(db): add payment/cancellation tracking to prenotazioni

New evento_id/pagato/cancellata columns, prenota_posto now stores the
evento_id it already receives, and a new annulla_prenotazione RPC that
atomically marks a booking cancelled and frees its seat. RLS grants
authenticated-only select on prenotazioni/eventi and column-scoped
update (pagato, cancellata) on prenotazioni — the public anon role's
access is unchanged (insert-only on prenotazioni, as of the 2026-07-14
lockdown).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: AdminService, Prenotazione model, and a login-only Gestione page

**Files:**
- Create: `src/app/core/models/prenotazione.model.ts`
- Create: `src/app/core/services/admin.service.ts`
- Create: `src/app/features/gestione/gestione.ts`
- Create: `src/app/features/gestione/gestione.html`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/app.routes.server.ts`

**Interfaces:**
- Consumes: Task 1's live `annulla_prenotazione` RPC and the three new `prenotazioni` columns (only for typing purposes in this task — the booking list itself is built in Task 3).
- Produces: `Prenotazione` interface (exact shape below) that Task 3 imports; `AdminService` with methods `signIn(email: string, password: string): Promise<{ error: unknown }>`, `signOut(): Promise<void>`, `getSession(): Promise<boolean>`, `getBookings(): Promise<Prenotazione[]>`, `setPaid(id: number, pagato: boolean): Promise<{ error: unknown }>`, `cancelBooking(id: number): Promise<{ success: boolean; error: unknown }>` — Task 3 calls all of these by these exact names. `Gestione` component with `protected` signals `checkingSession`, `authenticated`, `loginError`, `signingIn` and a `protected readonly loginForm` — Task 3 extends this same class and template rather than replacing them.

- [ ] **Step 1: Create the `Prenotazione` model**

Create `src/app/core/models/prenotazione.model.ts`:

```ts
export interface Prenotazione {
  id: number;
  evento_id: number | null;
  evento_titolo: string;
  nome_completo: string;
  email: string;
  codice_fiscale: string | null;
  ragione_sociale: string | null;
  partita_iva: string | null;
  sdi: string | null;
  indirizzo: string;
  cap: string;
  citta: string;
  created_at: string;
  pagato: boolean;
  cancellata: boolean;
}
```

- [ ] **Step 2: Create `AdminService`**

Create `src/app/core/services/admin.service.ts`:

```ts
import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Prenotazione } from '../models/prenotazione.model';

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
}
```

- [ ] **Step 3: Create the `Gestione` component (login-only for now)**

Create `src/app/features/gestione/gestione.ts`:

```ts
import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-gestione',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gestione.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gestione {
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);

  protected readonly checkingSession = signal(true);
  protected readonly authenticated = signal(false);
  protected readonly loginError = signal<string | null>(null);
  protected readonly signingIn = signal(false);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    // pagina privata, non pensata per essere indicizzata o linkata
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });

    afterNextRender(() => {
      this.admin.getSession().then((hasSession) => {
        this.authenticated.set(hasSession);
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
    const { error } = await this.admin.signIn(email, password);
    this.signingIn.set(false);
    if (error) {
      this.loginError.set('Email o password non corretti.');
      return;
    }
    this.authenticated.set(true);
  }

  async onLogout(): Promise<void> {
    await this.admin.signOut();
    this.authenticated.set(false);
  }
}
```

- [ ] **Step 4: Create the `Gestione` template (login-only for now)**

Create `src/app/features/gestione/gestione.html`:

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
  <section class="min-h-screen bg-parchment px-4 py-10">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-title font-medium text-gray-900 tracking-wide">Gestione prenotazioni</h1>
        <button type="button" (click)="onLogout()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 hover:text-brand transition-colors">Esci</button>
      </div>
      <p class="text-gray-600 text-sm">Elenco prenotazioni nel prossimo step.</p>
    </div>
  </section>
}
```

- [ ] **Step 5: Add the route**

In `src/app/app.routes.ts`, change:

```ts
  {
    path: 'shop',
    loadComponent: () => import('./features/shop/shop').then((m) => m.Shop),
    title: 'Blooming Wild ART — Shop',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
```

to:

```ts
  {
    path: 'shop',
    loadComponent: () => import('./features/shop/shop').then((m) => m.Shop),
    title: 'Blooming Wild ART — Shop',
  },
  {
    path: 'gestione-prenotazioni',
    loadComponent: () => import('./features/gestione/gestione').then((m) => m.Gestione),
    title: 'Blooming Wild ART — Gestione',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
```

Do **not** add this route to `NAV_ITEMS` in `src/app/layout/nav-items.ts` — it must stay unlinked from the site's navigation.

- [ ] **Step 6: Exclude the route from static prerendering**

In `src/app/app.routes.server.ts`, change:

```ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
```

to:

```ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'gestione-prenotazioni',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
```

- [ ] **Step 7: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.` (still 4 — `gestione-prenotazioni` is deliberately excluded, so the count of *prerendered* routes does not grow even though a 5th route now exists).

- [ ] **Step 8: Visual check — login flow, in a real browser**

This requires Task 1's Step 2 confirmation (Silvia's Supabase Auth account exists) — use that account's email/password for this check. Use the `run` skill (or `npm start` + a browser) to load `/gestione-prenotazioni` and confirm:
1. Briefly shows "Caricamento…", then the login form (you're not logged in yet in this browser).
2. Entering a wrong password shows "Email o password non corretti." and does not proceed.
3. Entering the real email/password logs in and shows "Gestione prenotazioni" with the "Elenco prenotazioni nel prossimo step." placeholder and an "Esci" button.
4. Reloading the page (`F5`) skips the login form and goes straight to the authenticated view — this proves `persistSession: true` is working (the whole reason for `AdminService` having its own client).
5. Clicking "Esci" returns to the login form; reloading after that stays on the login form (session was actually cleared, not just hidden).

- [ ] **Step 9: Commit**

```bash
git add src/app/core/models/prenotazione.model.ts src/app/core/services/admin.service.ts src/app/features/gestione/gestione.ts src/app/features/gestione/gestione.html src/app/app.routes.ts src/app/app.routes.server.ts
git commit -m "$(cat <<'EOF'
feat(gestione): add login-protected /gestione-prenotazioni scaffold

AdminService with its own persisted-session Supabase client (separate
from the SSR-safe public one), a Prenotazione model, and a Gestione
component that shows a login form or an authenticated placeholder.
The route is excluded from static prerendering (auth state doesn't
exist at build time) and is not linked from any nav.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Booking list, grouping, payment toggle, cancellation

**Files:**
- Modify: `src/app/features/gestione/gestione.ts`
- Modify: `src/app/features/gestione/gestione.html`

**Interfaces:**
- Consumes: `AdminService.getBookings/setPaid/cancelBooking` and `Prenotazione` (Task 2); the existing, unmodified `SupabaseService.getEventSeats(): Promise<Record<number, number>>` (already in `src/app/core/services/supabase.service.ts`) for the "posti disponibili" figure per event group.
- Produces: nothing consumed elsewhere — this is the final layer of this feature.

- [ ] **Step 1: Confirm the current file matches this snapshot before editing**

Read `src/app/features/gestione/gestione.ts` and confirm it still matches Task 2 Step 3's code exactly (same constructor, same four signals, same `loginForm`, same `onLogin`/`onLogout`). If it's drifted, stop and reconcile before continuing.

- [ ] **Step 2: Add booking state, grouping, and actions to `gestione.ts`**

In `src/app/features/gestione/gestione.ts`, change the imports from:

```ts
import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';
```

to:

```ts
import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta } from '@angular/platform-browser';
import { AdminService } from '../../core/services/admin.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Prenotazione } from '../../core/models/prenotazione.model';
```

Change the `@Component` decorator's `imports` array from:

```ts
  imports: [ReactiveFormsModule],
```

to:

```ts
  imports: [ReactiveFormsModule, DatePipe, NgClass],
```

Add a private `supabase` field next to the existing `admin`/`fb` fields — change:

```ts
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
```

to:

```ts
  private readonly admin = inject(AdminService);
  private readonly supabase = inject(SupabaseService);
  private readonly fb = inject(FormBuilder);
```

Add new signals directly after the existing `protected readonly signingIn = signal(false);` line:

```ts
  protected readonly signingIn = signal(false);
  protected readonly bookings = signal<Prenotazione[]>([]);
  protected readonly seats = signal<Record<number, number>>({});
  protected readonly showCancelled = signal(false);
  protected readonly confirmingCancelId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);
```

Add a `groupedBookings` computed signal directly after the existing `loginForm` declaration (after its closing `});`):

```ts
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
```

Change the constructor's `afterNextRender` block from:

```ts
    afterNextRender(() => {
      this.admin.getSession().then((hasSession) => {
        this.authenticated.set(hasSession);
        this.checkingSession.set(false);
      });
    });
```

to:

```ts
    afterNextRender(() => {
      this.admin.getSession().then((hasSession) => {
        this.authenticated.set(hasSession);
        this.checkingSession.set(false);
        if (hasSession) {
          this.loadData();
        }
      });
    });
```

Change `onLogin()` from:

```ts
  async onLogin(): Promise<void> {
    this.loginError.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.signingIn.set(true);
    const { email, password } = this.loginForm.getRawValue();
    const { error } = await this.admin.signIn(email, password);
    this.signingIn.set(false);
    if (error) {
      this.loginError.set('Email o password non corretti.');
      return;
    }
    this.authenticated.set(true);
  }
```

to:

```ts
  async onLogin(): Promise<void> {
    this.loginError.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.signingIn.set(true);
    const { email, password } = this.loginForm.getRawValue();
    const { error } = await this.admin.signIn(email, password);
    this.signingIn.set(false);
    if (error) {
      this.loginError.set('Email o password non corretti.');
      return;
    }
    this.authenticated.set(true);
    this.loadData();
  }
```

Add these new methods at the end of the class, directly after `onLogout()`:

```ts
  private loadData(): void {
    this.admin.getBookings().then((data) => this.bookings.set(data));
    this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
  }

  async togglePaid(booking: Prenotazione): Promise<void> {
    this.actionError.set(null);
    const { error } = await this.admin.setPaid(booking.id, !booking.pagato);
    if (error) {
      this.actionError.set('Impossibile aggiornare lo stato del pagamento. Riprova.');
      return;
    }
    this.bookings.update((list) =>
      list.map((b) => (b.id === booking.id ? { ...b, pagato: !booking.pagato } : b)),
    );
  }

  armCancel(id: number): void {
    this.confirmingCancelId.set(id);
  }

  async confirmCancel(id: number): Promise<void> {
    this.actionError.set(null);
    const { success, error } = await this.admin.cancelBooking(id);
    this.confirmingCancelId.set(null);
    if (error || !success) {
      this.actionError.set('Impossibile annullare la prenotazione. Riprova.');
      return;
    }
    this.bookings.update((list) => list.map((b) => (b.id === id ? { ...b, cancellata: true } : b)));
    this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
  }
```

- [ ] **Step 3: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.` — if there's a compile error naming `bookings`, `seats`, `showCancelled`, `confirmingCancelId`, `actionError`, `groupedBookings`, `loadData`, `togglePaid`, `armCancel`, or `confirmCancel`, re-check this step's edits against the exact code above before continuing.

- [ ] **Step 4: Replace the placeholder in `gestione.html` with the real booking list**

In `src/app/features/gestione/gestione.html`, find:

```html
} @else {
  <section class="min-h-screen bg-parchment px-4 py-10">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-title font-medium text-gray-900 tracking-wide">Gestione prenotazioni</h1>
        <button type="button" (click)="onLogout()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 hover:text-brand transition-colors">Esci</button>
      </div>
      <p class="text-gray-600 text-sm">Elenco prenotazioni nel prossimo step.</p>
    </div>
  </section>
}
```

and change it to:

```html
} @else {
  <section class="min-h-screen bg-parchment px-4 py-10">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-title font-medium text-gray-900 tracking-wide">Gestione prenotazioni</h1>
        <button type="button" (click)="onLogout()" class="text-xs font-semibold tracking-widest uppercase text-gray-600 hover:text-brand transition-colors">Esci</button>
      </div>

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
    </div>
  </section>
}
```

- [ ] **Step 5: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.`.

- [ ] **Step 6: Visual check — full flow, in a real browser**

Use the `run` skill (or `npm start` + a browser) at `/gestione-prenotazioni`, log in with Silvia's account, and confirm:
1. Bookings appear grouped by event title, each group showing a "posti disponibili" count.
2. Cancelled bookings are hidden until you check "Mostra annullate", which reveals them (labeled "Annullata", no action buttons on that row).
3. Clicking "Non pagato" on a row flips it to "Pagato" (moss-colored) without a page reload; clicking again flips it back.
4. Clicking "Annulla prenotazione" on an active row changes that row's button to "Conferma annullamento?"; clicking a *different* row's "Annulla prenotazione" re-arms that other row instead (only one row armed at a time).
5. Clicking "Conferma annullamento?" removes that booking from the visible list (unless "Mostra annullate" is checked, in which case it now shows as "Annullata") and the event group's "posti disponibili" count increases by 1.
6. Reload the page — confirm the cancellation and payment-status changes persisted (they're reading real rows from Supabase, not just local component state).

**If you need a real booking to test against and don't want to use production customer data:** book a real seat through the public `/eventi` form yourself first (using your own name/a throwaway email) — that's the same real flow every customer goes through, so it's safe to create and then cancel via this admin page as part of verifying Step 6.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/gestione/gestione.ts src/app/features/gestione/gestione.html
git commit -m "$(cat <<'EOF'
feat(gestione): booking list grouped by event, payment toggle, cancellation

Bookings group by event title with a live seat-count readout, cancelled
bookings hidden behind a "Mostra annullate" toggle, a reversible
paid/unpaid button per booking, and a two-click cancellation that calls
the atomic annulla_prenotazione RPC and refreshes the seat count.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review notes

- **Spec coverage:** schema/RLS/RPC (✓ Task 1), separate persisted-session client (✓ Task 2 Step 2), route + prerender exclusion + no nav link (✓ Task 2 Steps 5-6), login form + session persistence check (✓ Task 2 Step 8), grouped list + posti disponibili (✓ Task 3 Step 4), hidden-by-default cancelled bookings with a global toggle (✓ Task 3 Step 4), reversible paid toggle (✓ Task 3 Steps 2/4), two-click cancel with only one row armed at a time (✓ Task 3 Steps 2/4), literal Italian copy from the Global Constraints (✓ used verbatim throughout), column-scoped authenticated grants (✓ Task 1), `eventi` needing its own `to authenticated` policy rather than relying on the `anon` one (✓ Task 1).
- **No placeholders:** every step has literal code, exact commands, or an exact human-confirmation checkpoint (Task 1 Step 2) rather than a vague "add error handling" instruction.
- **Type/interface consistency:** `Prenotazione` field names match between the model (Task 2 Step 1), `AdminService` (Task 2 Step 2, `data as Prenotazione[]`), and the template (Task 3 Step 4, `b.nome_completo`/`b.codice_fiscale`/etc.) — checked against each other, no drift. `AdminService` method names/signatures (`signIn`, `signOut`, `getSession`, `getBookings`, `setPaid`, `cancelBooking`) are identical between Task 2's Interfaces block, Task 2's actual code, and Task 3's usage (`this.admin.getBookings()`, `this.admin.setPaid(booking.id, !booking.pagato)`, `this.admin.cancelBooking(id)`).
