# Gestione Eventi — Fase 1: migrazione dati eventi su database

**Contesto:** oggi i 4 workshop mostrati sul sito (Taranto, Bari, Lecce, Foggia) sono
hardcoded in `src/app/core/services/content.service.ts`. Per permettere a Silvia di
aggiungere/modificare/nascondere eventi da un pannello (Fase 2, da progettare a parte),
i dati devono prima vivere nel database `eventi` su Supabase, non nel codice. Questa
fase 1 fa solo la migrazione dei dati e il ricablaggio delle pagine pubbliche che li
leggono — nessuna UI di amministrazione viene costruita qui.

## Sezione 1 — Schema database

La tabella `eventi` esiste già (colonne attuali: `id`, `titolo`, `posti_disponibili`).
Aggiunge le colonne mancanti per rappresentare tutto ciò che oggi vive in
`content.service.ts` più i due campi nuovi richiesti (prezzo, locandina):

```sql
alter table eventi add column if not exists descrizione text not null default '';
alter table eventi add column if not exists data date;
alter table eventi add column if not exists ora_inizio time;
alter table eventi add column if not exists ora_fine time;
alter table eventi add column if not exists luogo text not null default '';
alter table eventi add column if not exists indirizzo text not null default '';
alter table eventi add column if not exists prezzo numeric(10,2) not null default 0;
alter table eventi add column if not exists locandina_url text;
alter table eventi add column if not exists pubblicato boolean not null default true;
```

- `locandina_url` resta `null` per ora: l'upload della locandina è lavoro della Fase 2
  (Supabase Storage). Fino ad allora la UI pubblica mostra un placeholder/nessuna immagine.
- `pubblicato` è il meccanismo di "nascondi evento" già approvato (soft-hide, non
  cancellazione) — di default `true` così gli eventi esistenti restano visibili subito
  dopo la migrazione.
- `prezzo` non esisteva prima: per i 4 eventi storici da migrare non abbiamo un valore
  reale, quindi il backfill sotto lo imposta a `0` (evento già concluso, il prezzo non è
  più rilevante). I nuovi eventi creati in Fase 2 avranno un prezzo reale inserito da Silvia.

**Backfill dei 4 eventi esistenti** (valori presi 1:1 da `content.service.ts`; le date
sono deducibili in modo univoco dal giorno della settimana indicato nel testo attuale,
es. "Domenica 28 Giugno" 2026 cade di domenica):

```sql
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

`data`/`ora_inizio`/`ora_fine`/`luogo`/`indirizzo` restano nullable a livello di
database anche dopo il backfill (nessun vincolo `not null` aggiunto in questa fase):
per i 4 eventi esistenti il backfill li popola comunque tutti, e per i nuovi eventi
che Silvia creerà in Fase 2 sarà il form di amministrazione a richiederli come
obbligatori lato UI, evitando di dover irrigidire lo schema due volte (una ora, una
quando la Fase 2 definisce esattamente quali campi il form rende obbligatori).

Nessuna modifica alle RLS policy esistenti: `eventi` è già leggibile in `select` da
`anon` e `authenticated` (vedi `rls_lockdown.sql` e `admin_gestione.sql`), e le nuove
colonne sono coperte automaticamente dalle policy esistenti (che non elencano colonne).

## Sezione 2 — Pagina pubblica Eventi

**Rimuove la mappa incorporata (iframe) subito**, non in Fase 2: al suo posto, un link
"Apri in Maps" generato automaticamente da `luogo` + `indirizzo` (stessa idea del link
manuale `mapLink` di oggi, ma calcolato invece che memorizzato):

```
https://www.google.com/maps/search/?api=1&query=<luogo>, <indirizzo> (URL-encoded)
```

Non serve più `trustedMapUrl()`/`DomSanitizer` nel componente (era solo per l'iframe).

**Date/orari in italiano senza registrare il locale Angular**: una piccola utility con
tabelle di lookup (giorni della settimana e mesi in italiano), in un nuovo file
`src/app/core/utils/event-format.util.ts`:

```ts
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export function formatDataItaliana(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  return `${GIORNI[d.getDay()]} ${d.getDate().toString().padStart(2, '0')} ${MESI[d.getMonth()]}`;
}

export function formatFasciaOraria(oraInizio: string, oraFine: string): string {
  const hhmm = (t: string) => t.slice(0, 5);
  return `Dalle ${hhmm(oraInizio)} alle ${hhmm(oraFine)}`;
}

export function buildMapsUrl(luogo: string, indirizzo: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${luogo}, ${indirizzo}`)}`;
}
```

**Caricamento dati**: `eventi.ts` smette di leggere `content.events` (proprietà statica
e sincrona) e passa a un fetch asincrono, con lo stesso pattern già usato oggi per i
posti disponibili (`afterNextRender` + segnale, niente `RenderMode.Client` da aggiungere
a `app.routes.server.ts`: la pagina resta prerenderizzata, i dati eventi arrivano via
JS lato client subito dopo l'hydration, esattamente come già succede oggi per i posti).

```ts
protected readonly events = signal<PaintEvent[]>([]);
protected readonly eventsLoaded = signal(false);

// nel constructor, dentro afterNextRender:
this.supabase.getPublishedEvents().then((events) => {
  this.events.set(events);
  this.eventsLoaded.set(true);
});
```

`SupabaseService` guadagna un metodo nuovo (non tocca `getEventSeats`, ancora usato
com'è):

```ts
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

`eventsWithSeats` (computed) unisce `events()` con la seat map esistente e calcola i
campi di visualizzazione (`dateLabel`, `timeLabel`, `mapsUrl`) usando le utility sopra,
al posto dei campi `date`/`time`/`mapLink`/`mapEmbedUrl` di oggi:

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

Nel template `eventi.html`: `ev.message.body` → `ev.descrizione`, `ev.date`/`ev.time`
→ `ev.dateLabel`/`ev.timeLabel`, `ev.location`/`ev.address` → `ev.luogo`/`ev.indirizzo`,
`[href]="ev.mapLink"` → `[href]="ev.mapsUrl"`, il blocco `<iframe>` con la mappa
incorporata viene rimosso (la colonna destra della card mostrerà, quando disponibile
in Fase 2, la locandina al posto della mappa — per ora resta vuota/con un placeholder
neutro). `onSubmit()` in `eventi.ts` usa `this.events()` (segnale) invece di
`this.events` per trovare `matchingEvent`.

**Stato vuoto/caricamento**: prima del fetch, `eventsWithSeats()` è `[]` — il template
mostra "Caricamento eventi…" finché `eventsLoaded()` è `false`, e "Nessun evento in
programma al momento, torna a trovarci presto!" se dopo il caricamento l'elenco resta
vuoto (nessun evento pubblicato). Questi due stati non esistono oggi perché l'array
statico non era mai vuoto.

## Sezione 3 — Home page: "Prossimo Workshop"

`home.ts` sostituisce `this.content.events[0]` (primo elemento fisso dell'array
statico) con "il prossimo evento pubblicato in ordine di data, a partire da oggi":

```ts
protected readonly nextEvent = signal<PaintEvent | null>(null);

// afterNextRender:
this.supabase.getPublishedEvents().then((events) => {
  const oggi = new Date().toISOString().slice(0, 10);
  this.nextEvent.set(events.find((ev) => ev.data >= oggi) ?? null);
});
```

(`getPublishedEvents()` già ordina per `data` crescente, quindi il primo elemento con
`data >= oggi` è il prossimo evento futuro più vicino.)

`home.html` avvolge la sezione "Prossimo Workshop" in `@if (nextEvent(); as ev)`, usando
`ev.title`, `formatDataItaliana(ev.data)`, `formatFasciaOraria(ev.oraInizio, ev.oraFine)`,
`ev.luogo`, `ev.indirizzo` al posto dei campi di oggi. Se non c'è nessun evento futuro
pubblicato, l'intera sezione non viene renderizzata (nessun placeholder "prossimamente":
la sezione semplicemente scompare finché Silvia non pubblica un nuovo evento).

## Sezione 4 — Pulizia

- `content.service.ts`: rimuove interamente l'array `events: PaintEvent[]` (righe 25-78)
  e l'import di `PaintEvent` che diventa inutilizzato in quel file.
- `event.model.ts`: `PaintEvent` perde `message` (sostituito da `descrizione` piatta),
  `date`/`time` (sostituiti da `data`/`oraInizio`/`oraFine`), `mapEmbedUrl`/`mapLink`
  (sostituiti dal calcolo `mapsUrl`), `location`/`address` (rinominati `luogo`/
  `indirizzo` per coerenza con le colonne del database). Nuova forma:

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

  (`EventMessage` viene rimossa: non più usata da nessuno.)
- `pubblicato` non entra nel modello `PaintEvent` lato client: `getPublishedEvents()`
  filtra già lato server (`.eq('pubblicato', true)`), quindi il client non ha mai
  bisogno di leggere quel flag — lo userà solo la Fase 2 (pannello di amministrazione),
  che leggerà gli eventi con una query separata non filtrata.
- `prezzo` viene già trasportato dal modello e dal fetch in questa fase (colonna e dato
  esistono da subito), ma **non viene ancora mostrato in nessuna pagina pubblica**: la
  sua visualizzazione (es. badge prezzo sulla card evento) è rimandata alla Fase 2
  insieme al resto della UI di amministrazione, per tenere il redesign della card in
  un'unica fase invece di toccarla due volte.

## Cosa NON fa questa fase

- Nessuna UI per creare/modificare/nascondere eventi (Fase 2).
- Nessun upload locandina (Fase 2, richiede Supabase Storage).
- Nessuna visualizzazione del prezzo sulla pagina pubblica (vedi Sezione 4).
- Nessuna modifica alle RLS policy o alle funzioni RPC esistenti (`prenota_posto`,
  `annulla_prenotazione`): questa fase tocca solo colonne aggiuntive lette in `select`,
  già coperte dalle policy attuali.
