create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  token text not null,
  platform text not null default 'android',
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_device_tokens_user_token_idx
  on public.push_device_tokens (user_id, token);

alter table public.push_device_tokens enable row level security;

create policy "Users manage own device tokens"
  on public.push_device_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
