# Database Supabase

## Struttura

- `migrations/`: ogni modifica allo schema, ai permessi e alle funzioni, in ordine di applicazione. Il nome di ogni file inizia con un timestamp (`AAAAMMGGhhmmss_nome.sql`), nel formato della Supabase CLI. Una migrazione già applicata non si modifica: per cambiare qualcosa se ne aggiunge una nuova.
- `scripts/`: strumenti da eseguire a mano quando servono. Non sono migrazioni.
  - `verifica_produzione.sql`: confronta il database live con le migrazioni. Fa solo letture.
  - `reset_eventi.sql`: **cancella tutti gli eventi e tutte le prenotazioni.**

Le tabelle `eventi` e `prenotazioni` sono state create dal pannello Supabase prima che esistesse questa cartella. Per questo le migrazioni partono da modifiche a tabelle che già esistono.

## Come applicare una migrazione

Nel pannello Supabase, apri **SQL Editor**, incolla il file ed eseguilo. Poi esegui `scripts/verifica_produzione.sql` e controlla che tutte le righe risultino `OK`.

## Hardening del 2026-11-16 (da applicare in quest'ordine)

1. **Authentication → Sign In / Providers**: disattiva *Allow new users to sign up*. L'account di Silvia esiste già, quindi non servono nuove registrazioni.
2. Esegui `20261116130000_amministratori.sql`.
3. Registra Silvia come amministratrice:
   ```sql
   insert into public.amministratori (user_id)
   select id from auth.users where email = 'EMAIL_CON_CUI_SILVIA_FA_LOGIN'
   on conflict do nothing;
   ```
4. Esegui `20261116130100_policy_solo_admin.sql`.
5. Esegui `20261116130200_prenota_posto_limiti.sql`.
6. Esegui `scripts/verifica_produzione.sql` e risolvi ogni riga `PROBLEMA`. In particolare, alla voce "Utenti non amministratori" non deve comparire nessuno: un account che non riconosci va eliminato da **Authentication → Users**.
