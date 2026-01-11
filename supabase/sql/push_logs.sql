create table if not exists public.push_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  type text not null,
  date_key text not null,
  sent_at timestamptz not null default now()
);

create unique index if not exists push_logs_user_type_date_idx
  on public.push_logs (user_id, type, date_key);

alter table public.push_logs enable row level security;

create policy "Users read own push logs"
  on public.push_logs
  for select
  using (auth.uid() = user_id);

create policy "Users insert own push logs"
  on public.push_logs
  for insert
  with check (auth.uid() = user_id);
