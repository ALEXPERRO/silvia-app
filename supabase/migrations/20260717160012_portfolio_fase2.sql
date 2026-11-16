-- Fase 2 di "gestione portfolio": permette a un utente autenticato (Silvia) di
-- caricare, modificare e pubblicare/nascondere immagini portfolio, e aggiunge
-- lo storage per le immagini caricate da ora in poi (quelle già esistenti
-- restano in public/images/, non vengono spostate). Vedi
-- docs/superpowers/specs/2026-07-17-portfolio-fase2-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

-- Silvia (autenticata) può creare e modificare immagini portfolio. Nessuna
-- policy di delete: si nascondono (pubblicato = false), non si eliminano mai.
drop policy if exists "portfolio_immagini_insert_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_insert_autenticato"
  on portfolio_immagini for insert
  to authenticated
  with check (true);

drop policy if exists "portfolio_immagini_update_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_update_autenticato"
  on portfolio_immagini for update
  to authenticated
  using (true)
  with check (true);

-- Bucket pubblico per le immagini portfolio caricate da Silvia (quelle già
-- esistenti restano in public/images/, solo le nuove finiscono qui).
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "portfolio_select_pubblico" on storage.objects;
create policy "portfolio_select_pubblico"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "portfolio_insert_autenticato" on storage.objects;
create policy "portfolio_insert_autenticato"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio');
