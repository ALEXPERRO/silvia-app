# Riduzione posti di una prenotazione multipla

**Contesto:** una prenotazione può coprire più persone sotto un solo nominativo
(`numero_posti`, vedi [[prenotazione-multipla]]). Oggi l'unica azione possibile dal
pannello Gestione è annullare l'intera prenotazione (`annulla_prenotazione`). Se un
gruppo che aveva prenotato per 4 persone comunica che ne verranno solo 3, non c'è modo
di riflettere questo senza annullare tutto e far riprenotare da capo. Questa feature
aggiunge un'azione "riduci posti" accanto ad "Annulla prenotazione".

## Decisioni

- **Chi la usa**: solo Silvia, dal pannello Gestione → scheda Prenotazioni. Nessun
  self-service per il cliente (il cliente continua a comunicarglielo a voce/messaggio,
  come già fa oggi per gli annullamenti completi).
- **Nessuna email**: a differenza della prenotazione originale, questa modifica non fa
  partire nessuna email (né al cliente né a Silvia) — lei sta già parlando col cliente
  quando la fa.
- **Solo riduzione, non azzeramento**: il nuovo numero di posti deve essere un intero
  compreso tra 1 e (numero attuale − 1). Per portarlo a 0 si usa l'azione esistente
  "Annulla prenotazione" (cancellazione completa), non questa.
- **Visibile solo su prenotazioni attive con più di 1 posto**: se `numero_posti = 1` o
  la prenotazione è già cancellata, l'azione non compare (per 1 posto la riduzione
  coinciderebbe con l'annullamento, già coperto dal bottone esistente).
- **Atomicità**: la riduzione dei posti sulla prenotazione e il rilascio dei posti
  liberati sull'evento (`eventi.posti_disponibili += differenza`) avvengono nella
  stessa funzione RPC lato database (stesso pattern già usato da `prenota_posto` e
  `annulla_prenotazione`), non con due scritture separate dal client.

## Database

Nuova funzione RPC `riduci_posti_prenotazione(p_prenotazione_id bigint, p_nuovo_numero_posti integer) returns boolean`:
- Ritorna `false` (nessuna scrittura) se: la prenotazione non esiste, è già
  cancellata, `p_nuovo_numero_posti < 1`, o `p_nuovo_numero_posti >=` al numero
  posti attuale della prenotazione.
- Altrimenti aggiorna `prenotazioni.numero_posti` al nuovo valore e incrementa
  `eventi.posti_disponibili` della differenza (vecchio − nuovo), nella stessa
  transazione.
- Stessi permessi di `annulla_prenotazione`: `revoke all from public`, `grant
  execute to authenticated` — solo un'amministratrice loggata può chiamarla (mai
  `anon`).

## UI (pannello Gestione, scheda Prenotazioni)

Accanto al bottone "Annulla prenotazione" di ogni riga prenotazione attiva con
`numero_posti > 1`, un bottone "Modifica posti". Al click:
- Appare un campo numerico (precompilato a `numero_posti − 1`) con un bottone
  "Salva" e uno "Annulla" (per chiudere senza modificare) — stesso spirito del
  pattern conferma-a-due-passi già usato per l'annullamento, ma qui serve un
  valore anziché una sola conferma.
- Se il valore inserito non è valido (fuori dal range 1..numero_posti−1), mostra
  un messaggio d'errore nello stesso stile degli altri errori della scheda
  (`actionError`), senza chiudere il campo di modifica.
- Al salvataggio riuscito: aggiorna la riga in memoria (`bookings`), invalida e
  ricarica la cache posti condivisa (stesso pattern già usato da
  `confirmCancel`), così il conteggio "N posti disponibili" mostrato accanto al
  titolo evento nella stessa scheda si aggiorna subito.

## Verifica

Coerente con la convenzione del progetto (nessun test automatico): `npm run
build` pulito, poi verifica manuale nel pannello Gestione con una prenotazione
di prova multi-posto, incluso il caso limite (provare a inserire un numero
uguale o superiore a quello attuale, o 0, e verificare che venga rifiutato).
