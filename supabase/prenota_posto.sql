-- Prenotazione atomica: inserisce la prenotazione e scala il posto in un'unica
-- transazione, rifiutando quando i posti sono esauriti. Elimina la race condition
-- dell'attuale flusso client (lettura posti -> insert -> update separati), dove due
-- prenotazioni simultanee sull'ultimo posto passano entrambe.
--
-- COME ATTIVARLA:
-- 1. Aprire il progetto su https://supabase.com -> SQL Editor
-- 2. Incollare ed eseguire questo intero file
-- 3. Avvisare chi sviluppa: il client va aggiornato per chiamare
--    supabase.rpc('prenota_posto', {...}) al posto di insertBooking+decrementSeats.
--    Finché il client non viene aggiornato, la funzione è innocua: il vecchio
--    flusso continua a funzionare come oggi.

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
  -- Scala il posto SOLO se ce n'è ancora almeno uno: l'update condizionato è atomico,
  -- quindi due richieste simultanee sull'ultimo posto non possono passare entrambe.
  update eventi
     set posti_disponibili = posti_disponibili - 1
   where id = p_evento_id
     and posti_disponibili > 0;

  get diagnostics righe_aggiornate = row_count;
  if righe_aggiornate = 0 then
    return false; -- posti esauriti
  end if;

  insert into prenotazioni (
    evento_titolo, nome_completo, email, codice_fiscale,
    ragione_sociale, partita_iva, sdi, indirizzo, cap, citta
  ) values (
    p_evento_titolo, p_nome_completo, p_email, p_codice_fiscale,
    p_ragione_sociale, p_partita_iva, p_sdi, p_indirizzo, p_cap, p_citta
  );

  return true;
end;
$$;

-- Permette la chiamata dal sito (client anonimo)
grant execute on function prenota_posto to anon;
