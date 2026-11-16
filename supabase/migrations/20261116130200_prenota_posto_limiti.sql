-- Protegge prenota_posto (aperta al pubblico anonimo) dall'abuso: oggi una
-- sola chiamata con dati inventati e p_numero_posti enorme può far risultare
-- un workshop "esaurito".
--
-- Aggiunge, lato server (il client si può aggirare, il database no):
-- 1. Tetto per singola prenotazione: da 1 a MAX_POSTI posti.
-- 2. Tetto per cliente: la stessa email non può tenere più di MAX_POSTI
--    posti attivi sullo stesso evento, sommando più prenotazioni.
-- 3. Solo eventi prenotabili: pubblicato = true e data non passata.
-- 4. Limite di frequenza per indirizzo IP: al massimo MAX_TENTATIVI
--    prenotazioni ogni FINESTRA minuti dallo stesso IP.
--
-- Gli errori hanno messaggi fissi ('posti_non_validi', 'limite_per_cliente',
-- 'evento_non_prenotabile', 'troppe_richieste') che il form traduce in un
-- testo comprensibile (vedi prenotazione-form.ts). Il caso "posti esauriti"
-- continua a restituire false, come prima.
--
-- La firma non cambia, quindi "create or replace" sostituisce la funzione
-- esistente e mantiene il grant ad anon.
--
-- COME ATTIVARLO: eseguire nell'SQL Editor di Supabase. Indipendente dalle
-- due migrazioni sugli amministratori.

create table if not exists public.prenotazioni_tentativi (
  id bigserial primary key,
  ip text not null,
  creato_il timestamptz not null default now()
);
create index if not exists prenotazioni_tentativi_ip_creato_il
  on public.prenotazioni_tentativi (ip, creato_il);

-- Solo la funzione (security definer) ci scrive: nessun accesso via API.
alter table public.prenotazioni_tentativi enable row level security;
revoke all on public.prenotazioni_tentativi from anon, authenticated;

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
set search_path = public
as $$
declare
  -- Costanti: da cambiare qui (e in MAX_POSTI_PER_PRENOTAZIONE del form).
  MAX_POSTI constant integer := 10;
  MAX_TENTATIVI constant integer := 5;
  FINESTRA constant interval := interval '15 minutes';

  v_headers json;
  v_ip text;
  v_posti_gia_presi integer;
  righe_aggiornate integer;
begin
  if p_numero_posti is null or p_numero_posti < 1 or p_numero_posti > MAX_POSTI then
    raise exception 'posti_non_validi' using errcode = 'P0001';
  end if;

  -- IP del chiamante dagli header che PostgREST espone alla sessione.
  -- cf-connecting-ip è impostato da Cloudflare (davanti a Supabase) e non è
  -- falsificabile dal client; x-forwarded-for è il ripiego.
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_ip := coalesce(
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), '')
  );

  -- Senza IP (chiamata non da API, es. SQL Editor) il limite non si applica:
  -- meglio che bloccare tutti i clienti in un unico secchio "sconosciuto".
  if v_ip is not null then
    delete from prenotazioni_tentativi where creato_il < now() - interval '1 day';

    if (select count(*) from prenotazioni_tentativi
         where ip = v_ip and creato_il > now() - FINESTRA) >= MAX_TENTATIVI then
      raise exception 'troppe_richieste' using errcode = 'P0001';
    end if;

    insert into prenotazioni_tentativi (ip) values (v_ip);
  end if;

  if not exists (
    select 1 from eventi
     where id = p_evento_id
       and pubblicato = true
       and (data is null or data >= (now() at time zone 'Europe/Rome')::date)
  ) then
    raise exception 'evento_non_prenotabile' using errcode = 'P0001';
  end if;

  select coalesce(sum(numero_posti), 0) into v_posti_gia_presi
    from prenotazioni
   where evento_id = p_evento_id
     and cancellata = false
     and lower(email) = lower(p_email);

  if v_posti_gia_presi + p_numero_posti > MAX_POSTI then
    raise exception 'limite_per_cliente' using errcode = 'P0001';
  end if;

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

grant execute on function prenota_posto(bigint, integer, text, text, text, text, text, text, text, text, text, text) to anon;
