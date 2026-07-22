-- Rimuove la policy che permette l'insert diretto e senza controlli sulla
-- tabella prenotazioni da parte di chiunque abbia la chiave anonima (che è
-- pubblica, dentro il bundle del sito). La funzione prenota_posto() è
-- "security definer" e inserisce le righe con i propri permessi: non ha
-- bisogno di questa policy per funzionare. Senza questa policy, l'unico modo
-- di creare una prenotazione resta la funzione, che controlla i posti
-- disponibili prima di scrivere; con la policy attiva, chiunque può inserire
-- righe arbitrarie via API REST bypassando quel controllo.
drop policy if exists "prenotazioni_insert_pubblico" on prenotazioni;
