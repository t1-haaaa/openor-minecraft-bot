-- Fix RLS for automation_rules and add missing policies for other tables

-- automation_rules: add policy (was enabled but no policy -> deny all)
drop policy if exists "users can manage own automations" on automation_rules;
create policy "users can manage own automations" on automation_rules for all using (
  exists (select 1 from bots where bots.id = automation_rules.bot_id and bots.user_id = auth.uid())
) with check (
  exists (select 1 from bots where bots.id = automation_rules.bot_id and bots.user_id = auth.uid())
);

-- Ensure other tables have proper RLS or are disabled for now
-- schedules, notifications, activity, metrics, backup_meta: enable RLS and add policies

alter table schedules enable row level security;
drop policy if exists "users can manage own schedules" on schedules;
create policy "users can manage own schedules" on schedules for all using (
  exists (select 1 from bots where bots.id = schedules.bot_id and bots.user_id = auth.uid())
) with check (
  exists (select 1 from bots where bots.id = schedules.bot_id and bots.user_id = auth.uid())
);

alter table notifications enable row level security;
drop policy if exists "users can manage own notifications" on notifications;
create policy "users can manage own notifications" on notifications for all using (auth.uid() = user_id);

alter table activity enable row level security;
drop policy if exists "users can manage own activity" on activity;
create policy "users can manage own activity" on activity for all using (
  auth.uid() = user_id or exists (select 1 from bots where bots.id = activity.bot_id and bots.user_id = auth.uid())
) with check (
  auth.uid() = user_id or exists (select 1 from bots where bots.id = activity.bot_id and bots.user_id = auth.uid())
);

alter table metrics enable row level security;
drop policy if exists "users can manage own metrics" on metrics;
create policy "users can manage own metrics" on metrics for all using (
  exists (select 1 from bots where bots.id = metrics.bot_id and bots.user_id = auth.uid())
) with check (
  exists (select 1 from bots where bots.id = metrics.bot_id and bots.user_id = auth.uid())
);

alter table backup_meta enable row level security;
drop policy if exists "users can manage own backup_meta" on backup_meta;
create policy "users can manage own backup_meta" on backup_meta for all using (
  exists (select 1 from bots where bots.id = backup_meta.bot_id and bots.user_id = auth.uid())
) with check (
  exists (select 1 from bots where bots.id = backup_meta.bot_id and bots.user_id = auth.uid())
);

-- profiles: allow users to read/update own profile
alter table profiles enable row level security;
drop policy if exists "users can manage own profiles" on profiles;
create policy "users can manage own profiles" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
