-- Run this once in the Supabase SQL editor.

create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (length(btrim(title)) > 0),
  status      text not null default 'inbox'
                check (status in ('inbox', 'next', 'waiting', 'someday', 'done')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists items_user_created_idx
  on items (user_id, created_at desc);

-- Row-level security: an item is only ever visible to the account that wrote it.
alter table items enable row level security;

drop policy if exists "own items" on items;
create policy "own items" on items
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at honest.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists items_set_updated_at on items;
create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();
