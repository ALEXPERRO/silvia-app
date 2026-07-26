-- Aggiunge la policy di DELETE su portfolio_immagini, assente di proposito
-- dalla Fase 2 (vedi portfolio_fase2.sql: "nessuna policy di delete, si
-- nascondono, non si eliminano mai"). Il pannello Gestione ora ha pulsanti
-- "Elimina" (singola immagine e intera categoria) che senza questa policy
-- non cancellano nulla: la RLS blocca il DELETE in silenzio.
--
-- ATTENZIONE: da qui in poi eliminare un'immagine o una categoria da
-- Gestione è definitivo, senza cestino né possibilità di recupero.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

drop policy if exists "portfolio_immagini_delete_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_delete_autenticato"
  on portfolio_immagini for delete
  to authenticated
  using (true);
