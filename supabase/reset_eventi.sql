-- Ripulisce completamente eventi e prenotazioni per ripartire da zero.
-- prenotazioni.evento_id referenzia eventi(id) senza cascade, quindi va
-- svuotata prima la tabella figlia.
delete from prenotazioni;
delete from eventi;
