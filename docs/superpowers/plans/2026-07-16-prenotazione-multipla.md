# Prenotazione Multipla Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a single booking submission on `/eventi` reserve N seats (a headcount, no per-attendee names) under one billing entity, with the seat count and cancellation-restore logic scaling correctly with N instead of always assuming 1.

**Architecture:** A DB migration (new `numero_posti` column, `prenota_posto` gains a parameter and a signature change requiring an explicit drop-then-recreate, `annulla_prenotazione` restores N seats instead of a hardcoded 1) followed by one client-side task threading the new field through the booking form, the Supabase service layer, and the admin page's display.

**Tech Stack:** Angular 20 (standalone components, Reactive Forms, signals), Supabase (Postgres RLS + RPC), Tailwind CSS v4.

## Global Constraints

- No per-attendee names/emails — one booking = one billing entity + a headcount (`numero_posti`), per the approved spec.
- No artificial cap on group size beyond the event's real remaining seats.
- `annulla_prenotazione` still has no un-cancel path (unchanged, prior decision).
- Only the files listed in each task change. `AdminService`, the login flow, the privacy notice, and routing are untouched.
- Verification method: SQL changes are applied by the human running them in the Supabase SQL editor (I cannot run DDL through the public anon-key REST API) — verify afterward with safe, non-destructive `curl` calls (never touching real customer data or a real event's live seat count in a way that isn't immediately reversed or was already a no-op). App-layer changes are verified with `npx ng build` plus a real browser check with the actual Supabase RPC call intercepted (so no real production booking is ever created by the automated check) — this project has no unit/component test suite.

---

### Task 1: Database migration — `numero_posti`, updated `prenota_posto`/`annulla_prenotazione`

**Files:**
- Create: `supabase/prenotazione_multipla.sql`

**Interfaces:**
- Consumes: the existing `prenotazioni`/`eventi` tables and the existing `prenota_posto`/`annulla_prenotazione` functions (both already live, from `supabase/prenota_posto.sql` and `supabase/admin_gestione.sql`).
- Produces: `prenotazioni.numero_posti` (integer, not null, default 1, `check (numero_posti > 0)`); `prenota_posto` with a new signature `(p_evento_id bigint, p_numero_posti integer, p_evento_titolo text, p_nome_completo text, p_email text, p_codice_fiscale text, p_ragione_sociale text, p_partita_iva text, p_sdi text, p_indirizzo text, p_cap text, p_citta text) returns boolean`; `annulla_prenotazione(p_prenotazione_id bigint) returns boolean` (signature unchanged, body now restores N seats). Task 2 calls the RPC with these exact parameter names.

- [ ] **Step 1: Write the migration file**

Create `supabase/prenotazione_multipla.sql` with this exact content:

```sql
-- Prenotazione per più persone: un'unica prenotazione può riservare N posti
-- sotto un solo nominativo/fatturazione (niente nomi per singolo partecipante).
-- Vedi docs/superpowers/specs/2026-07-16-prenotazione-multipla-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

alter table prenotazioni add column if not exists numero_posti integer not null default 1;

alter table prenotazioni drop constraint if exists prenotazioni_numero_posti_positivo;
alter table prenotazioni add constraint prenotazioni_numero_posti_positivo check (numero_posti > 0);

-- prenota_posto cambia firma (nuovo parametro p_numero_posti): "create or replace"
-- non basta quando cambia il numero di parametri — va prima eliminata la vecchia
-- versione, altrimenti Postgres crea una seconda funzione con lo stesso nome
-- invece di sostituire quella esistente.
drop function if exists prenota_posto(bigint, text, text, text, text, text, text, text, text, text, text);

create or replace function prenota_posto(
  p_evento_id bigint,
  p_numero_posti integer,
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
     set posti_disponibili = posti_disponibili - p_numero_posti
   where id = p_evento_id
     and posti_disponibili >= p_numero_posti;

  get diagnostics righe_aggiornate = row_count;
  if righe_aggiornate = 0 then
    return false;
  end if;

  insert into prenotazioni (
    evento_id, numero_posti, evento_titolo, nome_completo, email, codice_fiscale,
    ragione_sociale, partita_iva, sdi, indirizzo, cap, citta
  ) values (
    p_evento_id, p_numero_posti, p_evento_titolo, p_nome_completo, p_email, p_codice_fiscale,
    p_ragione_sociale, p_partita_iva, p_sdi, p_indirizzo, p_cap, p_citta
  );

  return true;
end;
$$;

grant execute on function prenota_posto to anon;

-- annulla_prenotazione: ora ripristina numero_posti posti (non sempre 1).
-- La firma non cambia (ancora un solo parametro bigint), quindi "create or
-- replace" basta da solo e mantiene intatti i grant già impostati in precedenza
-- (revoke da public/anon, grant solo ad authenticated) — non vanno ripetuti qui.
create or replace function annulla_prenotazione(p_prenotazione_id bigint)
returns boolean
language plpgsql
security definer
as $$
declare
  v_evento_id bigint;
  v_numero_posti integer;
  v_righe integer;
begin
  select evento_id, numero_posti into v_evento_id, v_numero_posti from prenotazioni where id = p_prenotazione_id;

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
    update eventi set posti_disponibili = posti_disponibili + v_numero_posti where id = v_evento_id;
  end if;

  return true;
end;
$$;
```

- [ ] **Step 2: Ask the human to run the migration**

Tell the human: "Please run `supabase/prenotazione_multipla.sql` in the Supabase SQL editor (same process as the previous migrations). Let me know when it's done." Wait for their confirmation before continuing.

- [ ] **Step 3: Verify the migration is live, without touching real data**

Run these `curl` checks (the anon key below is the current public key from `src/environments/environment.ts` — it's shipped in every page load, not a secret; if it no longer matches that file when you run this, re-read the file and substitute the current value instead):

**Check A — new signature exists and rejects gracefully for a nonexistent event:**

```bash
curl -s "https://exykuzvxhphfokulfgcw.supabase.co/rest/v1/rpc/prenota_posto" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -d '{"p_evento_id":999999,"p_numero_posti":2,"p_evento_titolo":"test-non-reale","p_nome_completo":"test","p_email":"test@test.it","p_codice_fiscale":null,"p_ragione_sociale":null,"p_partita_iva":null,"p_sdi":null,"p_indirizzo":"test","p_cap":"00000","p_citta":"test"}' \
  -w "\nHTTP_STATUS:%{http_code}\n"
```

Expected: `HTTP_STATUS:200`, body `false` (the event doesn't exist, so the `posti_disponibili >= p_numero_posti` update matches 0 rows). This confirms the new 12-parameter signature is live and callable by `anon`.

**Check B — insufficient-seats boundary against a REAL event, with zero risk (an absurd request can never succeed, so it can never modify data):** first read a real event's current seat count:

```bash
curl -s "https://exykuzvxhphfokulfgcw.supabase.co/rest/v1/eventi?select=id,titolo,posti_disponibili" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA"
```

Pick any real `id` from the response, then:

```bash
curl -s "https://exykuzvxhphfokulfgcw.supabase.co/rest/v1/rpc/prenota_posto" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -d '{"p_evento_id":<REAL_ID>,"p_numero_posti":999999,"p_evento_titolo":"test-non-reale","p_nome_completo":"test","p_email":"test@test.it","p_codice_fiscale":null,"p_ragione_sociale":null,"p_partita_iva":null,"p_sdi":null,"p_indirizzo":"test","p_cap":"00000","p_citta":"test"}' \
  -w "\nHTTP_STATUS:%{http_code}\n"
```

Expected: `HTTP_STATUS:200`, body `false` (no real event has 999999 free seats, so the condition fails and nothing is written — re-run the first `eventi` read afterward and confirm that real event's `posti_disponibili` is unchanged, as a double-check).

**Check C — `annulla_prenotazione` still authenticated-only (signature unchanged, should be unaffected by this migration):**

```bash
curl -s "https://exykuzvxhphfokulfgcw.supabase.co/rest/v1/rpc/annulla_prenotazione" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eWt1enZ4aHBoZm9rdWxmZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDY3NDUsImV4cCI6MjA5NjgyMjc0NX0.72_XLLaOHn404J3BPlD-oVacV7EGNDct6wTbAeKZNDA" \
  -d '{"p_prenotazione_id":999999}' \
  -w "\nHTTP_STATUS:%{http_code}\n"
```

Expected: `HTTP_STATUS:401`, body containing `"message":"permission denied for function annulla_prenotazione"` — confirms this migration didn't accidentally reopen anon access to it.

- [ ] **Step 4: Commit**

```bash
git add supabase/prenotazione_multipla.sql
git commit -m "$(cat <<'EOF'
feat(db): support multi-person bookings (numero_posti)

prenotazioni gains numero_posti (default 1, check > 0). prenota_posto
takes a new p_numero_posti parameter and reserves/checks that many
seats atomically (signature change required dropping the old
11-parameter version first). annulla_prenotazione now restores
numero_posti seats on cancellation instead of always 1.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Booking form, service layer, and admin display

**Files:**
- Modify: `src/app/core/services/supabase.service.ts`
- Modify: `src/app/core/models/prenotazione.model.ts`
- Modify: `src/app/features/eventi/eventi.ts`
- Modify: `src/app/features/eventi/eventi.html`
- Modify: `src/app/features/gestione/gestione.html`

**Interfaces:**
- Consumes: Task 1's live `prenota_posto` (new `p_numero_posti` parameter) and `annulla_prenotazione` (unchanged signature, new restore behavior) and the new `prenotazioni.numero_posti` column.
- Produces: nothing consumed by a later task — this is the final layer.

- [ ] **Step 1: Add `numero_posti` to `BookingSubmission` and thread it through `prenotaPosto()`**

In `src/app/core/services/supabase.service.ts`, change:

```ts
export interface BookingSubmission {
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
}
```

to:

```ts
export interface BookingSubmission {
  evento_titolo: string;
  nome_completo: string;
  email: string;
  numero_posti: number;
  codice_fiscale: string | null;
  ragione_sociale: string | null;
  partita_iva: string | null;
  sdi: string | null;
  indirizzo: string;
  cap: string;
  citta: string;
}
```

Then change:

```ts
  async prenotaPosto(eventId: number, payload: BookingSubmission): Promise<{ success: boolean; error: unknown }> {
    const client = await this.getClient();
    const { data, error } = await client.rpc('prenota_posto', {
      p_evento_id: eventId,
      p_evento_titolo: payload.evento_titolo,
      p_nome_completo: payload.nome_completo,
      p_email: payload.email,
      p_codice_fiscale: payload.codice_fiscale,
      p_ragione_sociale: payload.ragione_sociale,
      p_partita_iva: payload.partita_iva,
      p_sdi: payload.sdi,
      p_indirizzo: payload.indirizzo,
      p_cap: payload.cap,
      p_citta: payload.citta,
    });
    this.seatsCache = null; // i posti sono cambiati (prenotato o appena esaurito): rifai la query
    return { success: data === true, error };
  }
```

to:

```ts
  async prenotaPosto(eventId: number, payload: BookingSubmission): Promise<{ success: boolean; error: unknown }> {
    const client = await this.getClient();
    const { data, error } = await client.rpc('prenota_posto', {
      p_evento_id: eventId,
      p_numero_posti: payload.numero_posti,
      p_evento_titolo: payload.evento_titolo,
      p_nome_completo: payload.nome_completo,
      p_email: payload.email,
      p_codice_fiscale: payload.codice_fiscale,
      p_ragione_sociale: payload.ragione_sociale,
      p_partita_iva: payload.partita_iva,
      p_sdi: payload.sdi,
      p_indirizzo: payload.indirizzo,
      p_cap: payload.cap,
      p_citta: payload.citta,
    });
    this.seatsCache = null; // i posti sono cambiati (prenotato o appena esaurito): rifai la query
    return { success: data === true, error };
  }
```

- [ ] **Step 2: Add `numero_posti` to the `Prenotazione` model**

In `src/app/core/models/prenotazione.model.ts`, change:

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

to:

```ts
export interface Prenotazione {
  id: number;
  evento_id: number | null;
  evento_titolo: string;
  nome_completo: string;
  email: string;
  numero_posti: number;
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

- [ ] **Step 3: Confirm the current `eventi.ts` matches this snapshot before editing**

Read `src/app/features/eventi/eventi.ts` and confirm the form group and `step1Complete`/`onSubmit` still read exactly as shown in Steps 4-5 below (the "old" code blocks). If it's drifted, stop and reconcile before continuing.

- [ ] **Step 4: Add the `numeroPosti` form control and include it in `step1Complete`**

In `src/app/features/eventi/eventi.ts`, change:

```ts
  protected readonly form = this.fb.nonNullable.group({
    eventId: this.fb.control<number | null>(null, Validators.required),
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    billingType: this.fb.control<'privato' | 'business'>('privato', Validators.required),
    cf: [''],
    companyName: [''],
    companyPiva: [''],
    companySdi: [''],
    address: ['', Validators.required],
    cap: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
    city: ['', Validators.required],
    privacyAccepted: [false, Validators.requiredTrue],
  });
```

to:

```ts
  protected readonly form = this.fb.nonNullable.group({
    eventId: this.fb.control<number | null>(null, Validators.required),
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    numeroPosti: this.fb.control(1, [Validators.required, Validators.min(1)]),
    billingType: this.fb.control<'privato' | 'business'>('privato', Validators.required),
    cf: [''],
    companyName: [''],
    companyPiva: [''],
    companySdi: [''],
    address: ['', Validators.required],
    cap: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
    city: ['', Validators.required],
    privacyAccepted: [false, Validators.requiredTrue],
  });
```

Then change:

```ts
  protected readonly step1Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    return c.eventId.valid && c.name.valid && c.email.valid;
  });
```

to:

```ts
  protected readonly step1Complete = computed(() => {
    this.formStatus();
    const c = this.form.controls;
    return c.eventId.valid && c.name.valid && c.email.valid && c.numeroPosti.valid;
  });
```

(`numeroPosti` was placed in the "1. Dati Partecipante" group in the template — Step 6 below — so `step1Complete`'s progress indicator must include it, otherwise the UI would show step 1 as complete while an invalid participant count is still blocking submission.)

- [ ] **Step 5: Update `onSubmit()` to reserve/report on N seats**

In `src/app/features/eventi/eventi.ts`, change:

```ts
    const eventId = this.form.controls.eventId.value!;
    const currentSeats = this.seats()[eventId] ?? DEFAULT_SEATS;
    const matchingEvent = this.events.find((ev) => ev.id === eventId);

    if (currentSeats <= 0) {
      this.errorMessage.set('Ops! I posti per questo evento si sono esauriti un istante fa.');
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();
    const isPrivato = v.billingType === 'privato';

    const payload: BookingSubmission = {
      evento_titolo: matchingEvent?.title ?? 'Evento sconosciuto',
      nome_completo: v.name,
      email: v.email,
      codice_fiscale: isPrivato ? v.cf || null : null,
      ragione_sociale: isPrivato ? null : v.companyName || null,
      partita_iva: isPrivato ? null : v.companyPiva || null,
      sdi: isPrivato ? null : v.companySdi || null,
      indirizzo: v.address,
      cap: v.cap,
      citta: v.city,
    };

    const { success, error } = await this.supabase.prenotaPosto(eventId, payload);
    if (error) {
      console.error(error);
      this.errorMessage.set('Si è verificato un problema con la registrazione. Riprova.');
      this.submitting.set(false);
      return;
    }
    if (!success) {
      this.errorMessage.set('Ops! I posti per questo evento si sono esauriti un istante fa.');
      this.submitting.set(false);
      this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
      return;
    }

    this.seats.update((s) => ({ ...s, [eventId]: currentSeats - 1 }));
    this.submitting.set(false);
    this.bookingSuccess.set(true);
    this.form.reset({ billingType: 'privato' });
```

to:

```ts
    const eventId = this.form.controls.eventId.value!;
    const currentSeats = this.seats()[eventId] ?? DEFAULT_SEATS;
    const matchingEvent = this.events.find((ev) => ev.id === eventId);
    const numeroPosti = Math.round(this.form.controls.numeroPosti.value);

    if (currentSeats < numeroPosti) {
      const postiParola = currentSeats === 1 ? 'posto disponibile' : 'posti disponibili';
      this.errorMessage.set(
        `Solo ${currentSeats} ${postiParola} per questo evento: riduci il numero di partecipanti o scegli un'altra data.`,
      );
      return;
    }

    this.submitting.set(true);
    const v = this.form.getRawValue();
    const isPrivato = v.billingType === 'privato';

    const payload: BookingSubmission = {
      evento_titolo: matchingEvent?.title ?? 'Evento sconosciuto',
      nome_completo: v.name,
      email: v.email,
      numero_posti: numeroPosti,
      codice_fiscale: isPrivato ? v.cf || null : null,
      ragione_sociale: isPrivato ? null : v.companyName || null,
      partita_iva: isPrivato ? null : v.companyPiva || null,
      sdi: isPrivato ? null : v.companySdi || null,
      indirizzo: v.address,
      cap: v.cap,
      citta: v.city,
    };

    const { success, error } = await this.supabase.prenotaPosto(eventId, payload);
    if (error) {
      console.error(error);
      this.errorMessage.set('Si è verificato un problema con la registrazione. Riprova.');
      this.submitting.set(false);
      return;
    }
    if (!success) {
      this.errorMessage.set('Ops! I posti per questo evento si sono esauriti un istante fa.');
      this.submitting.set(false);
      this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
      return;
    }

    this.seats.update((s) => ({ ...s, [eventId]: currentSeats - numeroPosti }));
    this.submitting.set(false);
    this.bookingSuccess.set(true);
    this.form.reset({ billingType: 'privato', numeroPosti: 1 });
```

- [ ] **Step 6: Add the "Numero di Partecipanti" field to the template**

In `src/app/features/eventi/eventi.html`, find:

```html
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="user-name" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Nome e Cognome *</label>
            <input type="text" id="user-name" formControlName="name" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Emanuela Viola">
          </div>
          <div>
            <label for="user-email" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Email *</label>
            <input type="email" id="user-email" formControlName="email" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="esempio@email.com">
          </div>
        </div>

        <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2 pt-4">2. Fatturazione</p>
```

and change it to:

```html
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="user-name" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Nome e Cognome *</label>
            <input type="text" id="user-name" formControlName="name" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="Emanuela Viola">
          </div>
          <div>
            <label for="user-email" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Email *</label>
            <input type="email" id="user-email" formControlName="email" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800" placeholder="esempio@email.com">
          </div>
        </div>

        <div>
          <label for="user-numero-posti" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Numero di Partecipanti *</label>
          <input type="number" id="user-numero-posti" formControlName="numeroPosti" min="1" step="1" class="w-full p-3 border border-gray-200 rounded focus:border-brand focus:outline-none font-medium text-gray-800">
          @if (selectedEvent(); as ev) {
            <p class="text-xs text-gray-600 mt-2">Posti disponibili per questo evento: {{ ev.seatsAvailable }}</p>
          }
        </div>

        <p class="text-gray-900 font-title italic text-xl border-b border-gray-200 pb-2 pt-4">2. Fatturazione</p>
```

- [ ] **Step 7: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.`.

- [ ] **Step 8: Add the headcount badge to the admin page**

In `src/app/features/gestione/gestione.html`, find:

```html
              <div>
                <p class="font-medium text-gray-900">
                  {{ b.nome_completo }}
                  <span class="text-xs text-gray-600 font-normal">({{ b.codice_fiscale ? 'privato' : 'azienda' }})</span>
                </p>
                <p class="text-xs text-gray-600">{{ b.email }} — {{ b.created_at | date: 'dd/MM/yyyy' }}</p>
              </div>
```

and change it to:

```html
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
```

- [ ] **Step 9: Build and confirm it compiles**

Run: `npx ng build`
Expected: ends with `Application bundle generation complete` and `Prerendered 4 static routes.`.

- [ ] **Step 10: Verify in a browser — safe, no real production write**

I do not have Silvia's real Supabase Auth credentials, so the `gestione.html` badge itself can't be exercised against real logged-in data in this step (that's deferred to the human, same as prior gestione tasks). But the booking form's new field and its interaction with `prenota_posto` CAN be verified safely by intercepting the network call, following the same pattern already used successfully for the privacy-notice task in this project's history:

Use the `run` skill (or `npm start` + Playwright) to load `/eventi`, then:
1. Before interacting, install a route intercept for `**/rest/v1/rpc/prenota_posto` that inspects the outgoing POST body and fulfills with `{ status: 200, contentType: 'application/json', body: 'true' }` — this proves what the client actually sends without ever writing to the real database.
2. Click "Prenotati" on any non-sold-out event, fill in the form with throwaway data, set "Numero di Partecipanti" to `3`, check the privacy checkbox, and submit.
3. Inspect the intercepted request body and confirm it contains `"p_numero_posti":3` (or `3` as a number, not a string) alongside the other expected fields.
4. Confirm the UI shows the success state ("Iscrizione salvata!...") after the intercepted `true` response, and that no real network request reached the actual Supabase project (only your intercepted route handled it).
5. Reload the page fresh, open the form again, this time set "Numero di Partecipanti" to something clearly larger than the displayed "Posti disponibili" count for that event (e.g. if it shows 3, enter 50), leave the intercept in place but check the error path instead: submit and confirm the client-side pre-flight check fires (`currentSeats < numeroPosti`) — the error message should read "Solo 3 posti disponibili per questo evento: riduci il numero di partecipanti o scegli un'altra data." (adjust the number to whatever the real displayed count is) and confirm via your route intercept's call log that `prenota_posto` was never actually called in this case (the pre-flight check returns before reaching the network call).

- [ ] **Step 11: Commit**

```bash
git add src/app/core/services/supabase.service.ts src/app/core/models/prenotazione.model.ts src/app/features/eventi/eventi.ts src/app/features/eventi/eventi.html src/app/features/gestione/gestione.html
git commit -m "$(cat <<'EOF'
feat(eventi): support booking for multiple people in one submission

Adds a "Numero di Partecipanti" field (min 1, no upper cap beyond real
availability) to the booking form. Threads numero_posti through
BookingSubmission/prenotaPosto to the updated prenota_posto RPC, and
shows a headcount badge on group bookings in the gestione-prenotazioni
admin list.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review notes

- **Spec coverage:** schema + constraint (✓ Task 1 Step 1), `prenota_posto` signature change with explicit drop-then-recreate to handle the parameter-count change correctly (✓ Task 1 Step 1 — this was an implicit requirement the spec didn't spell out but is necessary for correctness, added here), `annulla_prenotazione` restoring N seats (✓ Task 1 Step 1), `BookingSubmission`/`Prenotazione` field additions (✓ Task 2 Steps 1-2), form field + validators + no upper cap (✓ Task 2 Step 4/6), `step1Complete` including the new control (✓ Task 2 Step 4 — another implicit requirement following directly from placing the field in step 1, added here), pre-flight insufficient-seats message with correct Italian singular/plural (✓ Task 2 Step 5, verbatim from the spec's Ambiguity Resolution), optimistic seat update and form-reset default (✓ Task 2 Step 5), admin badge only shown when `numero_posti > 1` (✓ Task 2 Step 8).
- **No placeholders:** every step has literal code or exact commands; the two implicit-but-necessary additions above (drop-before-recreate, `step1Complete`) are filled in with real code, not flagged as follow-up work.
- **Type/interface consistency:** `numero_posti` (snake_case, matching every other DB-facing field in `BookingSubmission`/`Prenotazione`) vs. `numeroPosti` (camelCase, matching every other Angular form-control name in this file) are used consistently in their respective layers throughout — the boundary conversion happens once, in `onSubmit()`'s payload construction (`numero_posti: numeroPosti`), matching how `nome_completo: v.name` etc. already convert naming conventions at that exact boundary.
