-- Supabase PostgreSQL - primary data platform (Free: 50k MAU, 500MB DB, 1GB storage, pauses on inactivity)
-- Stores: users, profiles, bots, servers, configs, automation, schedules, notifications, activity, audit, metrics, backup meta, API config
-- Do NOT store raw Minecraft process state as sole truth; Do NOT store plaintext secrets

enable extension if not exists "pgcrypto";

-- profiles (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz default now()
);

-- bots
create table if not exists bots (
  id text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  server_host text not null,
  server_port int not null default 25565,
  username text not null,
  version text,
  provider_id text not null default 'self-hosted',
  status text not null default 'pending' check (status in ('pending','starting','running','stopped','crashed','reconnecting')),
  config_ref text not null, -- vault reference, never plaintext password
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_bots_user on bots(user_id);

-- encrypted bot configs (secrets vault - AES-GCM blob)
create table if not exists bot_configs (
  bot_id text primary key references bots(id) on delete cascade,
  encrypted_blob text not null,
  iv text not null,
  updated_at timestamptz default now()
);

-- automation rules
create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references bots(id) on delete cascade,
  trigger text not null,
  action text not null,
  created_at timestamptz default now()
);

-- schedules
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references bots(id) on delete cascade,
  auto_start boolean default false,
  auto_reconnect boolean default true,
  cron text
);

-- notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  bot_id text references bots(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

-- activity / audit / metrics
create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  bot_id text references bots(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  event text not null,
  created_at timestamptz default now()
);

create table if not exists metrics (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references bots(id) on delete cascade,
  cpu double precision,
  ram_mb double precision,
  at timestamptz default now()
);

create table if not exists backup_meta (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references bots(id) on delete cascade,
  storage_key text not null,
  created_at timestamptz default now()
);

-- RLS
alter table bots enable row level security;
alter table bot_configs enable row level security;
alter table automation_rules enable row level security;

create policy "users can manage own bots" on bots for all using (auth.uid() = user_id);
create policy "users can manage own configs" on bot_configs for all using (
  exists (select 1 from bots where bots.id = bot_configs.bot_id and bots.user_id = auth.uid())
);

-- Realtime: browser subscribes to bot status via supabase realtime channel bot:<id>
-- do not make bot lifetime dependent on WS - bot continues if browser disconnects; on reconnect load persisted state + replay
