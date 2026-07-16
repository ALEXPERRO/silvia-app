# Redesign card evento (pagina Eventi)

**Contesto:** la card evento sulla pagina pubblica `/eventi` è oggi divisa in due
colonne (testo a sinistra, locandina/placeholder a destra su sfondo bianco),
percepita come piatta e poco valorizzante per la locandina ora che Silvia può
caricarla (Fase 2 di "gestione eventi"). Approvato dopo un giro di mockup nel
companion visivo: la locandina diventa lo sfondo a tutta card, con il testo in
overlay sopra un velo sfumato.

## Struttura della card

Sostituisce l'intero contenuto del blocco `@for (ev of eventsWithSeats(); track ev.id)`
in `src/app/features/eventi/eventi.html` (oggi due colonne) con un unico
riquadro a strati:

```html
@for (ev of eventsWithSeats(); track ev.id) {
  <div class="relative w-full min-w-full h-[440px] md:h-[500px] rounded shadow-lg overflow-hidden snap-start shrink-0 border border-gray-200">
    @if (ev.locandinaUrl) {
      <img [src]="ev.locandinaUrl" [alt]="ev.title" class="absolute inset-0 w-full h-full object-cover" />
    } @else {
      <div class="absolute inset-0 bg-gradient-to-br from-action via-bark to-brand"></div>
      <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 28px 28px;"></div>
    }

    <div class="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent"></div>

    <span class="absolute top-4 right-4 bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
      € {{ ev.prezzo | number: '1.2-2' }}
    </span>

    <div class="absolute inset-x-0 bottom-0 p-6 md:p-8 text-white">
      <p
        class="inline-flex w-fit items-center gap-1.5 text-xs md:text-sm font-title italic mb-3 px-3 py-1.5 rounded-full text-white"
        [class.bg-red-500]="seatsLoaded() && ev.isSoldOut"
        [class.bg-brand]="!seatsLoaded() || !ev.isSoldOut"
      >
        @if (!seatsLoaded()) {
          <app-icon name="sparkles" [size]="16" /> Verifica disponibilità in corso…
        } @else if (ev.isSoldOut) {
          <app-icon name="alert-triangle" [size]="16" /> Attenzione: Posti esauriti per questa data
        } @else {
          <app-icon name="sparkles" [size]="16" /> Solo {{ ev.seatsAvailable }} posti ancora disponibili
        }
      </p>

      <h3 class="text-2xl md:text-4xl font-title font-medium mb-1 tracking-wide">{{ ev.title }}</h3>

      <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm opacity-90 mb-5">
        <span class="flex items-center gap-1.5"><app-icon name="calendar" [size]="15" /> {{ ev.dateLabel }} · {{ ev.timeLabel }}</span>
        <span class="flex items-center gap-1.5"><app-icon name="map-pin" [size]="15" /> {{ ev.luogo }}, {{ ev.indirizzo }}</span>
      </p>

      <div class="flex flex-wrap gap-3">
        <a
          [href]="ev.mapsUrl"
          target="_blank"
          class="flex items-center gap-1.5 border border-white/40 text-white text-xs font-semibold tracking-widest px-4 py-3 rounded hover:bg-white/10 transition-colors uppercase"
        ><app-icon name="map" [size]="14" /> Mappa</a>
        <button
          type="button"
          [disabled]="ev.isSoldOut"
          (click)="selectEventAndScroll(ev.id)"
          class="flex items-center gap-1.5 text-xs font-semibold tracking-widest px-5 py-3 rounded transition-all uppercase"
          [ngClass]="ev.isSoldOut ? 'bg-white/20 cursor-not-allowed text-white/60' : 'bg-action text-white hover:bg-action-hover'"
        >
          @if (ev.isSoldOut) {
            <app-icon name="ban" [size]="14" /> Esaurito
          } @else {
            <app-icon name="ticket" [size]="14" /> Prenotati
          }
        </button>
      </div>
    </div>
  </div>
}
```

**Differenze rispetto a oggi, tutte deliberate:**
- Niente più colonna immagine separata: la locandina (o, se assente, un
  gradiente decorativo `action → bark → brand` con un pattern a pallini) copre
  l'intera card, con un velo scuro sfumato dal basso per garantire il testo
  sempre leggibile sopra qualunque immagine.
- Il badge posti disponibili/esauriti diventa sempre una pillola con sfondo
  colorato pieno (rosso per esaurito, `brand`/plum per disponibile o in
  caricamento) invece del testo rosso semplice di oggi — necessario per
  restare leggibile sopra una foto invece che su sfondo bianco.
- Il pulsante "Mappa" passa da bordo grigio a bordo bianco translucido
  (`border-white/40`), coerente con lo sfondo scuro.
- **La descrizione dell'evento (`ev.descrizione`) non compare più nella
  card** (deciso esplicitamente: affollerebbe l'overlay) — si sposta nel form
  di prenotazione (vedi sotto), non sparisce dal sito.
- Altezza fissa per slide (`h-[440px] md:h-[500px]`) invece di un'altezza
  determinata dal contenuto testuale: necessario perché ora è un'unica immagine
  di sfondo, non due colonne che si adattano al testo. Frecce, puntini di
  navigazione e suggerimento swipe (`showSwipeHint`) restano invariati, agiscono
  sul contenitore slider esterno, non sulla singola card.

## Descrizione spostata nel form di prenotazione

In `eventi.html`, subito sotto il `<select>` di scelta evento (prima del campo
"Numero di Partecipanti"), aggiunge la descrizione del evento selezionato:

```html
<div>
  <label for="event-select" class="block text-xs font-bold text-gray-600 uppercase tracking-widest mb-2">Seleziona l'evento *</label>
  <select id="event-select" formControlName="eventId" class="w-full p-3 border border-gray-200 rounded bg-white focus:border-brand focus:outline-none font-medium text-gray-800 transition-colors">
    <option [ngValue]="null" disabled>Seleziona un appuntamento...</option>
    @for (ev of eventsWithSeats(); track ev.id) {
      <option [ngValue]="ev.id" [disabled]="ev.isSoldOut">
        {{ ev.title }} ({{ ev.dateLabel }}){{ seatsLoaded() ? (ev.isSoldOut ? ' - SOLD OUT' : ' - Posti: ' + ev.seatsAvailable) : '' }}
      </option>
    }
  </select>
  @if (selectedEvent(); as ev) {
    <p class="text-xs text-gray-600 mt-2 leading-relaxed">{{ ev.descrizione }}</p>
  }
</div>
```

(`selectedEvent()` esiste già in `eventi.ts` — nessuna modifica al componente
necessaria, solo al template.)

## Cosa NON cambia

- Nessuna modifica a `eventi.ts` (nessun nuovo stato, nessuna nuova logica —
  è un restyle di template puro).
- Nessuna modifica al modello dati, al fetch degli eventi, o al form di
  prenotazione oltre all'aggiunta della riga descrizione sopra.
- Frecce prev/next, puntini di navigazione, suggerimento swipe su mobile:
  invariati.
- Comportamento "Prenotati"/"Esaurito" (disabilitazione pulsante, scroll al
  form): invariato, solo restilizzato per lo sfondo scuro.
