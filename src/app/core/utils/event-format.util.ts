const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/** Es. "2026-06-28" -> "Domenica 28 Giugno". */
export function formatDataItaliana(data: string): string {
  const d = new Date(`${data}T00:00:00`);
  return `${GIORNI[d.getDay()]} ${d.getDate().toString().padStart(2, '0')} ${MESI[d.getMonth()]}`;
}

/** Es. ("10:00:00", "13:00:00") -> "Dalle 10:00 alle 13:00". */
export function formatFasciaOraria(oraInizio: string, oraFine: string): string {
  const hhmm = (t: string) => t.slice(0, 5);
  return `Dalle ${hhmm(oraInizio)} alle ${hhmm(oraFine)}`;
}

/** Link "Apri in Maps" generato dalla combinazione luogo + indirizzo. */
export function buildMapsUrl(luogo: string, indirizzo: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${luogo}, ${indirizzo}`)}`;
}
