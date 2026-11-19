-- ============================================================
-- Esquema do banco de dados (PostgreSQL)
-- Os nomes de colunas são idênticos aos campos usados no site
-- (js/store.js), então a sincronização é direta.
-- Funciona também em Supabase; para MySQL troque uuid/gen_random_uuid()
-- por CHAR(36)/UUID(), jsonb por JSON e timestamptz por DATETIME.
-- ============================================================

create extension if not exists "pgcrypto";

-- Configuração do campeonato (uma única linha)
create table tournament (
  id            uuid primary key default gen_random_uuid(),
  format        text not null default 'grupos' check (format in ('grupos','mata-mata')),
  group_size    int  not null default 4,
  advance       int  not null default 2 check (advance in (1,2)),   -- classificados por grupo
  legs          text not null default 'ida' check (legs in ('ida','ida-volta')),
  -- ordem dos 5 critérios de desempate (1º, 2º, ...). Valores possíveis:
  -- wins | goal_diff | goals_for | head_to_head | fair_play
  tiebreakers   jsonb not null default '["wins","goal_diff","goals_for","head_to_head","fair_play"]',
  ko_byes       jsonb not null default '[]'                         -- ids de clubes que folgaram na 1ª fase do mata-mata
);

create table teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  short      text,                      -- sigla (3 letras)
  color      text default '#64748b',    -- cor legada/opcional
  logo       text,                      -- escudo do clube em data URL WebP
  grp        text                       -- grupo (A, B, C...)
);

create table players (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  name       text not null,
  -- CPF = chave única do atleta: o mesmo CPF não pode estar em dois clubes.
  -- Guardado só com dígitos (11). NUNCA exponha esta coluna ao público (veja a view abaixo).
  cpf        char(11) not null unique check (cpf ~ '^[0-9]{11}$'),
  number     int,
  position   text
);

-- Versão pública dos jogadores (sem CPF) — é isto que o site dos usuários deve ler
create view players_public as
  select id, team_id, name, number, position from players;

create table matches (
  id          uuid primary key default gen_random_uuid(),
  stage       text not null default 'grupos' check (stage in ('grupos','mata-mata')),
  grp         text default '',            -- grupo (fase de grupos)
  phase       text,                       -- "Fase de grupos", "Semifinal", "Final"...
  phase_no    int default 0,              -- 0 = grupos; 1, 2, 3... = fases do mata-mata
  round       int,                        -- rodada
  date        timestamptz,                -- data e hora (editáveis)
  home_id     uuid not null references teams(id) on delete cascade,
  away_id     uuid not null references teams(id) on delete cascade,
  home_score  int,
  away_score  int,
  home_pen    int,                        -- pênaltis (mata-mata empatado)
  away_pen    int,
  status      text not null default 'nao_iniciado' check (status in ('nao_iniciado','em_andamento','concluido')),
  notes       text default '',
  check (home_id <> away_id)
);

-- gols e cartões de cada jogo
create table events (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  team_id    uuid not null references teams(id) on delete cascade,
  type       text not null check (type in ('gol','gol_contra','amarelo','vermelho')),
  minute     int
);

create table suspensions (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  reason     text,
  games      int default 1,
  active     boolean not null default true
);

-- observações / avisos gerais da organização
create table notes (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  text        text,
  created_at  timestamptz not null default now()
);

-- usuários: preenchida no 1º login (Google) ou manualmente (admin)
create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  name        text,
  role        text not null default 'user' check (role in ('user','admin')),
  password_hash text,                   -- somente para admin (use bcrypt/argon2!)
  created_at  timestamptz not null default now()
);

create index on players (team_id);
create index on matches (stage, phase_no, round);
create index on matches (home_id);
create index on matches (away_id);
create index on events (match_id);
create index on events (player_id);

-- Exemplo: cadastrar o administrador (troque o e-mail e gere o hash com bcrypt no servidor)
-- insert into users (email, name, role, password_hash) values ('seu@email.com', 'Admin', 'admin', '<hash-bcrypt>');


-- ============================================================
-- Supabase: permissões e políticas (RLS)
-- Admin: usuário do Supabase Auth com app_metadata.role = 'admin'.
-- Público: leitura dos dados esportivos; CPF apenas para admin.
-- ============================================================

-- A view pública deliberadamente não contém CPF.
create or replace view players_public as
  select id, team_id, name, number, position from players;

alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table events enable row level security;
alter table suspensions enable row level security;
alter table notes enable row level security;
alter table tournament enable row level security;
alter table users enable row level security;

-- Leitura pública dos dados não sigilosos.
create policy "public read teams" on teams for select to anon, authenticated using (true);
create policy "public read matches" on matches for select to anon, authenticated using (true);
create policy "public read events" on events for select to anon, authenticated using (true);
create policy "public read suspensions" on suspensions for select to anon, authenticated using (true);
create policy "public read notes" on notes for select to anon, authenticated using (true);
create policy "public read tournament" on tournament for select to anon, authenticated using (true);

-- CPF e tabela completa de jogadores: somente administrador autenticado.
create policy "admin manage players" on players for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Todas as alterações exigem a role administrativa no app_metadata do JWT.
create policy "admin manage teams" on teams for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin manage matches" on matches for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin manage events" on events for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin manage suspensions" on suspensions for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin manage notes" on notes for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin manage tournament" on tournament for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Privilégios mínimos: visitantes não podem consultar a tabela players diretamente.
grant select on teams, matches, events, suspensions, notes, tournament to anon, authenticated;
grant select on players_public to anon, authenticated;
grant select, insert, update, delete on teams, players, matches, events, suspensions, notes, tournament to authenticated;
revoke all on players from anon;
revoke all on users from anon, authenticated;
