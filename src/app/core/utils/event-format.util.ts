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

/** Numero di posti assunto per un evento finché il conteggio reale non è
 *  ancora arrivato dal database. */
export const DEFAULT_SEATS = 10;

/** Dominio di produzione del sito, usato per costruire URL assoluti (link
 *  condivisibili, tag Open Graph). */
export const SITE_URL = 'https://bloomingwild.art';

/** Es. "Workshop all'Aperto - Firenze!" -> "workshop-all-aperto-firenze". */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Genera lo slug leggibile usato nell'URL condivisibile di un evento (es. per
 *  Instagram). L'id in coda è l'unica parte che conta per il lookup (vedi
 *  parseEventoId): la parte testuale resta valida anche se il titolo
 *  dell'evento cambia dopo che il link è già stato condiviso. */
export function buildEventoSlug(titolo: string, id: number): string {
  const slug = slugify(titolo);
  return slug ? `${slug}-${id}` : `${id}`;
}

/** URL assoluto della pagina dedicata di un evento. */
export function buildEventoUrl(titolo: string, id: number): string {
  return `${SITE_URL}/eventi/${buildEventoSlug(titolo, id)}`;
}

/** Estrae l'id numerico dalla parte finale di uno slug (es.
 *  "workshop-firenze-42" -> 42). Ritorna null se non c'è nessun numero, cioè
 *  il link non è valido. */
export function parseEventoId(slugId: string): number | null {
  const match = slugId.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Un evento è "passato" quando la sua fascia oraria (data + ora di fine) è
 *  già trascorsa. */
export function isEventoPassato(data: string, oraFine: string): boolean {
  return new Date(`${data}T${oraFine}`).getTime() < Date.now();
}
