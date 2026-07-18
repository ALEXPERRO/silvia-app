# Pagina dedicata per evento (link condivisibile su Instagram)

**Contesto:** oggi gli eventi vivono solo come card in uno slider dentro `/eventi`; non
esiste un URL che punti a un singolo evento. Silvia vuole poter condividere un link a un
evento specifico su Instagram (bio/stories), e quel link deve mostrare una bella anteprima
(immagine + titolo) quando viene incollato, portare a una pagina con tutti i dettagli
dell'evento, e permettere di prenotarsi direttamente da lì.

## Sezione 1 — Route e formato del link

Nuova route dinamica gestita da un nuovo componente standalone `EventoDettaglio`
(`src/app/features/evento-dettaglio/`), registrata in `app.routes.ts` come
`eventi/:slugId`.

**Formato:** `/eventi/{slug}-{id}`, es. `/eventi/workshop-acquerello-a-firenze-42`.

- `slug` è generato automaticamente dal titolo dell'evento (minuscolo, spazi e accenti
  normalizzati in trattini) — zero lavoro in più per Silvia.
- `id` è l'identificativo reale dell'evento nel database. Il lookup dell'evento usa
  **solo l'id** (estratto come ultimo blocco numerico dopo l'ultimo trattino dello slug
  param); la parte testuale è puramente estetica/SEO e non viene validata. Questo rende
  il link stabile anche se Silvia modifica il titolo dell'evento dopo averlo già
  condiviso: il vecchio link continua a funzionare.
- Se il parametro non contiene un id numerico valido, o l'id non corrisponde a nessun
  evento pubblicato → redirect a `/eventi` (vedi Sezione 4).

Una utility condivisa `buildEventoSlug(titolo: string, id: number): string` in
`core/utils/event-format.util.ts` genera lo slug-id; è usata sia dal routing/link-building
pubblico sia dal bottone "Copia link" in Gestione (Sezione 3), così la generazione del
link è identica ovunque.

## Sezione 2 — Rendering lato server (dati freschi + anteprima Instagram)

A differenza delle altre pagine pubbliche (Home/Eventi/Portfolio/Shop), che sono
"congelate" una volta sola al momento del build e caricano i dati reali solo dopo
nel browser, `/eventi/:slugId` deve essere generata **lato server ad ogni visita**
(`RenderMode.Server` in `app.routes.server.ts`, la stessa modalità di rendering già
usata — con `RenderMode.Client` — per `/gestione-prenotazioni`; l'infrastruttura è già
pronta, cambia solo la modalità per questa route).

Motivo: un evento creato oggi da Silvia deve avere un link funzionante subito, senza
aspettare il prossimo aggiornamento del sito; e quando il link viene incollato su
Instagram, il sistema che genera l'anteprima legge l'HTML restituito dal server — se i
dati dell'evento (titolo, immagine) non sono già dentro quell'HTML, l'anteprima risulta
vuota o generica.

Il fetch dei dati (evento + posti disponibili) avviene quindi direttamente nel
costruttore del componente (non dentro `afterNextRender`, che viene saltato durante il
render lato server) usando `SupabaseService`, che è già compatibile con l'esecuzione
server-side (nessun uso di `localStorage`, client creato in modo lazy).

## Sezione 3 — Componenti

- **`EventoDettaglio`** (nuovo): pagina a piena larghezza. Header con la locandina come
  sfondo e overlay testo (stesso stile "poster" già usato nelle card dello slider di
  Eventi: badge posti disponibili/prezzo, titolo, data, luogo, bottone mappa), seguito
  dal form di prenotazione.
- **`PrenotazioneForm`** (nuovo, estratto da `Eventi`): componente condiviso con tutta
  la logica di prenotazione oggi dentro `eventi.ts`/`eventi.html` (form reattivo a due
  step, toggle privato/business, validazioni, submit, gestione posti esauriti/errori).
  Riceve l'evento (con posti disponibili) come input ed emette il risultato della
  prenotazione; viene usato sia dalla pagina Eventi (slider) sia da `EventoDettaglio`,
  così la logica di prenotazione vive in un solo posto invece di essere duplicata.
- **Pannello Gestione, scheda Eventi:** bottone "Copia link" su ogni riga evento
  (accanto a "Modifica"/"Pubblica"), che copia negli appunti l'URL assoluto pronto da
  incollare su Instagram, costruito con `buildEventoSlug`.
- **Evento passato:** se `data` dell'evento è già trascorsa ma l'evento è ancora
  pubblicato, `EventoDettaglio` resta raggiungibile e mostra tutti i dettagli, ma al
  posto di `PrenotazioneForm` mostra un messaggio "Evento concluso" (nuova utility
  `isEventoPassato(data: string, oraFine: string): boolean` in `event-format.util.ts`).

## Sezione 4 — SEO / anteprima Open Graph

Nel costruttore di `EventoDettaglio`, dopo aver caricato l'evento, imposto via i servizi
Angular `Meta` e `Title` (stesso pattern già usato in `eventi.ts` per la description):

- `title` pagina / `og:title`: `"{titolo evento} — Blooming Wild ART"`
- `og:description`: data + luogo + inizio della descrizione dell'evento
- `og:image`: `locandina_url` dell'evento; se assente, fallback all'immagine generica
  già esistente `https://blooming-wild-art.vercel.app/images/og-card.webp`
- `og:url`: URL assoluto della pagina (stesso valore del link copiato da Gestione)
- `og:type`: `website` (invariato)

Questi tag sostituiscono, solo per questa pagina, quelli statici e generici definiti in
`index.html` (che restano il default per tutte le altre pagine).

## Sezione 5 — Gestione errori

- Slug senza id numerico valido, o id senza evento corrispondente pubblicato →
  redirect a `/eventi` (nessuna pagina "404" dedicata).
- Evento trovato ma `pubblicato = false` → stesso comportamento: redirect a `/eventi`
  (un evento nascosto non deve essere raggiungibile nemmeno via link diretto).
- Evento passato ma pubblicato → pagina raggiungibile, form sostituito da messaggio
  "Evento concluso" (Sezione 3).
- Errore tecnico nel fetch (es. Supabase irraggiungibile) → stessa gestione già usata
  altrove nel sito: messaggio d'errore a schermo, nessun crash del render server.

## Sezione 6 — Verifica

Coerente con la convenzione del progetto (nessun file di test automatico):
`npm run build` pulito, poi verifica manuale via browser locale:
- apertura pagina dettaglio con un evento reale pubblicato (desktop + mobile);
- prenotazione completata direttamente dalla pagina dettaglio;
- link con id inesistente → redirect a `/eventi`;
- link a evento passato → messaggio "Evento concluso" invece del form;
- bottone "Copia link" in Gestione → link negli appunti nel formato corretto;
- anteprima Open Graph controllata con un tool di preview (es. ispezione dei meta tag
  nell'HTML restituito dal server per quella route).
