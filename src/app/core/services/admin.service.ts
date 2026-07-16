import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Prenotazione } from '../models/prenotazione.model';
import { EventFormValue, PaintEventAdmin } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  // Client separato da SupabaseService: qui la sessione va persistita (Silvia
  // resta loggata tra un caricamento e l'altro), a differenza del client
  // pubblico che deve restare compatibile con l'SSR/prerendering. Questo
  // client viene creato solo quando la pagina di gestione lo usa, l'unica
  // rotta esclusa dal prerendering (vedi app.routes.server.ts).
  private clientPromise: Promise<SupabaseClient> | null = null;

  private getClient(): Promise<SupabaseClient> {
    if (!this.clientPromise) {
      this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        }),
      );
    }
    return this.clientPromise;
  }

  async signIn(email: string, password: string): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error };
  }

  async signOut(): Promise<void> {
    const client = await this.getClient();
    await client.auth.signOut();
  }

  async getSession(): Promise<boolean> {
    const client = await this.getClient();
    const { data } = await client.auth.getSession();
    return data.session !== null;
  }

  async getBookings(): Promise<Prenotazione[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('prenotazioni')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) {
      console.error('Errore nel recupero delle prenotazioni:', error);
      return [];
    }
    return data as Prenotazione[];
  }

  async setPaid(id: number, pagato: boolean): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('prenotazioni').update({ pagato }).eq('id', id);
    return { error };
  }

  async cancelBooking(id: number): Promise<{ success: boolean; error: unknown }> {
    const client = await this.getClient();
    const { data, error } = await client.rpc('annulla_prenotazione', { p_prenotazione_id: id });
    return { success: data === true, error };
  }

  /** Tutti gli eventi (pubblicati e nascosti), ordinati per data crescente. */
  async getAllEvents(): Promise<PaintEventAdmin[]> {
    const client = await this.getClient();
    const { data, error } = await client.from('eventi').select('*').order('data', { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row['id'],
      title: row['titolo'],
      descrizione: row['descrizione'],
      data: row['data'],
      oraInizio: row['ora_inizio'],
      oraFine: row['ora_fine'],
      luogo: row['luogo'],
      indirizzo: row['indirizzo'],
      prezzo: row['prezzo'],
      locandinaUrl: row['locandina_url'],
      postiTotali: row['posti_totali'],
      postiDisponibili: row['posti_disponibili'],
      pubblicato: row['pubblicato'],
    }));
  }

  async createEvent(fields: EventFormValue, postiDisponibili: number): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('eventi').insert([this.toRow(fields, postiDisponibili)]);
    return { error };
  }

  async updateEvent(id: number, fields: EventFormValue, postiDisponibili: number): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('eventi').update(this.toRow(fields, postiDisponibili)).eq('id', id);
    return { error };
  }

  async togglePubblicato(id: number, pubblicato: boolean): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('eventi').update({ pubblicato }).eq('id', id);
    return { error };
  }

  async uploadLocandina(file: File): Promise<{ url: string | null; error: unknown }> {
    const client = await this.getClient();
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await client.storage.from('locandine').upload(path, file);
    if (error) return { url: null, error };
    const { data } = client.storage.from('locandine').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  private toRow(fields: EventFormValue, postiDisponibili: number) {
    return {
      titolo: fields.titolo,
      luogo: fields.luogo,
      indirizzo: fields.indirizzo,
      data: fields.data,
      ora_inizio: fields.oraInizio,
      ora_fine: fields.oraFine,
      descrizione: fields.descrizione,
      prezzo: fields.prezzo,
      posti_totali: fields.capienzaTotale,
      posti_disponibili: postiDisponibili,
      locandina_url: fields.locandinaUrl,
      pubblicato: fields.pubblicato,
    };
  }
}
