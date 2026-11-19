-- Adiciona armazenamento do escudo personalizado de cada clube.
-- Execute uma única vez no SQL Editor do Supabase.
alter table public.teams add column if not exists logo text;
