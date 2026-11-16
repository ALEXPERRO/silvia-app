-- Verifica che il database di produzione corrisponda alle migrazioni in
-- supabase/migrations. Solo letture: non modifica nulla.
--
-- COME USARLO: incollare ed eseguire nell'SQL Editor di Supabase. Ogni riga
-- del risultato ha una colonna "esito": tutto deve essere 'OK'. Una riga
-- 'PROBLEMA' indica cosa manca o cosa è ancora troppo aperto.

with
policy_attese(tabella, policy) as (values
  ('prenotazioni', 'prenotazioni_select_autenticato'),
  ('prenotazioni', 'prenotazioni_update_autenticato'),
  ('eventi', 'eventi_insert_autenticato'),
  ('eventi', 'eventi_update_autenticato'),
  ('portfolio_immagini', 'portfolio_immagini_insert_autenticato'),
  ('portfolio_immagini', 'portfolio_immagini_update_autenticato'),
  ('portfolio_immagini', 'portfolio_immagini_delete_autenticato'),
  ('objects', 'locandine_insert_autenticato'),
  ('objects', 'locandine_update_autenticato'),
  ('objects', 'portfolio_insert_autenticato')
),
controlli as (
  -- 1. RLS attiva sulle tabelle con dati
  select 'RLS attiva: ' || c.relname as controllo,
         case when c.relrowsecurity then 'OK' else 'PROBLEMA' end as esito,
         null::text as dettaglio
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('prenotazioni', 'eventi', 'portfolio_immagini',
                       'amministratori', 'prenotazioni_tentativi')

  union all
  -- 2. Ogni policy di gestione esiste e usa is_admin()
  select 'Policy solo admin: ' || a.policy,
         case when p.policyname is null then 'PROBLEMA'
              when coalesce(p.qual, '') || coalesce(p.with_check, '') like '%is_admin()%' then 'OK'
              else 'PROBLEMA' end,
         coalesce('using: ' || p.qual || '  check: ' || p.with_check, 'policy mancante')
    from policy_attese a
    left join pg_policies p on p.tablename = a.tabella and p.policyname = a.policy

  union all
  -- 3. Nessun'altra policy concede scritture o letture di prenotazioni senza is_admin()
  select 'Policy non prevista: ' || p.schemaname || '.' || p.tablename || '.' || p.policyname,
         'PROBLEMA',
         p.cmd || ' to ' || array_to_string(p.roles, ',') || '  using: ' || coalesce(p.qual, '-')
           || '  check: ' || coalesce(p.with_check, '-')
    from pg_policies p
   where p.schemaname in ('public', 'storage')
     and (p.tablename in ('prenotazioni', 'amministratori', 'prenotazioni_tentativi')
          or p.cmd <> 'SELECT')
     and coalesce(p.qual, '') || coalesce(p.with_check, '') not like '%is_admin()%'

  union all
  -- 4. Almeno un amministratore registrato (e quanti)
  select 'Amministratori registrati',
         case when count(*) > 0 then 'OK' else 'PROBLEMA' end,
         string_agg(u.email, ', ')
    from public.amministratori a join auth.users u on u.id = a.user_id

  union all
  -- 5. Utenti Auth che NON sono amministratori (se la registrazione era aperta,
  --    qui compaiono eventuali account creati da estranei)
  select 'Utenti non amministratori',
         case when count(*) = 0 then 'OK' else 'PROBLEMA' end,
         string_agg(u.email || ' (creato ' || u.created_at::date || ')', ', ')
    from auth.users u
   where not exists (select 1 from public.amministratori a where a.user_id = u.id)

  union all
  -- 6. Funzioni: chi può eseguirle e se contengono i nuovi controlli
  select 'Funzione ' || f.nome,
         case when not exists (select 1 from pg_proc where proname = f.nome) then 'PROBLEMA'
              when (select bool_and(prosrc like '%' || f.deve_contenere || '%')
                      from pg_proc where proname = f.nome)
                   and has_function_privilege('anon', (select oid from pg_proc where proname = f.nome limit 1), 'execute') = f.anon_ammesso
              then 'OK'
              else 'PROBLEMA' end,
         'versioni: ' || (select count(*) from pg_proc where proname = f.nome)
           || '  anon può eseguire: '
           || coalesce((select has_function_privilege('anon', oid, 'execute')::text
                          from pg_proc where proname = f.nome limit 1), '-')
    from (values
      ('prenota_posto', 'troppe_richieste', true),
      ('annulla_prenotazione', 'is_admin()', false),
      ('riduci_posti_prenotazione', 'is_admin()', false),
      ('is_admin', 'amministratori', false)
    ) as f(nome, deve_contenere, anon_ammesso)
)
select esito, controllo, dettaglio
  from controlli
 order by esito desc, controllo;
