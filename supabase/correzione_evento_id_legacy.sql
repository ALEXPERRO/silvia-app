-- Corregge un bug riscontrato nell'annullamento di prenotazioni "vecchie" (fatte
-- prima che esistesse la colonna evento_id): annulla_prenotazione, per queste
-- righe, si affidava a un abbinamento per titolo tra prenotazioni.evento_titolo
-- ed eventi.titolo — ma i titoli di alcuni eventi sono stati rinominati nel
-- frattempo (es. "Paint & Pass! - Bari" -> "Blooming Wild ART - Bari"), quindi
-- l'abbinamento falliva silenziosamente: la prenotazione veniva comunque
-- segnata come annullata, ma il posto non tornava mai disponibile.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file. Sicuro da rieseguire più volte:
-- la prima parte agisce solo sulle righe non ancora corrette (evento_id null),
-- la seconda solo sulle righe non ancora collegate (stesso motivo).

-- 1. Per ogni prenotazione GIÀ ANNULLATA il cui posto non è mai tornato
--    disponibile (evento_id null al momento dell'annullamento), ripristina
--    ora il numero corretto di posti e collega l'evento_id giusto sulla riga
--    (così una seconda esecuzione di questo file non la ritocca più).
do $$
declare
  v_riga record;
begin
  for v_riga in
    select id, numero_posti,
      case evento_titolo
        when 'Paint & Pass! - Taranto' then 1
        when 'Paint & Pass! - Bari' then 2
        when 'Paint & Pass! - Lecce' then 3
        when 'Paint & Pass! - Foggia' then 4
      end as evento_id_corretto
    from prenotazioni
    where evento_id is null
      and cancellata = true
      and evento_titolo in (
        'Paint & Pass! - Taranto', 'Paint & Pass! - Bari',
        'Paint & Pass! - Lecce', 'Paint & Pass! - Foggia'
      )
  loop
    if v_riga.evento_id_corretto is not null then
      update eventi set posti_disponibili = posti_disponibili + v_riga.numero_posti
        where id = v_riga.evento_id_corretto;
      update prenotazioni set evento_id = v_riga.evento_id_corretto where id = v_riga.id;
    end if;
  end loop;
end $$;

-- 2. Collega l'evento_id anche alle prenotazioni vecchie NON ancora annullate
--    (nessun posto da ripristinare qui — serve solo perché i loro futuri
--    annullamenti funzionino subito con l'evento_id diretto, senza più passare
--    dal fragile abbinamento per titolo).
update prenotazioni set evento_id = 1 where evento_id is null and evento_titolo = 'Paint & Pass! - Taranto';
update prenotazioni set evento_id = 2 where evento_id is null and evento_titolo = 'Paint & Pass! - Bari';
update prenotazioni set evento_id = 3 where evento_id is null and evento_titolo = 'Paint & Pass! - Lecce';
update prenotazioni set evento_id = 4 where evento_id is null and evento_titolo = 'Paint & Pass! - Foggia';
