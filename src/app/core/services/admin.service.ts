import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Prenotazione } from '../models/prenotazione.model';

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
}
