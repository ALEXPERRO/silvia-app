import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  // Il client viene creato in modo lazy (import dinamico) così @supabase/supabase-js
  // resta un chunk separato, caricato solo alla prima chiamata reale, invece di
  // finire nel bundle iniziale ora che SupabaseService è raggiungibile anche dal
  // Footer (eager, presente su ogni pagina) e non solo dalla rotta lazy Eventi.
  private clientPromise: Promise<SupabaseClient> | null = null;

  private getClient(): Promise<SupabaseClient> {
    if (!this.clientPromise) {
      this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
      );
    }
    return this.clientPromise;
  }

  /** Mappa id evento -> posti disponibili, letta dalla tabella `eventi`. */
  async getEventSeats(): Promise<Record<number, number>> {
    const seats: Record<number, number> = {};
    try {
      const client = await this.getClient();
      const { data, error } = await client.from('eventi').select('*');
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
    const client = await this.getClient();
    const { error } = await client.from('prenotazioni').insert([payload]);
    return { error };
  }

  async decrementSeats(eventId: number, newSeatCount: number): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client
      .from('eventi')
      .update({ posti_disponibili: newSeatCount })
      .eq('id', eventId);
    return { error };
  }

  async insertNewsletterSignup(email: string): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('iscrizioni_newsletter').insert([{ email }]);
    return { error };
  }
}
