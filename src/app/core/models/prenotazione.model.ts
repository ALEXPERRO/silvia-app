export interface Prenotazione {
  id: number;
  evento_id: number | null;
  evento_titolo: string;
  nome_completo: string;
  email: string;
  numero_posti: number;
  codice_fiscale: string | null;
  ragione_sociale: string | null;
  partita_iva: string | null;
  sdi: string | null;
  indirizzo: string;
  cap: string;
  citta: string;
  created_at: string;
  pagato: boolean;
  cancellata: boolean;
}
