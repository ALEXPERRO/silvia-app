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
