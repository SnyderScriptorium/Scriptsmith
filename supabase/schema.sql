-- ============================================================================
-- ScriptSmith sync schema
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste all
-- of this -> Run.
--
-- What it does:
--   * Creates the `manuscripts` table (one row per manuscript per user).
--   * Creates the `user_settings` table (one row per user: theme, font,
--     and other app preferences, synced between the user's devices).
--   * Turns on Row Level Security and adds policies so a signed-in user can
--     ONLY read/write/delete their OWN rows. The app's anon key is safe to
--     ship precisely because of these policies.
-- ============================================================================

create table if not exists public.manuscripts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Document',
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes used by the app's sync queries.
create index if not exists manuscripts_user_id_idx
  on public.manuscripts (user_id);
create index if not exists manuscripts_updated_at_idx
  on public.manuscripts (updated_at desc);

-- Lock it down: without RLS + policies, the anon key could read everything.
alter table public.manuscripts enable row level security;

drop policy if exists "Users can read their own manuscripts" on public.manuscripts;
create policy "Users can read their own manuscripts"
  on public.manuscripts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own manuscripts" on public.manuscripts;
create policy "Users can insert their own manuscripts"
  on public.manuscripts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own manuscripts" on public.manuscripts;
create policy "Users can update their own manuscripts"
  on public.manuscripts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own manuscripts" on public.manuscripts;
create policy "Users can delete their own manuscripts"
  on public.manuscripts for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- User settings (one row per user; synced across the user's devices)
-- ============================================================================

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own settings" on public.user_settings;
create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own settings" on public.user_settings;
create policy "Users can delete their own settings"
  on public.user_settings for delete
  using (auth.uid() = user_id);
