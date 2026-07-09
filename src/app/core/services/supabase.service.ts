import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface BookingSubmission {
  evento_titolo: string;
  nome_completo: string;
  email: string;
  codice_fiscale: string | null;
  ragione_sociale: string | null;
  partita_iva: string | null;
  sdi: string | null;
  indirizzo: string;
  cap: string;
  citta: string;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  // auth disabilitato: il client è usato in modo anonimo (RLS via anon key) e deve
  // funzionare anche lato server durante il prerendering, dove non esiste localStorage.
  private readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  /** Mappa id evento -> posti disponibili, letta dalla tabella `eventi`. */
  async getEventSeats(): Promise<Record<number, number>> {
    const seats: Record<number, number> = {};
    try {
      const { data, error } = await this.client.from('eventi').select('*');
      if (!error && data) {
        for (const row of data) {
          seats[row['id']] = row['posti_disponibili'];
        }
      }
    } catch (err) {
      console.error('Errore nel recupero dati dal DB:', err);
    }
    return seats;
  }

  async insertBooking(payload: BookingSubmission): Promise<{ error: unknown }> {
    const { error } = await this.client.from('prenotazioni').insert([payload]);
    return { error };
  }

  async decrementSeats(eventId: number, newSeatCount: number): Promise<{ error: unknown }> {
    const { error } = await this.client
      .from('eventi')
      .update({ posti_disponibili: newSeatCount })
      .eq('id', eventId);
    return { error };
  }
}
