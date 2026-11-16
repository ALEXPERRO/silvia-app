-- Fase 2 di "gestione eventi": permette a un utente autenticato (Silvia) di
-- creare e modificare eventi, e aggiunge lo storage per le locandine.
-- Vedi docs/superpowers/specs/2026-07-16-gestione-eventi-fase2-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

-- Silvia (autenticata) può creare e modificare eventi. Nessuna policy di
-- delete: gli eventi si nascondono (pubblicato = false), non si cancellano.
drop policy if exists "eventi_insert_autenticato" on eventi;
create policy "eventi_insert_autenticato"
  on eventi for insert
  to authenticated
  with check (true);

drop policy if exists "eventi_update_autenticato" on eventi;
create policy "eventi_update_autenticato"
  on eventi for update
  to authenticated
  using (true)
  with check (true);

-- Bucket pubblico per le locandine: lettura aperta a tutti (il sito pubblico
-- deve poter mostrare l'immagine), scrittura solo per un utente autenticato.
insert into storage.buckets (id, name, public)
values ('locandine', 'locandine', true)
on conflict (id) do nothing;

drop policy if exists "locandine_select_pubblico" on storage.objects;
create policy "locandine_select_pubblico"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'locandine');

drop policy if exists "locandine_insert_autenticato" on storage.objects;
create policy "locandine_insert_autenticato"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'locandine');

drop policy if exists "locandine_update_autenticato" on storage.objects;
create policy "locandine_update_autenticato"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'locandine');
