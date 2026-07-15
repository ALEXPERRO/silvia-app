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

/** Vista admin di un evento: espone anche i campi gestionali che il pubblico
 *  non deve mai vedere (posti "grezzi" e stato di pubblicazione). */
export interface PaintEventAdmin extends PaintEvent {
  postiDisponibili: number;
  pubblicato: boolean;
}

/** Valori del form di creazione/modifica evento. `capienzaTotale` è il numero
 *  totale di posti pensati per l'evento, non il contatore live posti_disponibili
 *  (vedi gestione.ts per come si traduce l'uno nell'altro prima del salvataggio). */
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
