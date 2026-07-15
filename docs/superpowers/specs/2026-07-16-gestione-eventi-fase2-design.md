# Gestione Eventi — Fase 2: pannello di amministrazione

**Contesto:** la Fase 1 ha spostato i dati dei workshop dal codice al database
`eventi` e ha ricablato le pagine pubbliche per leggerli da lì. Questa Fase 2
costruisce la UI che permette a Silvia di creare, modificare e nascondere eventi
da sola, con locandina, prezzo e numero di posti, riusando il login già esistente
di `/gestione-prenotazioni`.

## Sezione 1 — Permessi database e Storage

`eventi` oggi è scrivibile solo dalla funzione `prenota_posto` (per i posti) — un
utente autenticato non ha ancora permesso di inserire o modificare righe. Si
aggiungono due policy RLS, simmetriche a quelle già esistenti per `prenotazioni`:

```sql
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
```

Per la locandina, un bucket Storage pubblico in lettura (il sito pubblico deve
poter mostrare l'immagine) ma scrivibile solo da un utente autenticato:

```sql
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

Nessun vincolo lato database su dimensione/tipo file (accettato esplicitamente
dall'utente): la validazione type/size, se necessaria, resta solo lato client
(vedi Sezione 5).

## Sezione 2 — Modelli e metodi `AdminService`

**Nuovi modelli** in `src/app/core/models/event.model.ts`, accanto a `PaintEvent`/
`PaintEventWithSeats` già esistenti:

```ts
/** Vista admin di un evento: espone anche i campi gestionali che il pubblico
 *  non deve mai vedere (posti "grezzi" e stato di pubblicazione). */
export interface PaintEventAdmin extends PaintEvent {
  postiDisponibili: number;
  pubblicato: boolean;
}

/** Valori del form di creazione/modifica evento. `capienzaTotale` è il numero
 *  totale di posti pensati per l'evento (vedi Sezione 5 per come si traduce
 *  nel campo posti_disponibili effettivamente salvato). */
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

**Nuovi metodi** in `src/app/core/services/admin.service.ts` (stesso stile di
`getBookings`/`setPaid` già esistenti):

```ts
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
```

`createEvent`/`updateEvent` ricevono `postiDisponibili` già calcolato dal chiamante
(non `capienzaTotale` direttamente) perché il calcolo dipende dai posti già
prenotati, un dato che vive nel componente (vedi Sezione 5), non nel service.

**Flusso di salvataggio con locandina**: se Silvia seleziona un file, il
componente chiama prima `uploadLocandina()` per ottenere l'URL pubblico, poi
una singola chiamata `createEvent`/`updateEvent` con quell'URL incluso — niente
doppio giro di scritture. Se in modifica carica una nuova immagine, quella
precedente resta nel bucket senza essere ripulita (accettato esplicitamente:
volume di immagini troppo piccolo per giustificare la complessità di una pulizia
automatica).

## Sezione 3 — Struttura pagina `/gestione-prenotazioni`

`gestione.ts` guadagna uno switcher a due schede. Il contenuto attuale (elenco
prenotazioni) resta invariato, solo avvolto in un `@if`. Nuovi import:
`PaintEventAdmin`, `EventFormValue` da `../../core/models/event.model`, e
`formatFasciaOraria` da `../../core/utils/event-format.util` (la stessa utility
già usata da `eventi.ts`/`home.ts` in Fase 1):

```ts
protected readonly activeTab = signal<'prenotazioni' | 'eventi'>('prenotazioni');
protected readonly adminEvents = signal<PaintEventAdmin[]>([]);
protected readonly eventsTabLoaded = signal(false);
// riusa la stessa utility della pagina pubblica Eventi (Fase 1) invece di
// duplicare la logica di formattazione orario nel template.
protected readonly formatOrario = formatFasciaOraria;

selectTab(tab: 'prenotazioni' | 'eventi'): void {
  this.activeTab.set(tab);
  if (tab === 'eventi' && !this.eventsTabLoaded()) {
    this.admin.getAllEvents().then((events) => {
      this.adminEvents.set(events);
      this.eventsTabLoaded.set(true);
    });
  }
}
```

```html
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
  <!-- contenuto attuale della pagina, invariato -->
} @else {
  <!-- nuova sezione eventi, vedi Sezioni 4-5 -->
}
```

## Sezione 4 — Elenco eventi (scheda "Eventi")

Stessa impostazione visiva dell'elenco prenotazioni esistente (card bianche,
bordo grigio), un evento per riga, ordinato per data (già garantito da
`getAllEvents()`):

```html
<button type="button" (click)="openNewEventForm()" class="bg-action text-white text-xs font-semibold tracking-widest uppercase px-5 py-3 rounded mb-6">
  + Nuovo evento
</button>

@if (showEventForm()) {
  <!-- form di creazione/modifica, vedi Sezione 5 -->
}

@for (ev of adminEvents(); track ev.id) {
  <div class="bg-white rounded shadow-lg border border-gray-200 p-6 mb-4 flex items-center justify-between gap-4">
    <div>
      <p class="font-medium text-gray-900">
        {{ ev.title }}
        <span class="text-[10px] font-semibold tracking-widest uppercase px-2 py-1 rounded ml-2"
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
```

`toggleEventoPubblicato` è un'azione immediata (un click, nessuna conferma —
coerente con `togglePaid` già esistente per le prenotazioni): chiama
`admin.togglePubblicato(ev.id, !ev.pubblicato)` e aggiorna `adminEvents` in
place con try/catch/finally, esponendo un eventuale errore tramite un segnale
`eventActionError` (stesso pattern di `actionError` già usato per le
prenotazioni).

L'elenco mostra **tutti** gli eventi (pubblicati e nascosti): a differenza della
pagina pubblica, qui Silvia deve poter ritrovare e ripubblicare anche un evento
nascosto.

## Sezione 5 — Form di creazione/modifica evento

```ts
protected readonly showEventForm = signal(false);
protected readonly editingEventId = signal<number | null>(null);
protected readonly selectedLocandinaFile = signal<File | null>(null);
protected readonly savingEvent = signal(false);
protected readonly eventFormError = signal<string | null>(null);
// mostrato nel form ("Di cui N già prenotati"), calcolato una volta all'apertura
protected readonly giaPrenotatiCorrente = signal(0);

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

openNewEventForm(): void {
  this.editingEventId.set(null);
  this.eventFormError.set(null);
  this.selectedLocandinaFile.set(null);
  this.giaPrenotatiCorrente.set(0);
  this.eventForm.reset({ prezzo: 0, capienzaTotale: 10, pubblicato: true });
  this.showEventForm.set(true);
}

openEditEventForm(ev: PaintEventAdmin): void {
  this.editingEventId.set(ev.id);
  this.eventFormError.set(null);
  this.selectedLocandinaFile.set(null);
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

onLocandinaSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.selectedLocandinaFile.set(input.files?.[0] ?? null);
}

/** Somma i posti delle prenotazioni attive (non annullate) collegate a un evento,
 *  riusando i dati già caricati per la scheda Prenotazioni (nessuna query extra). */
private postiGiaPrenotati(eventoId: number): number {
  return this.bookings()
    .filter((b) => b.evento_id === eventoId && !b.cancellata)
    .reduce((sum, b) => sum + b.numero_posti, 0);
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
    let locandinaUrl: string | null = editingId !== null
      ? (this.adminEvents().find((e) => e.id === editingId)?.locandinaUrl ?? null)
      : null;

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
      this.eventFormError.set('Impossibile salvare l\'evento. Riprova.');
      return;
    }

    this.showEventForm.set(false);
    this.eventsTabLoaded.set(false);
    this.selectTab('eventi'); // ricarica l'elenco con i dati aggiornati
  } catch {
    this.eventFormError.set('Impossibile salvare l\'evento. Riprova.');
  } finally {
    this.savingEvent.set(false);
  }
}
```

**Perché "capienza totale" e non "posti disponibili" diretto**: la colonna
`eventi.posti_disponibili` è un contatore live (si scala automaticamente ad ogni
prenotazione tramite `prenota_posto`), non la capienza originale dell'evento. Se
il form mostrasse direttamente quel numero, Silvia vedrebbe "7" per un evento con
capienza 10 e 3 già prenotati — e non avrebbe modo di ragionare in termini di
"quanti posti voglio in totale per questo evento". Il form quindi mostra e fa
modificare `capienzaTotale` (= posti liberi attuali + posti già prenotati,
calcolato al momento dell'apertura), e al salvataggio si ricalcola
`posti_disponibili = capienzaTotale - posti_già_prenotati` prima di scrivere sul
database. Per un evento **nuovo** i posti già prenotati sono sempre 0, quindi
`capienzaTotale` coincide semplicemente con i posti disponibili iniziali.

**Campi del form** (`eventi/eventi.html`-side markup, coerente con lo stile del
form di prenotazione pubblico già esistente):
- `titolo`, `luogo`, `indirizzo`, `descrizione`: `<input type="text">` /
  `<textarea>`.
- `data`: `<input type="date" formControlName="data">` — calendario nativo del
  browser, nessuna libreria aggiuntiva.
- `oraInizio`/`oraFine`: `<input type="time">`.
- `prezzo`: `<input type="number" step="0.01" min="0">`.
- `capienzaTotale`: `<input type="number" step="1" min="0">`, con sotto,
  visibile solo quando `editingEventId()` non è `null`, un'indicazione
  testuale: "Di cui {{ giaPrenotatiCorrente() }} già prenotati" (il segnale
  `giaPrenotatiCorrente`, valorizzato una volta all'apertura del form — non
  si ricalcola ad ogni digitazione, solo alla riapertura).
- `pubblicato`: checkbox "Pubblica subito".
- Locandina: `<input type="file" accept="image/*" (change)="onLocandinaSelected($event)">`,
  opzionale — nessun `Validators.required` collegato. Se in modifica esiste già
  una locandina, si mostra una piccola anteprima dell'immagine corrente sopra al
  campo file.

## Sezione 6 — Prezzo sulla pagina pubblica Eventi

In `src/app/features/eventi/eventi.html`, un badge prezzo accanto al titolo di
ogni card:

```html
<h3 class="text-2xl md:text-4xl font-title font-medium text-gray-900 mb-1 tracking-wide">{{ ev.title }}</h3>
<p class="text-sm font-title italic text-brand mb-2">€ {{ ev.prezzo | number: '1.2-2' }}</p>
```

E nel riepilogo del form di prenotazione, accanto al conteggio posti già
esistente:

```html
<p class="text-xs text-gray-600 mt-2">Posti disponibili per questo evento: {{ ev.seatsAvailable }} · € {{ ev.prezzo | number: '1.2-2' }} a persona</p>
```

Nessun cambiamento al flusso di pagamento (resta gestito fuori dal sito, come
oggi): è solo un'informazione mostrata prima di prenotare. `PaintEvent` ha già
`prezzo: number` dalla Fase 1, quindi non serve nessuna modifica al modello per
questa sezione.

## Cosa NON fa questa fase

- Nessun pagamento online (PayPal o simili) — discussione rimandata, indipendente
  da questa fase.
- Nessuna eliminazione definitiva di un evento (solo nascondi/pubblica).
- Nessuna pulizia automatica delle locandine sostituite nel bucket Storage.
- Nessun limite di dimensione/tipo file lato database sulla locandina (solo
  eventuale `accept="image/*"` lato client, che è un suggerimento per il
  selettore di file del browser, non un vincolo di sicurezza).
- Nessuna modifica al flusso di prenotazione pubblico (`prenota_posto`,
  `annulla_prenotazione`) o alle RLS di `prenotazioni`: questa fase tocca solo
  permessi aggiuntivi su `eventi` e un nuovo bucket Storage.
