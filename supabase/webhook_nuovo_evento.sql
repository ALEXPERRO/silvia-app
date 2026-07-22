-- Quando un evento viene creato, modificato o cancellato, chiama in automatico
-- il Deploy Hook di Vercel per far ripartire una build: le pagine evento sono
-- pre-generate in build (vedi app.routes.server.ts), quindi ogni cambiamento
-- (nuovo evento, modifica data/testo/locandina, annullamento) ha bisogno di
-- un rebuild per riflettersi sulla pagina condivisibile.
--
-- L'URL del Deploy Hook NON va scritto qui: è un segreto (chi lo conosce può
-- far ripartire build a piacere) e questo file finisce in un repository
-- pubblico. Va salvato invece in Supabase Vault, eseguendo UNA VOLA SOLA
-- nell'SQL Editor di Supabase (senza salvare questo comando nel repository):
--
--   select vault.create_secret(
--     '<URL_DEL_DEPLOY_HOOK>',
--     'vercel_deploy_hook_url'
--   );
--
-- Poi eseguire il resto di questo file normalmente.

create extension if not exists pg_net;

create or replace function trigger_rebuild_su_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hook_url text;
begin
  select decrypted_secret into v_hook_url
    from vault.decrypted_secrets
    where name = 'vercel_deploy_hook_url';

  if v_hook_url is not null then
    perform net.http_post(
      url := v_hook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists rebuild_su_nuovo_evento on eventi;
drop trigger if exists rebuild_su_evento on eventi;
create trigger rebuild_su_evento
  after insert or update or delete on eventi
  for each row
  execute function trigger_rebuild_su_evento();
