import { RenderMode, ServerRoute } from '@angular/ssr';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { buildEventoSlug } from './core/utils/event-format.util';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'gestione-prenotazioni',
    renderMode: RenderMode.Client
  },
  {
    path: 'eventi/:slugId',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const client = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.from('eventi').select('id, titolo').eq('pubblicato', true);
      if (error || !data) return [];
      return data.map((ev) => ({ slugId: buildEventoSlug(ev['titolo'], ev['id']) }));
    },
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
