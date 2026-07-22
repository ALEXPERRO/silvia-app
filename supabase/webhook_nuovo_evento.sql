-- Quando un evento viene creato, modificato o cancellato, chiama in automatico
-- il Deploy Hook di Vercel per far ripartire una build: le pagine evento sono
-- pre-generate in build (vedi app.routes.server.ts), quindi ogni cambiamento
-- (nuovo evento, modifica data/testo/locandina, annullamento) ha bisogno di
-- un rebuild per riflettersi sulla pagina condivisibile.
create extension if not exists pg_net;

create or replace function trigger_rebuild_su_evento()
returns trigger
language plpgsql
as $$
begin
  perform net.http_post(
    url := 'https://api.vercel.com/v1/integrations/deploy/prj_Z7UpZxELLdaM1bsa36Mfpd8CPuX5/XVCsbR6bAM',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists rebuild_su_nuovo_evento on eventi;
drop trigger if exists rebuild_su_evento on eventi;
create trigger rebuild_su_evento
  after insert or update or delete on eventi
  for each row
  execute function trigger_rebuild_su_evento();
