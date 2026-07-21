# Riduzione posti prenotazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Silvia può ridurre, dal pannello Gestione, il numero di posti di una
prenotazione multipla attiva (es. "erano in 4, ora vengono in 3") senza dover
annullare l'intera prenotazione, con i posti liberati che tornano disponibili
per l'evento.

**Architecture:** Nuova funzione RPC atomica `riduci_posti_prenotazione` (stesso
pattern di `annulla_prenotazione`: aggiorna `prenotazioni.numero_posti` e
`eventi.posti_disponibili` nella stessa transazione). Nuovo metodo
`AdminService.riduciPostiPrenotazione`. Nuovo bottone "Modifica posti" nella
scheda Prenotazioni di `gestione.ts`/`.html`, con un campo numerico inline che
appare solo per la riga in modifica.

**Tech Stack:** Angular 20 standalone components/signals, Supabase (Postgres
RPC), Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-07-20-riduzione-posti-prenotazione-design.md`

## Global Constraints

- Solo Silvia usa questa funzione, dal pannello Gestione — nessun self-service
  per il cliente. Nessuna email viene inviata quando i posti vengono ridotti
  (a differenza della prenotazione originale).
- Il nuovo numero di posti deve essere un intero tra 1 e (numero attuale − 1)
  incluso — mai 0 (per azzerare si usa l'azione "Annulla prenotazione" già
  esistente, non questa) e mai ≥ al numero attuale.
- Il bottone "Modifica posti" compare solo per prenotazioni con
  `!b.cancellata && b.numero_posti > 1`.
- La funzione RPC deve avere esattamente gli stessi permessi di
  `annulla_prenotazione`: nessun accesso per `anon`/`public`, solo per
  `authenticated`.
- Non toccare `prenota_posto`, `annulla_prenotazione`, o qualunque altra parte
  della scheda Eventi/Portfolio di `gestione.ts`/`.html` — solo la scheda
  Prenotazioni.
- No nuovi file `*.spec.ts` (convenzione del progetto: zero test automatici).
  Ogni task si verifica con `npm run build` e, dove indicato, un controllo
  manuale.
- Il file SQL (Task 1) va eseguito manualmente dall'utente nel SQL Editor di
  Supabase — nessun subagent può farlo. Dopo che la review del Task 1 è
  pulita, il controller deve fermarsi e chiedere all'utente di eseguire
  `supabase/riduzione_posti_prenotazione.sql` prima che la feature sia
  testabile end-to-end in un browser reale (i Task 2-3 restano comunque
  buildabili/revisionabili senza che la migrazione sia già stata eseguita).

---

### Task 1: Migrazione SQL — funzione RPC `riduci_posti_prenotazione`

**Files:**
- Create: `supabase/riduzione_posti_prenotazione.sql`

**Interfaces:**
- Produces: funzione Postgres `riduci_posti_prenotazione(p_prenotazione_id
  bigint, p_nuovo_numero_posti integer) returns boolean`, eseguibile solo da
  `authenticated`. Il Task 2 (`AdminService`) chiama questa funzione via
  `client.rpc(...)`.

- [ ] **Step 1: Scrivi il file di migrazione**

Crea `supabase/riduzione_posti_prenotazione.sql` con questo contenuto esatto:

```sql
-- Riduzione parziale di una prenotazione multipla: permette di diminuire il
-- numero di posti di una prenotazione attiva (es. il gruppo era in 4 e ora
-- vengono in 3) senza annullarla del tutto, restituendo i posti liberati
-- all'evento. Vedi docs/superpowers/specs/2026-07-20-riduzione-posti-prenotazione-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

create or replace function riduci_posti_prenotazione(
  p_prenotazione_id bigint,
  p_nuovo_numero_posti integer
) returns boolean
language plpgsql
security definer
as $$
declare
  v_evento_id bigint;
  v_numero_posti_attuale integer;
  v_righe integer;
begin
  if p_nuovo_numero_posti < 1 then
    return false;
  end if;

  select evento_id, numero_posti into v_evento_id, v_numero_posti_attuale
    from prenotazioni
    where id = p_prenotazione_id and cancellata = false;

  if v_evento_id is null or v_numero_posti_attuale is null
     or p_nuovo_numero_posti >= v_numero_posti_attuale then
    return false;
  end if;

  update prenotazioni set numero_posti = p_nuovo_numero_posti
    where id = p_prenotazione_id and cancellata = false;

  get diagnostics v_righe = row_count;
  if v_righe = 0 then
    return false;
  end if;

  update eventi
     set posti_disponibili = posti_disponibili + (v_numero_posti_attuale - p_nuovo_numero_posti)
   where id = v_evento_id;

  return true;
end;
$$;

revoke all on function riduci_posti_prenotazione(bigint, integer) from public;
grant execute on function riduci_posti_prenotazione(bigint, integer) to authenticated;
```

- [ ] **Step 2: Report status**

Non c'è modo di eseguire questo file dall'ambiente dell'implementatore (serve
il SQL Editor di Supabase, con le credenziali del progetto). Riporta DONE con
nota: "migrazione scritta, va eseguita manualmente dall'utente nel SQL Editor
di Supabase prima che la RPC esista davvero nel database."

- [ ] **Step 3: Commit**

```bash
git add supabase/riduzione_posti_prenotazione.sql
git commit -m "feat(prenotazioni): aggiunge la funzione RPC riduci_posti_prenotazione"
```

---

### Task 2: `AdminService.riduciPostiPrenotazione`

**Files:**
- Modify: `src/app/core/services/admin.service.ts`

**Interfaces:**
- Consumes: la funzione RPC `riduci_posti_prenotazione` del Task 1 (il metodo
  compila e viene revisionato indipendentemente dal fatto che la migrazione
  sia già stata eseguita in produzione).
- Produces: `riduciPostiPrenotazione(id: number, nuovoNumeroPosti: number):
  Promise<{ success: boolean; error: unknown }>`, usato dal Task 3.

- [ ] **Step 1: Aggiungi il metodo**

Aggiungi in `src/app/core/services/admin.service.ts`, subito dopo il metodo
esistente `cancelBooking` (stesso stile/mapping):

```ts
  async riduciPostiPrenotazione(id: number, nuovoNumeroPosti: number): Promise<{ success: boolean; error: unknown }> {
    const client = await this.getClient();
    const { data, error } = await client.rpc('riduci_posti_prenotazione', {
      p_prenotazione_id: id,
      p_nuovo_numero_posti: nuovoNumeroPosti,
    });
    return { success: data === true, error };
  }
```

- [ ] **Step 2: Verifica il build**

Run: `npm run build`
Expected: nessun errore (il metodo non è ancora usato da nessuna parte, ma deve
compilare).

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/admin.service.ts
git commit -m "feat(prenotazioni): aggiunge AdminService.riduciPostiPrenotazione"
```

---

### Task 3: UI "Modifica posti" nella scheda Prenotazioni

**Files:**
- Modify: `src/app/features/gestione/gestione.ts`
- Modify: `src/app/features/gestione/gestione.html`

**Interfaces:**
- Consumes: `AdminService.riduciPostiPrenotazione` (Task 2).

- [ ] **Step 1: Aggiungi stato e metodi in `gestione.ts`**

Aggiungi questa proprietà subito dopo la riga esistente
`protected readonly confirmingCancelId = signal<number | null>(null);`:

```ts
  protected readonly editingSeatsId = signal<number | null>(null);
  protected readonly newSeatsValue = signal(1);
```

Modifica il metodo esistente `armCancel` (aggiunge una riga per chiudere
l'eventuale editor posti aperto su un'altra riga, così non restano aperti due
editor contemporaneamente):

```ts
  armCancel(id: number): void {
    this.editingSeatsId.set(null);
    this.confirmingCancelId.set(id);
  }
```

Aggiungi questi tre metodi subito dopo il metodo esistente `confirmCancel`:

```ts
  armEditSeats(booking: Prenotazione): void {
    this.actionError.set(null);
    this.confirmingCancelId.set(null);
    this.editingSeatsId.set(booking.id);
    this.newSeatsValue.set(Math.max(1, booking.numero_posti - 1));
  }

  cancelEditSeats(): void {
    this.editingSeatsId.set(null);
  }

  async confirmEditSeats(booking: Prenotazione): Promise<void> {
    this.actionError.set(null);
    const nuovo = Math.round(this.newSeatsValue());
    if (!Number.isFinite(nuovo) || nuovo < 1 || nuovo >= booking.numero_posti) {
      this.actionError.set(`Inserisci un numero di posti valido, da 1 a ${booking.numero_posti - 1}.`);
      return;
    }
    try {
      const { success, error } = await this.admin.riduciPostiPrenotazione(booking.id, nuovo);
      if (error || !success) {
        this.actionError.set('Impossibile aggiornare il numero di posti. Riprova.');
        return;
      }
      this.bookings.update((list) => list.map((b) => (b.id === booking.id ? { ...b, numero_posti: nuovo } : b)));
      this.supabase.invalidateSeatsCache();
      this.supabase.getEventSeats().then((seatMap) => this.seats.set(seatMap));
    } catch {
      this.actionError.set('Impossibile aggiornare il numero di posti. Riprova.');
    } finally {
      this.editingSeatsId.set(null);
    }
  }
```

- [ ] **Step 2: Aggiungi il bottone e il campo di modifica in `gestione.html`**

Trova questo blocco (dentro il `@for (b of group.prenotazioni; track b.id)`):

```html
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
```

E sostituiscilo con:

```html
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
                  @if (!b.cancellata && b.numero_posti > 1 && editingSeatsId() !== b.id) {
                    <button type="button" (click)="armEditSeats(b)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">
                      Modifica posti
                    </button>
                  }
                </div>
              </div>

              @if (editingSeatsId() === b.id) {
                <div class="flex flex-wrap items-center gap-3 pb-3 -mt-1">
                  <label [attr.for]="'new-seats-' + b.id" class="text-xs font-bold text-gray-600 uppercase tracking-widest">
                    Nuovo numero posti (max {{ b.numero_posti - 1 }})
                  </label>
                  <input
                    type="number"
                    [id]="'new-seats-' + b.id"
                    [value]="newSeatsValue()"
                    (input)="newSeatsValue.set($any($event.target).valueAsNumber)"
                    min="1"
                    [max]="b.numero_posti - 1"
                    class="w-20 p-2 border border-gray-200 rounded focus:border-brand focus:outline-none text-sm text-gray-800"
                  />
                  <button type="button" (click)="confirmEditSeats(b)" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded bg-action text-white hover:bg-action-hover transition-colors">
                    Salva
                  </button>
                  <button type="button" (click)="cancelEditSeats()" class="text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded border border-gray-200 text-gray-600 hover:border-brand hover:text-brand transition-colors">
                    Annulla
                  </button>
                </div>
              }
            }
```

Nota: la chiusura `}` finale del blocco sostituito corrisponde al `@for` sulle
prenotazioni — non toccare nient'altro intorno a questo blocco (il `@for`
sui gruppi evento, l'header del gruppo con "N posti disponibili", ecc.
restano identici).

- [ ] **Step 3: Verifica il build**

Run: `npm run build`
Expected: nessun errore.

- [ ] **Step 4: Verifica manuale**

Richiede che la migrazione del Task 1 sia già stata eseguita in Supabase.
Login nel pannello Gestione, scheda Prenotazioni, su una prenotazione di prova
con più di 1 posto:
- clicca "Modifica posti" → compare il campo numerico precompilato a
  (numero attuale − 1);
- inserisci un valore valido e "Salva" → la riga si aggiorna, il conteggio
  "N posti disponibili" dell'evento nella stessa scheda aumenta della
  differenza;
- riprova con un valore uguale o superiore al numero attuale, o con 0 → deve
  comparire il messaggio d'errore senza chiudere il campo di modifica;
- verifica che aprire "Modifica posti" su una riga chiuda un eventuale
  "Annulla prenotazione" in stato di conferma su un'altra riga (e viceversa).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/gestione/gestione.ts src/app/features/gestione/gestione.html
git commit -m "feat(prenotazioni): bottone Modifica posti per ridurre parzialmente una prenotazione"
```
