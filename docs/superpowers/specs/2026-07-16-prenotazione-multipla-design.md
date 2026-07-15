# Prenotazione per più persone

## Context

Today one booking submission on `/eventi` always reserves exactly one seat for one billing entity. The user wants a single booker to be able to reserve seats for a group (e.g. themselves plus a friend) in one submission, under their own billing details — no per-attendee names, just a headcount. This touches the same atomic-booking/cancellation machinery already built for the site (`prenota_posto`, `annulla_prenotazione`, the `gestione-prenotazioni` admin page), so it must keep those paths consistent rather than bypass them.

## What stays the same (out of scope)

- No per-attendee names/emails — one booking = one billing entity + a headcount, exactly as approved in the brainstorm.
- No artificial cap on group size beyond the event's real remaining seats (the user explicitly chose "no cap" over a fixed maximum like 6).
- The privacy notice, the checkbox, the login-gated admin page's auth model, and the PayPal discussion remain untouched — this spec is scoped to the booking-quantity feature only.
- `annulla_prenotazione` still has no un-cancel path (unchanged, already a settled decision from the gestione-prenotazioni spec).

## Design

### 1. Schema: `prenotazioni.numero_posti`

New column, additive migration in a new file `supabase/prenotazione_multipla.sql`:

```sql
alter table prenotazioni add column if not exists numero_posti integer not null default 1;

alter table prenotazioni drop constraint if exists prenotazioni_numero_posti_positivo;
alter table prenotazioni add constraint prenotazioni_numero_posti_positivo check (numero_posti > 0);
```

`default 1` means every existing row (all single-seat bookings made before this change) is correctly interpreted as a 1-person booking with no backfill needed.

### 2. `prenota_posto`: reserve N seats atomically

`create or replace function prenota_posto(...)` gains one new parameter, `p_numero_posti integer`, inserted right after `p_evento_id` (parameter order matters for the existing positional-safe call the client already makes by named parameters, so this is safe either way, but keeping it next to `p_evento_id` groups the "how many/which event" concerns together). The seat-decrement condition changes from "at least 1 seat free" to "at least N seats free," and the decrement itself scales by N:

```sql
update eventi
   set posti_disponibili = posti_disponibili - p_numero_posti
 where id = p_evento_id
   and posti_disponibili >= p_numero_posti;
```

(unchanged: the `get diagnostics ... row_count` / `if righe_aggiornate = 0 then return false` guard — this now naturally means "either the event doesn't exist, or it doesn't have N seats free," which the client already treats as a single "not enough seats" error path, so no new return-value semantics are needed.)

The `insert into prenotazioni (...)` gains `numero_posti` alongside the existing columns, storing `p_numero_posti` on the row.

### 3. `annulla_prenotazione`: restore N seats, not always 1

The only change: the final `update eventi set posti_disponibili = posti_disponibili + 1` becomes `+ v_numero_posti`, where `v_numero_posti` is read from the `prenotazioni` row being cancelled (same `select ... into` style already used for `v_evento_id`):

```sql
select evento_id, numero_posti into v_evento_id, v_numero_posti from prenotazioni where id = p_prenotazione_id;
```

This makes cancelling a 3-person booking correctly free 3 seats, not 1.

### 4. Client: `BookingSubmission`, `prenotaPosto()`, `Prenotazione`

- `BookingSubmission` (in `supabase.service.ts`) gains `numero_posti: number`.
- `SupabaseService.prenotaPosto()`'s `client.rpc('prenota_posto', {...})` call gains `p_numero_posti: payload.numero_posti`.
- `Prenotazione` (in `prenotazione.model.ts`) gains `numero_posti: number`, so `gestione-prenotazioni` can display it (no other change needed there — `AdminService.getBookings()` already does `select('*')`, so the new column arrives automatically).

### 5. Booking form (`eventi.ts` / `eventi.html`)

New reactive form control, added to the existing "1. Dati Partecipante" group alongside `name`/`email`:

```ts
numeroPosti: this.fb.control(1, [Validators.required, Validators.min(1)]),
```

Rendered as a labeled number input ("Numero di Partecipanti *", `type="number" min="1" step="1"`) below the existing name/email grid, with a small helper line underneath showing the live seat count for whichever event is selected (reusing the already-existing `selectedEvent()` computed): "Posti disponibili per questo evento: {{ selectedEvent()?.seatsAvailable }}".

`onSubmit()` changes:
- The pre-flight sold-out check changes from `if (currentSeats <= 0)` to `if (currentSeats < numeroPosti)`, with the error message becoming specific (exact string in the Ambiguity resolution note below).
- The payload sent to `prenotaPosto()` includes `numero_posti: Math.round(v.numeroPosti)` — the `Math.round` is a defensive coercion so a stray non-integer value can never reach the database's integer column, even though the HTML `step="1"` already discourages it in normal use.
- The optimistic local seat-count update after success changes from `currentSeats - 1` to `currentSeats - numeroPosti`.
- `this.form.reset({ billingType: 'privato' })` needs `numeroPosti: 1` added to the reset object, so a new booking after a successful submission starts back at 1 rather than resetting to `null`/empty (matching the control's own initial value).

**Ambiguity resolution (Italian pluralization):** the insufficient-seats error message needs correct singular/plural agreement ("1 posto disponibile" vs. "2 posti disponibili"), via a single ternary — final, literal code to ship:

```ts
const postiParola = currentSeats === 1 ? 'posto disponibile' : 'posti disponibili';
this.errorMessage.set(
  `Solo ${currentSeats} ${postiParola} per questo evento: riduci il numero di partecipanti o scegli un'altra data.`,
);
```

### 6. Admin page display (`gestione.html`)

Each booking row's name line gains the headcount, shown only when it's not exactly 1 (a solo booking reads more naturally without a redundant "(1 persona)" tag):

```html
<p class="font-medium text-gray-900">
  {{ b.nome_completo }}
  <span class="text-xs text-gray-600 font-normal">({{ b.codice_fiscale ? 'privato' : 'azienda' }})</span>
  @if (b.numero_posti > 1) {
    <span class="text-xs text-brand font-semibold">— {{ b.numero_posti }} persone</span>
  }
</p>
```

No change needed to the "posti disponibili" per-event-group readout — it already reads the live `eventi.posti_disponibili` value directly, which now correctly reflects multi-seat bookings/cancellations thanks to sections 2–3 above.

## Files touched

- `supabase/prenotazione_multipla.sql` — new.
- `src/app/core/services/supabase.service.ts` — `BookingSubmission` interface, `prenotaPosto()`.
- `src/app/core/models/prenotazione.model.ts` — `Prenotazione` interface.
- `src/app/features/eventi/eventi.ts` — new form control, `onSubmit()` changes.
- `src/app/features/eventi/eventi.html` — new input + helper text.
- `src/app/features/gestione/gestione.html` — headcount badge on each booking row.

No changes to `AdminService`, the login flow, the privacy notice, or routing.
