-- Habilita revocación de sesiones sin esperar expiración del JWT.
alter table public.usuario  add column if not exists token_version integer not null default 0;
alter table public.paciente add column if not exists token_version integer not null default 0;
