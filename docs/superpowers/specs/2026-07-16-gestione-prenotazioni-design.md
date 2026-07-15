# Gestione prenotazioni — admin login, payment tracking, cancellation

## Context

Following the RLS lockdown (2026-07-14) and the privacy notice (2026-07-15), the user asked how Silvia can track who has actually paid for a booking (the site collects no payment itself — PayPal, if added, will be a simple unverified link) and how she can cancel a booking for someone who can no longer attend. Both need a way for Silvia — and only Silvia — to see and manage the list of bookings, since the RLS lockdown correctly removed the public's ability to read that data at all.

Approved direction: a private, login-protected page at `/gestione-prenotazioni`, not linked from anywhere in the site's navigation, showing bookings grouped by event with a "pagato" toggle and a two-click "annulla prenotazione" action that atomically frees the seat.

## What stays the same (out of scope)

- No PayPal integration in this spec — this only builds the tracking side (a manual "pagato" flag Silvia sets herself after checking her own PayPal account). Automatic payment verification is a separate, later decision.
- No password-reset UI, no self-service signup — one admin account, created once by hand in the Supabase dashboard (Authentication → Users → Add user). If Silvia ever forgets her password, it's reset the same way, outside the app.
- No un-cancel action — once marked `cancellata`, a booking stays cancelled; if the customer wants to attend after all, they book again fresh. (Marking "pagato" IS reversible both ways, per the approved design — these are different because un-cancelling would need to re-check seat availability and could conflict with someone else who took that freed seat in the meantime; toggling paid has no such race.)
- No column-level UI for the raw `codice_fiscale`/`partita_iva`/address fields beyond what's already useful to identify a booking (name, email, billing type, date) — full invoicing detail isn't re-displayed here, since this page's job is payment/cancellation tracking, not invoicing.
- Existing public flows (`Eventi` booking form, `SupabaseService`, `prenota_posto`) are extended (one new column read/written, one function signature change) but not restructured.

## Design

### 1. Schema changes (new SQL file: `supabase/admin_gestione.sql`)

Three additive columns on `prenotazioni`:

```sql
alter table prenotazioni add column if not exists evento_id bigint references eventi(id);
alter table prenotazioni add column if not exists pagato boolean not null default false;
alter table prenotazioni add column if not exists cancellata boolean not null default false;
```

**`prenota_posto` is updated** (the function is `create or replace`d, not a new function) to accept and store the event id it already receives as `p_evento_id` — today it takes that parameter to know which row to decrement, but never saves it onto the inserted booking. The insert gains one column/value:

```sql
insert into prenotazioni (
  evento_id, evento_titolo, nome_completo, email, codice_fiscale,
  ragione_sociale, partita_iva, sdi, indirizzo, cap, citta
) values (
  p_evento_id, p_evento_titolo, p_nome_completo, p_email, p_codice_fiscale,
  p_ragione_sociale, p_partita_iva, p_sdi, p_indirizzo, p_cap, p_citta
);
```

Bookings made **before** this change have `evento_id = null` — `annulla_prenotazione` (below) falls back to matching `eventi.titolo = prenotazioni.evento_titolo` for those rows.

### 2. New RPC: `annulla_prenotazione(p_prenotazione_id bigint) returns boolean`

Security-definer function, mirroring `prenota_posto`'s pattern: does its own authoritative lookup rather than trusting a client-supplied event id, so a stale/mismatched id can't free the wrong event's seat.

```sql
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
    return false; -- non trovata, o già annullata in precedenza
  end if;

  if v_evento_id is not null then
    update eventi set posti_disponibili = posti_disponibili + 1 where id = v_evento_id;
  end if;

  return true;
end;
$$;

grant execute on function annulla_prenotazione to authenticated;
```

Note this is **not** granted to `anon` — only a logged-in session can call it.

### 3. RLS additions for the `authenticated` role

`prenotazioni` currently allows `anon` to `insert` only (from the 2026-07-14 lockdown). This adds, for `authenticated` only:

```sql
drop policy if exists "prenotazioni_select_autenticato" on prenotazioni;
create policy "prenotazioni_select_autenticato"
  on prenotazioni for select
  to authenticated
  using (true);

drop policy if exists "prenotazioni_update_autenticato" on prenotazioni;
create policy "prenotazioni_update_autenticato"
  on prenotazioni for update
  to authenticated
  using (true)
  with check (true);

-- Anche con la policy sopra, limita QUALI colonne un utente autenticato può
-- scrivere: solo pagato/cancellata, mai i dati fiscali del cliente.
revoke update on prenotazioni from authenticated;
grant update (pagato, cancellata) on prenotazioni to authenticated;
```

`eventi`'s existing `eventi_select_pubblico` policy (from `rls_lockdown.sql`) is scoped `to anon` only — in Postgres/Supabase, `anon` and `authenticated` are distinct roles, so that policy does **not** cover a logged-in session. This adds a second, additive `select` policy for `authenticated`, without touching the existing one:

```sql
drop policy if exists "eventi_select_autenticato" on eventi;
create policy "eventi_select_autenticato"
  on eventi for select
  to authenticated
  using (true);
```

Writes to `eventi` still go only through `annulla_prenotazione` (`security definer`, bypasses RLS for its own internal update) — no direct `update` grant for `authenticated` on `eventi`.

### 4. A new, separate service: `src/app/core/services/admin.service.ts`

Not added to the existing `SupabaseService` — that service's client is deliberately configured with `persistSession: false` because it must run safely during SSR/prerendering (see its existing comment), and every other page on the site is statically prerendered. The admin page is the one route that (a) needs a real, persisted login session and (b) is explicitly excluded from prerendering (below) — so it gets its **own** lazily-created Supabase client with `persistSession: true, autoRefreshToken: true, detectSessionInUrl: false`, isolated from the public client and never instantiated during SSR.

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
(lives in `src/app/core/models/prenotazione.model.ts`, matching the existing `event.model.ts` convention)

`AdminService` methods:
- `signIn(email: string, password: string): Promise<{ error: unknown }>`
- `signOut(): Promise<void>`
- `getSession(): Promise<boolean>` — resolves whether a persisted session already exists (called once on page load so a returning, already-logged-in Silvia doesn't see the login form again)
- `getBookings(): Promise<Prenotazione[]>` — `select * from prenotazioni order by created_at desc` (requires the `authenticated` session; if not logged in, Supabase/RLS returns an empty result, which the component treats the same as "not authenticated yet")
- `setPaid(id: number, pagato: boolean): Promise<{ error: unknown }>`
- `cancelBooking(id: number): Promise<{ success: boolean; error: unknown }>` — calls the `annulla_prenotazione` RPC

For the "posti disponibili" figure shown per event group, the component reuses the **existing public** `SupabaseService.getEventSeats()` (already works for any caller since `eventi` select is public) rather than duplicating that read in the new service.

### 5. Route, and exclusion from static prerendering

`app.routes.ts` gains one lazy route, same pattern as the other four:

```ts
{
  path: 'gestione-prenotazioni',
  loadComponent: () => import('./features/gestione/gestione').then((m) => m.Gestione),
  title: 'Blooming Wild ART — Gestione',
},
```

Not added to `Navbar`'s or `BottomNav`'s `NAV_ITEMS` — reachable only by typing the URL.

`app.routes.server.ts` must render this one route client-side only (it depends on browser-only auth state that doesn't exist at build time), added **before** the existing catch-all so it takes precedence:

```ts
export const serverRoutes: ServerRoute[] = [
  { path: 'gestione-prenotazioni', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
```

### 6. The `Gestione` component

**States**, driven by signals (same idiom used throughout `Eventi`):
- `checkingSession = signal(true)` — true only during the initial `getSession()` check right after load, to avoid flashing the login form for an instant before a persisted session is confirmed.
- `authenticated = signal(false)`
- `bookings = signal<Prenotazione[]>([])`, `seats = signal<Record<number, number>>({})`
- `showCancelled = signal(false)` — one global toggle for the whole page (not per event group), per the approved design.
- `confirmingCancelId = signal<number | null>(null)` — which single booking row (if any) is in its "click again to confirm" armed state. Clicking "Annulla prenotazione" the first time on a row sets this to that row's id (re-rendering its button as "Conferma annullamento?"); clicking that confirm button calls `cancelBooking` and clears it back to `null`; clicking a *different* row's "Annulla" simply re-points this signal at the new id (only one row can be armed at a time, no timeout needed — YAGNI).

**Grouping** (computed signal): bookings are grouped by `evento_titolo` (not `evento_id`, so legacy rows with a null id still group correctly), each group carrying the event's current `posti_disponibili` (looked up from the `seats` map by matching the group's bookings' `evento_id` when present — falling back to "—" if unknown for a fully legacy group), and its list of bookings filtered to exclude `cancellata` ones unless `showCancelled()` is true.

**Login form**: two fields (email, password), a reactive form matching the `Eventi` form's conventions (`FormBuilder`, `Validators.required`/`Validators.email`), a submit button, and an error message area reusing the same red-text convention (`text-red-500 text-xs font-semibold text-center`) already used in `Eventi`.

**Booking row**: name, email, a small badge for privato/business (based on whether `codice_fiscale` or `ragione_sociale` is set — same logic already used implicitly by the booking form itself), the booking date (`created_at`, formatted `DD/MM/YYYY`), a "Pagato"/"Non pagato" toggle button (two visual states, `bg-action`/`text-white` when paid vs. a neutral outline when not — reusing the site's existing moss-for-action, plum-for-state color convention), and the two-click cancel button described above.

**Copy** (Italian, literal — not a placeholder):
- Login heading: "Accedi"
- Login error (wrong credentials): "Email o password non corretti."
- Empty state (no bookings at all yet): "Nessuna prenotazione ancora."
- Toggle label: "Mostra annullate"
- Cancel button, armed state: "Conferma annullamento?"
- Cancel button, resting state: "Annulla prenotazione"
- Logout button: "Esci"

### Accessibility & error handling

- The login form's error message uses the same `role`-free, visually-red pattern already used elsewhere in this codebase (no new pattern introduced).
- `setPaid`/`cancelBooking` failures (network errors, RLS denials) surface as a small inline error message per action — reusing the existing red-text convention — rather than a global toast (no toast system exists in this codebase; not introducing one for two isolated actions).
- No optimistic UI updates: after a successful `setPaid`/`cancelBooking` call, the component re-fetches (or locally patches, then re-fetches on next load) — kept simple, this is a low-traffic admin page used by one person, not a place that needs sophisticated optimistic-update handling.

## Files touched

- `supabase/admin_gestione.sql` — new (schema + RLS + RPC; run manually in the Supabase SQL editor, same as the two existing `supabase/*.sql` files).
- `src/app/core/models/prenotazione.model.ts` — new.
- `src/app/core/services/admin.service.ts` — new.
- `src/app/features/gestione/gestione.ts` + `gestione.html` — new.
- `src/app/app.routes.ts` — one new route entry.
- `src/app/app.routes.server.ts` — one new entry (client-only render mode for the new path), added before the existing wildcard.

No changes to `Navbar`, `BottomNav`, `Footer`, `SupabaseService`, `ContentService`, or any existing page.
