import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Prenotazione } from '../models/prenotazione.model';
import { EventFormValue, PaintEventAdmin } from '../models/event.model';
import { GalleryItemAdmin } from '../models/gallery-item.model';

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

  async riduciPostiPrenotazione(id: number, nuovoNumeroPosti: number): Promise<{ success: boolean; error: unknown }> {
    const client = await this.getClient();
    const { data, error } = await client.rpc('riduci_posti_prenotazione', {
      p_prenotazione_id: id,
      p_nuovo_numero_posti: nuovoNumeroPosti,
    });
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

  /** Tutte le immagini portfolio (pubblicate e nascoste), ordinate per categoria poi ordine. */
  async getAllPortfolioItems(): Promise<GalleryItemAdmin[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('portfolio_immagini')
      .select('*')
      .order('categoria', { ascending: true })
      .order('ordine', { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row['id'],
      src: row['src'],
      title: row['titolo'],
      category: row['categoria'],
      ordine: row['ordine'],
      pubblicato: row['pubblicato'],
    }));
  }

  async uploadPortfolioImage(file: File): Promise<{ url: string | null; error: unknown }> {
    const client = await this.getClient();
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await client.storage.from('portfolio').upload(path, file);
    if (error) return { url: null, error };
    const { data } = client.storage.from('portfolio').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  /** Inserisce più immagini insieme (upload multiplo), già con src/titolo/categoria/ordine calcolati dal chiamante. */
  async createPortfolioItems(
    items: { src: string; titolo: string; categoria: string; ordine: number }[],
  ): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('portfolio_immagini').insert(
      items.map((i) => ({ src: i.src, titolo: i.titolo, categoria: i.categoria, ordine: i.ordine })),
    );
    return { error };
  }

  async updatePortfolioItem(
    id: number,
    titolo: string,
    categoria: string,
    ordine: number,
  ): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client
      .from('portfolio_immagini')
      .update({ titolo, categoria, ordine })
      .eq('id', id);
    return { error };
  }

  async togglePortfolioPubblicato(id: number, pubblicato: boolean): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('portfolio_immagini').update({ pubblicato }).eq('id', id);
    return { error };
  }

  /** Dopo un trascinamento: salva il nuovo ordine di tutte le immagini della categoria toccata
   *  (una update per riga: nessuna funzione SQL dedicata, il numero di immagini per
   *  categoria è troppo piccolo per giustificarne una). */
  async reorderPortfolioItems(updates: { id: number; ordine: number }[]): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const results = await Promise.all(
      updates.map((u) => client.from('portfolio_immagini').update({ ordine: u.ordine }).eq('id', u.id)),
    );
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  }

  /** La categoria è testo libero sulla singola immagine, non una riga a parte:
   *  "rinominare una categoria" è un update in blocco di tutte le immagini che
   *  condividono quel valore. */
  async renameCategoria(oldName: string, newName: string): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('portfolio_immagini').update({ categoria: newName }).eq('categoria', oldName);
    return { error };
  }

  /** Elimina tutte le immagini della categoria (non esiste una categoria "vuota"
   *  in questo modello dati). Cancella solo le righe DB, non i file nello
   *  storage: restano orfani, costo trascurabile per delle semplici immagini. */
  async deleteCategoria(categoria: string): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('portfolio_immagini').delete().eq('categoria', categoria);
    return { error };
  }

  /** Elimina una singola immagine (solo la riga DB, stesso motivo di deleteCategoria). */
  async deletePortfolioItem(id: number): Promise<{ error: unknown }> {
    const client = await this.getClient();
    const { error } = await client.from('portfolio_immagini').delete().eq('id', id);
    return { error };
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
