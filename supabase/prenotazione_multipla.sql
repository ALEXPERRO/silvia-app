-- Prenotazione per più persone: un'unica prenotazione può riservare N posti
-- sotto un solo nominativo/fatturazione (niente nomi per singolo partecipante).
-- Vedi docs/superpowers/specs/2026-07-16-prenotazione-multipla-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

alter table prenotazioni add column if not exists numero_posti integer not null default 1;

alter table prenotazioni drop constraint if exists prenotazioni_numero_posti_positivo;
alter table prenotazioni add constraint prenotazioni_numero_posti_positivo check (numero_posti > 0);

-- prenota_posto cambia firma (nuovo parametro p_numero_posti): "create or replace"
-- non basta quando cambia il numero di parametri — va prima eliminata la vecchia
-- versione, altrimenti Postgres crea una seconda funzione con lo stesso nome
-- invece di sostituire quella esistente.
drop function if exists prenota_posto(bigint, text, text, text, text, text, text, text, text, text, text);

create or replace function prenota_posto(
  p_evento_id bigint,
  p_numero_posti integer,
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
     set posti_disponibili = posti_disponibili - p_numero_posti
   where id = p_evento_id
     and posti_disponibili >= p_numero_posti;

  get diagnostics righe_aggiornate = row_count;
  if righe_aggiornate = 0 then
    return false;
  end if;

  insert into prenotazioni (
    evento_id, numero_posti, evento_titolo, nome_completo, email, codice_fiscale,
    ragione_sociale, partita_iva, sdi, indirizzo, cap, citta
  ) values (
    p_evento_id, p_numero_posti, p_evento_titolo, p_nome_completo, p_email, p_codice_fiscale,
    p_ragione_sociale, p_partita_iva, p_sdi, p_indirizzo, p_cap, p_citta
  );

  return true;
end;
$$;

grant execute on function prenota_posto to anon;

-- annulla_prenotazione: ora ripristina numero_posti posti (non sempre 1).
-- La firma non cambia (ancora un solo parametro bigint), quindi "create or
-- replace" basta da solo e mantiene intatti i grant già impostati in precedenza
-- (revoke da public/anon, grant solo ad authenticated) — non vanno ripetuti qui.
create or replace function annulla_prenotazione(p_prenotazione_id bigint)
returns boolean
language plpgsql
security definer
as $$
declare
  v_evento_id bigint;
  v_numero_posti integer;
  v_righe integer;
begin
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
