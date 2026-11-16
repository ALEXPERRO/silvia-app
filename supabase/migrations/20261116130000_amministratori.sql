-- Amministratori espliciti: fino a oggi i permessi di gestione (leggere le
-- prenotazioni con i dati personali, modificare eventi e portfolio, caricare
-- file) erano concessi a QUALSIASI utente autenticato ("to authenticated
-- using (true)"). Se la registrazione pubblica di Supabase Auth è attiva,
-- chiunque può creare un account con la chiave anonima e diventare "admin".
--
-- Questa migrazione crea solo l'elenco degli amministratori e la funzione
-- is_admin(): non cambia ancora nessun permesso, quindi è innocua da sola.
-- Le policy vengono ristrette nella migrazione successiva
-- (20261116130100_policy_solo_admin.sql).
--
-- COME ATTIVARLO (SQL Editor di Supabase):
-- 1. Eseguire questo file.
-- 2. Registrare l'account di Silvia come amministratore (sostituire l'email
--    con quella che usa per entrare in /gestione-prenotazioni):
--
--      insert into public.amministratori (user_id)
--      select id from auth.users where email = 'EMAIL_DI_SILVIA'
--      on conflict do nothing;
--
-- 3. Solo dopo, eseguire 20261116130100_policy_solo_admin.sql (che si rifiuta
--    di partire se l'elenco amministratori è vuoto).

create table if not exists public.amministratori (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creato_il timestamptz not null default now()
);

-- Nessuna policy: la tabella non è leggibile né scrivibile via API da nessuno
-- (né anon né authenticated). Si gestisce solo dall'SQL Editor.
alter table public.amministratori enable row level security;
revoke all on public.amministratori from anon, authenticated;

-- security definer: legge amministratori con i permessi del proprietario,
-- così le policy possono usarla anche se l'utente non può leggere la tabella.
-- search_path vuoto per evitare che un oggetto omonimo in un altro schema
-- venga risolto al posto di quello giusto.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.amministratori where user_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;
