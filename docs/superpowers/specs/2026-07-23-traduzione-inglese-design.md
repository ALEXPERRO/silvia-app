# Traduzione inglese del sito

**Contesto:** oggi il sito è scritto solo in italiano. Vogliamo dare a chi visita
la possibilità di leggerlo in inglese, con un interruttore che traduce il testo
sul momento (nessun ricaricamento, nessun URL separato tipo `/en/...`).

## Decisioni

- **Libreria:** `@ngx-translate/core`. Nessuna libreria HTTP-loader aggiuntiva:
  i due file di traduzione vengono importati direttamente nel bundle (non
  scaricati via rete), per evitare complicazioni con `HttpClient` durante il
  pre-rendering in build (vedi [[eventi-pagina-dedicata]] per i problemi già
  incontrati in questo progetto con richieste di rete lato server).
- **Ambito — solo i testi fissi del sito**: titoli di pagina, paragrafi scritti
  nel codice, etichette dei bottoni, messaggi del form di prenotazione. I
  contenuti che Silvia inserisce dal pannello Gestione (titoli/descrizioni degli
  eventi, testi del portfolio) **restano in italiano sempre**, anche con
  l'interruttore su EN — non fanno parte di questa feature.
- **Pagina Gestione esclusa**: `/gestione-prenotazioni` resta solo in italiano
  (la usa solo Silvia).
- **Lingua di default:** italiano. Non si tenta di indovinare la lingua del
  browser: la scelta va sempre fatta esplicitamente dall'utente.
- **Persistenza:** la scelta si salva in `localStorage` e viene riletta ad ogni
  visita successiva (stesso dominio).
- **Interruttore:** un piccolo componente riusabile con due scritte "IT" / "EN"
  affiancate (quella attiva evidenziata in grassetto/colore pieno, l'altra
  attenuata) — non un menu a tendina, non bandiere. Posizionato:
  - nella navbar desktop (`navbar.html`), accanto ai link di navigazione;
  - nel footer (`footer.html`), visibile sia su mobile che desktop (su mobile
    è l'unico punto in cui compare, dato che la barra in basso resta dedicata
    alla sola navigazione).
- **SEO:** le pagine pre-generate in build restano in italiano (unica versione
  vista dai motori di ricerca/crawler); la versione inglese esiste solo lato
  client dopo l'idratazione. Compromesso accettato: non serve indicizzazione
  separata in inglese per questo pubblico.

## Struttura dei file di traduzione

Due file JSON in `src/assets/i18n/`: `it.json` ed `en.json`, chiavi annidate
per pagina/sezione, tutto maiuscolo con punti come separatore (convenzione
standard di ngx-translate), es.:

```json
{
  "NAV": { "ABOUT": "About me", "PORTFOLIO": "Portfolio", "EVENTI": "Events", "SHOP": "Shop" },
  "HOME": {
    "TAGLINE": "Watercolor illustrations",
    "BIO_1": "...",
    "PORTFOLIO_TITLE": "From the Portfolio"
  },
  "EVENTI": { "HERO_TITLE": "Events", "HERO_DESCRIPTION": "..." },
  "PRENOTAZIONE_FORM": { "NOME_LABEL": "Full name", "EMAIL_LABEL": "Email", "..." : "..." }
}
```

## Pagine/componenti coinvolti (solo testo statico)

- `navbar.html` / `bottom-nav.html`: le 4 etichette di navigazione (Portfolio e
  Shop sono identiche in entrambe le lingue, ma restano comunque chiavi nel
  dizionario per coerenza).
- `home.html`: titolo, tagline, i 4 paragrafi della bio, sezione portfolio
  (titolo/testo/bottone), sezione Prossimo Workshop (intro + card evento +
  stato vuoto), sezione shop (intro + stato "si sta preparando").
- `portfolio.html`: hero, filtri categoria, stati vuoti.
- `eventi.html`: hero, stato vuoto illustrato, etichette statiche dello slider
  (badge posti/esaurito, bottoni Mappa/Prenotati, indizio di swipe) — i dati
  dell'evento stesso (titolo, data, luogo) restano quelli che arrivano da
  Supabase, non tradotti.
- `evento-dettaglio.html`: badge stato evento, bottone mappa, messaggio evento
  concluso — stesso principio, i dati dell'evento non si toccano.
- `shop.html`: hero, notifica apertura, bottone Instagram.
- `footer.html`: didascalia donazione, bottone caffè.
- `prenotazione-form` (componente condiviso Eventi/EventoDettaglio): la parte
  più corposa — tutte le etichette dei campi, messaggi di validazione, stati
  di invio/successo/errore.

## Verifica

Coerente con la convenzione del progetto (nessun test automatico): `npm run
build` pulito, poi verifica manuale passando da IT a EN su ciascuna pagina
sopra elencata, controllando che:
- il cambio sia istantaneo, senza ricaricare la pagina;
- i contenuti dinamici (eventi, portfolio) restino in italiano anche in EN;
- la scelta sopravviva a un refresh della pagina e alla navigazione tra rotte;
- `/gestione-prenotazioni` non mostri l'interruttore e resti in italiano.
