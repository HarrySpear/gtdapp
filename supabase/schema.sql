-- Run this in the Supabase SQL editor. Safe to re-run over the original schema:
-- everything here is additive or idempotent, and no rows are dropped.

-- ---------------------------------------------------------------- projects --
-- A project is anything needing more than one action. It holds the outcome;
-- the actions live in `items` and point back here.

create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  description  text,
  outcome      text,                       -- what "done" actually looks like
  status       text not null default 'active'
                 check (status in ('active', 'someday', 'done')),
  reviewed_at  timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_user_created_idx
  on projects (user_id, created_at desc);

alter table projects enable row level security;

drop policy if exists "own projects" on projects;
create policy "own projects" on projects
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------- items --

alter table items add column if not exists project_id   uuid references projects (id) on delete set null;
alter table items add column if not exists context      text;        -- @calls, @computer, …
alter table items add column if not exists due_date     date;        -- when it must be done by
alter table items add column if not exists waiting_on   text;        -- who owes you this
alter table items add column if not exists notes        text;
alter table items add column if not exists completed_at timestamptz;

-- 'someday' survives as a parking bay, but it no longer has a tab of its own —
-- items land there during clarify and only resurface in the weekly review.
alter table items drop constraint if exists items_status_check;
alter table items add constraint items_status_check
  check (status in ('inbox', 'next', 'waiting', 'someday', 'done'));

-- A waiting-for is only meaningful if you know who you are waiting on.
alter table items drop constraint if exists items_waiting_needs_owner;
alter table items add constraint items_waiting_needs_owner
  check (status <> 'waiting' or length(btrim(coalesce(waiting_on, ''))) > 0);

create index if not exists items_user_status_idx  on items (user_id, status);
create index if not exists items_project_idx      on items (project_id) where project_id is not null;
create index if not exists items_due_idx          on items (user_id, due_date) where due_date is not null;

-- Stamp completed_at automatically so "done" always carries its date.
create or replace function set_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and coalesce(old.status, '') <> 'done' then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end $$;

drop trigger if exists items_set_completed_at on items;
create trigger items_set_completed_at
  before insert or update on items
  for each row execute function set_completed_at();

-- ----------------------------------------------------------------- reviews --
-- One row per completed weekly review, so the app can say how long it has been.

create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  completed_at timestamptz not null default now()
);

create index if not exists reviews_user_idx on reviews (user_id, completed_at desc);

alter table reviews enable row level security;

drop policy if exists "own reviews" on reviews;
create policy "own reviews" on reviews
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
