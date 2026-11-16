-- Restringe ogni permesso di gestione da "qualsiasi utente autenticato" a
-- "utente presente in public.amministratori" (funzione is_admin(), vedi
-- 20261116130000_amministratori.sql).
--
-- Con questa migrazione, anche se la registrazione pubblica di Supabase Auth
-- fosse rimasta attiva, un account creato da un estraneo non vede nessuna
-- prenotazione e non può modificare eventi, portfolio o file.
--
-- COME ATTIVARLO: eseguire nell'SQL Editor di Supabase DOPO aver registrato
-- Silvia in public.amministratori (vedi istruzioni nella migrazione
-- precedente). Il blocco qui sotto si ferma con un errore se l'elenco è vuoto,
-- per non chiudere fuori anche lei.
--
-- Sicuro da rieseguire: ogni policy viene eliminata e ricreata.

do $$
begin
  if not exists (select 1 from public.amministratori) then
    raise exception
      'Nessun amministratore registrato: inserisci prima l''account di Silvia in public.amministratori (vedi 20261116130000_amministratori.sql).';
  end if;
end $$;

-- ── prenotazioni (dati personali dei clienti) ──────────────────────────────

drop policy if exists "prenotazioni_select_autenticato" on prenotazioni;
create policy "prenotazioni_select_autenticato"
  on prenotazioni for select
  to authenticated
  using (public.is_admin());

-- I grant di colonna (update solo su pagato/cancellata) restano quelli di
-- 20260715115900_admin_gestione.sql: qui cambia solo chi può farlo.
drop policy if exists "prenotazioni_update_autenticato" on prenotazioni;
create policy "prenotazioni_update_autenticato"
  on prenotazioni for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── eventi ─────────────────────────────────────────────────────────────────
-- La lettura resta aperta a tutti (anon e authenticated): mostra i posti.

drop policy if exists "eventi_insert_autenticato" on eventi;
create policy "eventi_insert_autenticato"
  on eventi for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "eventi_update_autenticato" on eventi;
create policy "eventi_update_autenticato"
  on eventi for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── portfolio_immagini ─────────────────────────────────────────────────────

drop policy if exists "portfolio_immagini_insert_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_insert_autenticato"
  on portfolio_immagini for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "portfolio_immagini_update_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_update_autenticato"
  on portfolio_immagini for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "portfolio_immagini_delete_autenticato" on portfolio_immagini;
create policy "portfolio_immagini_delete_autenticato"
  on portfolio_immagini for delete
  to authenticated
  using (public.is_admin());

-- ── storage: locandine e portfolio ─────────────────────────────────────────
-- La lettura pubblica dei bucket resta invariata.

drop policy if exists "locandine_insert_autenticato" on storage.objects;
create policy "locandine_insert_autenticato"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'locandine' and public.is_admin());

drop policy if exists "locandine_update_autenticato" on storage.objects;
create policy "locandine_update_autenticato"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'locandine' and public.is_admin());

drop policy if exists "portfolio_insert_autenticato" on storage.objects;
create policy "portfolio_insert_autenticato"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio' and public.is_admin());

-- ── funzioni di gestione (security definer: ignorano la RLS) ───────────────
-- Prima bastava essere autenticati per chiamarle. Ora verificano is_admin()
-- all'inizio. Il corpo è identico alle versioni precedenti
-- (20260715170101_prenotazione_multipla.sql e
-- 20260721103022_riduzione_posti_prenotazione.sql); la firma non cambia,
-- quindi i grant esistenti restano validi.

create or replace function annulla_prenotazione(p_prenotazione_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento_id bigint;
  v_numero_posti integer;
  v_righe integer;
begin
  if not public.is_admin() then
    raise exception 'non_autorizzato' using errcode = '42501';
  end if;

  select evento_id, numero_posti into v_evento_id, v_numero_posti from prenotazioni where id = p_prenotazione_id;

  if v_evento_id is null then
    select e.id into v_evento_id
      from eventi e
      join prenotazioni p on p.evento_titolo = e.titolo
      where p.id = p_prenotazione_id
      limit 1;
  end if;

  update prenotazioni set cancellata = true
    where id = p_prenotazione_id and cancellata = false;

  get diagnostics v_righe = row_count;
  if v_righe = 0 then
    return false;
  end if;

  if v_evento_id is not null then
    update eventi set posti_disponibili = posti_disponibili + v_numero_posti where id = v_evento_id;
  end if;

  return true;
end;
$$;

create or replace function riduci_posti_prenotazione(
  p_prenotazione_id bigint,
  p_nuovo_numero_posti integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento_id bigint;
  v_numero_posti_attuale integer;
  v_righe integer;
begin
  if not public.is_admin() then
    raise exception 'non_autorizzato' using errcode = '42501';
  end if;

  if p_nuovo_numero_posti < 1 then
    return false;
  end if;

  select evento_id, numero_posti into v_evento_id, v_numero_posti_attuale
    from prenotazioni
    where id = p_prenotazione_id and cancellata = false;

  if v_evento_id is null or v_numero_posti_attuale is null
     or p_nuovo_numero_posti >= v_numero_posti_attuale then
    return false;
  end if;

  update prenotazioni set numero_posti = p_nuovo_numero_posti
    where id = p_prenotazione_id and cancellata = false;

  get diagnostics v_righe = row_count;
  if v_righe = 0 then
    return false;
  end if;

  update eventi
     set posti_disponibili = posti_disponibili + (v_numero_posti_attuale - p_nuovo_numero_posti)
   where id = v_evento_id;

  return true;
end;
$$;

-- Ribadisce i grant (create or replace li mantiene, ma così il file è
-- autosufficiente se rieseguito su un database diverso).
revoke execute on function annulla_prenotazione(bigint) from public, anon;
grant execute on function annulla_prenotazione(bigint) to authenticated;
revoke execute on function riduci_posti_prenotazione(bigint, integer) from public, anon;
grant execute on function riduci_posti_prenotazione(bigint, integer) to authenticated;
