-- Blocca l'esposizione dei dati delle prenotazioni (nome, email, codice fiscale,
-- indirizzo) al pubblico. Oggi, senza Row Level Security attiva, chiunque visiti
-- il sito puo' leggere TUTTE le prenotazioni di TUTTI i clienti chiamando
-- direttamente l'API Supabase con la chiave anonima (quella gia' spedita nel
-- bundle del sito, quindi non e' un segreto): confermato con una lettura reale
-- in data odierna, la tabella "prenotazioni" ha restituito nome completo, email,
-- codice fiscale e indirizzo di clienti veri.
--
-- Questo file:
-- 1. Chiude "prenotazioni" in lettura/modifica/cancellazione per il pubblico —
--    resta possibile solo l'invio di una nuova prenotazione (insert), che e'
--    l'unica cosa che il form pubblico deve poter fare.
-- 2. Chiude "eventi" in scrittura per il pubblico — la lettura resta aperta
--    (serve per mostrare i posti disponibili a chiunque visiti il sito), ma
--    la modifica del contatore posti passa esclusivamente dalla funzione
--    "prenota_posto" (vedi prenota_posto.sql), l'unica autorizzata a scrivere.
--
-- COME ATTIVARLO:
-- 1. Eseguire PRIMA prenota_posto.sql (se non gia' fatto), poi questo file,
--    nell'SQL Editor di Supabase (https://supabase.com -> il tuo progetto).
-- 2. Il client deve aggiornarsi per chiamare prenota_posto via rpc() invece di
--    insertBooking+decrementSeats separati (task collegato, vedi commit che
--    aggiorna supabase.service.ts) — finche' non lo fa, le prenotazioni
--    smettono di funzionare dal sito (la insert diretta su "eventi" verrebbe
--    rifiutata), quindi vanno attivati insieme.
-- 3. Non tocca "iscrizioni_newsletter": quella tabella non esiste ancora nel
--    database (le iscrizioni alla newsletter falliscono silenziosamente oggi,
--    problema separato e indipendente da questo).

alter table prenotazioni enable row level security;

-- Il pubblico puo' SOLO inserire una nuova prenotazione, mai leggerle, modificarle o cancellarle.
drop policy if exists "prenotazioni_insert_pubblico" on prenotazioni;
create policy "prenotazioni_insert_pubblico"
  on prenotazioni for insert
  to anon
  with check (true);

alter table eventi enable row level security;

-- Il pubblico puo' leggere i posti disponibili (serve per la UI) ma non modificarli:
-- la scala-posti passa solo dalla funzione "prenota_posto" (security definer).
drop policy if exists "eventi_select_pubblico" on eventi;
create policy "eventi_select_pubblico"
  on eventi for select
  to anon
  using (true);
