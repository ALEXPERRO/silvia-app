-- Riduzione parziale di una prenotazione multipla: permette di diminuire il
-- numero di posti di una prenotazione attiva (es. il gruppo era in 4 e ora
-- vengono in 3) senza annullarla del tutto, restituendo i posti liberati
-- all'evento. Vedi docs/superpowers/specs/2026-07-20-riduzione-posti-prenotazione-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

create or replace function riduci_posti_prenotazione(
  p_prenotazione_id bigint,
  p_nuovo_numero_posti integer
) returns boolean
language plpgsql
security definer
as $$
declare
  v_evento_id bigint;
  v_numero_posti_attuale integer;
  v_righe integer;
begin
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

revoke all on function riduci_posti_prenotazione(bigint, integer) from public;
grant execute on function riduci_posti_prenotazione(bigint, integer) to authenticated;
