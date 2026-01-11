create table if not exists public.user_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

create policy "Users can read own backups"
  on public.user_backups
  for select
  using (auth.uid() = user_id);

create policy "Users can upsert own backups"
  on public.user_backups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
