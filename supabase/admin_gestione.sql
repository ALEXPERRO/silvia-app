-- Fase "gestione prenotazioni": aggiunge il tracciamento del pagamento e
-- l'annullamento con ripristino posto, riservati a un account autenticato
-- (Silvia). Vedi docs/superpowers/specs/2026-07-16-gestione-prenotazioni-design.md.
--
-- COME ATTIVARLO:
-- 1. Aprire il progetto su https://supabase.com -> SQL Editor
-- 2. Incollare ed eseguire questo intero file
-- 3. Creare l'account di Silvia in Authentication -> Users -> Add user
--    (email + password a vostra scelta) se non esiste già: è un passo
--    manuale nel pannello Supabase, non fatto da questo file.

alter table prenotazioni add column if not exists evento_id bigint references eventi(id);
alter table prenotazioni add column if not exists pagato boolean not null default false;
alter table prenotazioni add column if not exists cancellata boolean not null default false;

-- prenota_posto aggiornata per salvare anche l'evento_id che già riceve
-- (prima lo usava solo per scalare il posto, senza mai salvarlo sulla riga).
create or replace function prenota_posto(
  p_evento_id bigint,
  p_evento_titolo text,
  p_nome_completo text,
  p_email text,
  p_codice_fiscale text,
  p_ragione_sociale text,
  p_partita_iva text,
  p_sdi text,
  p_indirizzo text,
  p_cap text,
  p_citta text
) returns boolean
language plpgsql
security definer
as $$
declare
  righe_aggiornate integer;
begin
  update eventi
     set posti_disponibili = posti_disponibili - 1
   where id = p_evento_id
     and posti_disponibili > 0;

  get diagnostics righe_aggiornate = row_count;
  if righe_aggiornate = 0 then
    return false;
  end if;

  insert into prenotazioni (
    evento_id, evento_titolo, nome_completo, email, codice_fiscale,
    ragione_sociale, partita_iva, sdi, indirizzo, cap, citta
  ) values (
    p_evento_id, p_evento_titolo, p_nome_completo, p_email, p_codice_fiscale,
    p_ragione_sociale, p_partita_iva, p_sdi, p_indirizzo, p_cap, p_citta
  );

  return true;
end;
$$;

grant execute on function prenota_posto to anon;

-- Annulla una prenotazione e ripristina il posto, in un'unica transazione.
-- Fa la propria ricerca autorevole dell'evento (invece di fidarsi di un id
-- passato dal client): prima usa evento_id se presente sulla riga, altrimenti
-- risale tramite il titolo per le prenotazioni fatte prima di questa migrazione.
create or replace function annulla_prenotazione(p_prenotazione_id bigint)
returns boolean
language plpgsql
security definer
as $$
declare
  v_evento_id bigint;
  v_righe integer;
begin
  select evento_id into v_evento_id from prenotazioni where id = p_prenotazione_id;

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
    update eventi set posti_disponibili = posti_disponibili + 1 where id = v_evento_id;
  end if;

  return true;
end;
$$;

-- Supabase concede di default EXECUTE su ogni nuova funzione sia a PUBLIC
-- sia direttamente al ruolo anon (default privileges di progetto): vanno
-- tolti entrambi esplicitamente, altrimenti il grant "to authenticated"
-- qui sotto si aggiunge senza restringere nulla e anon resta comunque abilitato.
revoke execute on function annulla_prenotazione(bigint) from public;
revoke execute on function annulla_prenotazione(bigint) from anon;
grant execute on function annulla_prenotazione to authenticated;

-- Lettura prenotazioni riservata a un utente autenticato (mai al pubblico anonimo).
drop policy if exists "prenotazioni_select_autenticato" on prenotazioni;
create policy "prenotazioni_select_autenticato"
  on prenotazioni for select
  to authenticated
  using (true);

-- Scrittura riservata a un utente autenticato, e solo sulle colonne
-- pagato/cancellata: mai sui dati fiscali/di contatto del cliente.
drop policy if exists "prenotazioni_update_autenticato" on prenotazioni;
create policy "prenotazioni_update_autenticato"
  on prenotazioni for update
  to authenticated
  using (true)
  with check (true);

revoke update on prenotazioni from authenticated;
grant update (pagato, cancellata) on prenotazioni to authenticated;

-- eventi: la policy pubblica esistente è "to anon" e non copre una sessione
-- autenticata (ruoli distinti in Postgres/Supabase) — ne serve una propria.
drop policy if exists "eventi_select_autenticato" on eventi;
create policy "eventi_select_autenticato"
  on eventi for select
  to authenticated
  using (true);
