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

  // Cache condivisa dei posti: l'app la scalda al primo render (vedi App) così
  // atterrando su Eventi i dati sono già pronti e il badge non "scatta" da
  // 10 disponibili a esaurito. Il TTL evita di mostrare conteggi vecchi.
  private seatsCache: { promise: Promise<Record<number, number>>; fetchedAt: number } | null = null;
  private static readonly SEATS_TTL_MS = 60_000;

  /** Mappa id evento -> posti disponibili, con cache condivisa (TTL 60s). */
  getEventSeats(): Promise<Record<number, number>> {
    const now = Date.now();
    if (!this.seatsCache || now - this.seatsCache.fetchedAt > SupabaseService.SEATS_TTL_MS) {
      this.seatsCache = { promise: this.fetchEventSeats(), fetchedAt: now };
    }
    return this.seatsCache.promise;
  }

  /** Invalida la cache posti: da chiamare quando un'azione altrove (es. annullamento) cambia il conteggio. */
  invalidateSeatsCache(): void {
    this.seatsCache = null;
  }

  private async fetchEventSeats(): Promise<Record<number, number>> {
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

  /**
   * Prenota un posto in modo atomico (funzione `prenota_posto`, vedi supabase/prenota_posto.sql):
   * scala il posto e inserisce la prenotazione nella stessa transazione lato server, quindi
   * niente race condition tra letture e scritture separate. Richiede supabase/rls_lockdown.sql
   * applicato, perché dopo quel file il client non può più scrivere `eventi` direttamente.
   */
  async prenotaPosto(eventId: number, payload: BookingSubmission): Promise<{ success: boolean; error: unknown }> {
    const client = await this.getClient();
    const { data, error } = await client.rpc('prenota_posto', {
      p_evento_id: eventId,
      p_evento_titolo: payload.evento_titolo,
      p_nome_completo: payload.nome_completo,
      p_email: payload.email,
      p_codice_fiscale: payload.codice_fiscale,
      p_ragione_sociale: payload.ragione_sociale,
      p_partita_iva: payload.partita_iva,
      p_sdi: payload.sdi,
      p_indirizzo: payload.indirizzo,
      p_cap: payload.cap,
      p_citta: payload.citta,
    });
    this.seatsCache = null; // i posti sono cambiati (prenotato o appena esaurito): rifai la query
    return { success: data === true, error };
  }

  async insertNewsletterSignup(email: string): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('iscrizioni_newsletter').insert([{ email }]);
    return { error };
  }
}
