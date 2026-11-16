-- Fase 1 di "gestione eventi": porta i dati dei workshop dal codice
-- (content.service.ts) al database, aggiungendo le colonne che oggi mancano
-- sulla tabella "eventi" e popolandole per i 4 eventi già esistenti.
-- Vedi docs/superpowers/specs/2026-07-15-gestione-eventi-fase1-design.md.
--
-- COME ATTIVARLO: Aprire il progetto su https://supabase.com -> SQL Editor,
-- incollare ed eseguire questo intero file.

alter table eventi add column if not exists descrizione text not null default '';
alter table eventi add column if not exists data date;
alter table eventi add column if not exists ora_inizio time;
alter table eventi add column if not exists ora_fine time;
alter table eventi add column if not exists luogo text not null default '';
alter table eventi add column if not exists indirizzo text not null default '';
alter table eventi add column if not exists prezzo numeric(10,2) not null default 0;
alter table eventi add column if not exists locandina_url text;
alter table eventi add column if not exists pubblicato boolean not null default true;

-- Backfill dei 4 eventi esistenti (dati presi da content.service.ts).
update eventi set
  descrizione = 'Per questa festa ti chiedo di abbandonare ogni forma di serietà e celebrare quel senso di meraviglia e drammaticità che si prova durante l''infanzia. Non c''è cosa più bella di entrare nell''età adulta portandosi dietro un po'' di magia! Non vedo l''ora di divertirci insieme.',
  data = '2026-06-28', ora_inizio = '10:00', ora_fine = '13:00',
  luogo = 'Villa Peripato', indirizzo = 'Taranto', prezzo = 0
where id = 1;

update eventi set
  descrizione = 'Bari si tinge dei colori della fantasia! Unisciti a noi per una mattinata di pittura libera e condivisa a due passi dal mare. Porta la tua voglia di sperimentare e lascia che il pennello parli per te. Nessuna regola, solo pura espressione cromatica.',
  data = '2026-06-29', ora_inizio = '18:00', ora_fine = '21:00',
  luogo = 'Piazza del Ferrarese', indirizzo = 'Bari (BA)', prezzo = 0
where id = 2;

update eventi set
  descrizione = 'Sotto il cielo barocco di Lecce, accendiamo la miccia della creatività. Questa sessione speciale unisce le sfumature della pittura all''energia del Salento. Un''esperienza immersiva studiata per riconnetterci con la gioia dell''arte condivisa.',
  data = '2026-07-04', ora_inizio = '20:30', ora_fine = '23:30',
  luogo = 'Piazza del Duomo', indirizzo = 'Lecce (LE)', prezzo = 0
where id = 3;

update eventi set
  descrizione = 'Chiudiamo il cerchio con un appuntamento esplosivo a Foggia. Un pomeriggio all''insegna del divertimento visivo, dei colori accesi e delle risate. Lasciati travolgere dal format che rompe le barriere tra pubblico e cavalletto!',
  data = '2026-07-12', ora_inizio = '16:00', ora_fine = '19:00',
  luogo = 'Corso Vittorio Emanuele', indirizzo = 'Foggia (FG)', prezzo = 0
where id = 4;
