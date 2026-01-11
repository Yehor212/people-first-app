create table if not exists public.user_reminder_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  mood_time text,
  habit_time text,
  focus_time text,
  days int[] not null default '{}',
  quiet_start text,
  quiet_end text,
  habit_ids text[] not null default '{}',
  timezone text,
  language text,
  updated_at timestamptz not null default now()
);

alter table public.user_reminder_settings enable row level security;

create policy "Users can read own reminder settings"
  on public.user_reminder_settings
  for select
  using (auth.uid() = user_id);

create policy "Users can upsert own reminder settings"
  on public.user_reminder_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
