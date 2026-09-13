-- Legacy Wireless Field Portal — database schema
-- Run this once in your Supabase project's SQL editor (Studio -> SQL Editor -> New query).

-- ---------------------------------------------------------------------
-- 1. Reps: the Field/Area Reps who log in and cover a set of doors
-- ---------------------------------------------------------------------
create table if not exists reps (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Profiles: links a Supabase Auth login to a rep + a role
--    role = 'rep'   -> can only see their own rep's doors
--    role = 'admin' -> can see everything + import data
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rep_id uuid references reps (id),
  role text not null default 'rep' check (role in ('rep', 'admin')),
  created_at timestamptz not null default now()
);

-- A SECURITY DEFINER helper so RLS policies can check "is this user an admin"
-- without recursively re-triggering RLS on the profiles table.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- A helper to get the caller's rep_id (or null)
create or replace function my_rep_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select rep_id from profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3. Doors: one row per store location, current directory info
-- ---------------------------------------------------------------------
create table if not exists doors (
  store_id text primary key,
  address text,
  city text,
  state text,
  zip text,
  market text,
  district text,
  region text,
  sub_agent_name text,
  tenure text,
  building_type text,
  open_date date,
  ma_field_rep text,
  ma_field_phone text,
  ma_field_email text,
  contact_name text,
  contact_phone text,
  rpm text,
  sm text,
  rep_id uuid references reps (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Snapshots: one row per door per day — this is what makes
--    day-over-day / week-over-week comparisons possible
-- ---------------------------------------------------------------------
create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references doors (store_id) on delete cascade,
  snapshot_date date not null,
  status text,
  last_rpm_visit date,
  last_ma_visit date,
  cur_acts numeric, cur_quota numeric, cur_pace numeric, prev_acts numeric,
  cur_fam numeric, cur_port numeric, cur_50 numeric, cur_65 numeric,
  prev_fam numeric, prev_port numeric, prev_50 numeric, prev_65 numeric,
  device_on_hand numeric, promo_on_hand numeric, low_device boolean,
  spiff_on_hand numeric, spiff_sales numeric,
  cur_2m_acts numeric, cur_2m_pay numeric, cur_3m_acts numeric, cur_3m_pay numeric,
  prev_2m_acts numeric, prev_2m_pay numeric, prev_3m_acts numeric, prev_3m_pay numeric,
  cur_fwa numeric, cur_fwa_eligible numeric, cur_fwa_looks numeric,
  prev_fwa numeric, prev_fwa_eligible numeric,
  cur_twp numeric, cur_twp_acts numeric, prev_twp numeric, prev_twp_acts numeric,
  cur_tabs numeric, prev_tabs numeric,
  prev_zu_ap_act numeric, prev_zulu numeric, prev_ap numeric,
  violations numeric,
  cur_edge_apply numeric, upgrades numeric, cur_tops numeric,
  created_at timestamptz not null default now(),
  unique (store_id, snapshot_date)
);

create index if not exists snapshots_store_date_idx on snapshots (store_id, snapshot_date desc);

-- ---------------------------------------------------------------------
-- 5. Row Level Security — this is the real access control.
--    Reps only ever see rows tied to their own rep_id. Admins see all.
-- ---------------------------------------------------------------------
alter table reps enable row level security;
alter table profiles enable row level security;
alter table doors enable row level security;
alter table snapshots enable row level security;

create policy "reps_select" on reps for select
  using (is_admin() or id = my_rep_id());

create policy "profiles_select_self" on profiles for select
  using (id = auth.uid() or is_admin());

create policy "profiles_update_self" on profiles for update
  using (id = auth.uid());

create policy "doors_select" on doors for select
  using (is_admin() or rep_id = my_rep_id());

create policy "snapshots_select" on snapshots for select
  using (
    is_admin()
    or store_id in (select store_id from doors where rep_id = my_rep_id())
  );

-- Writes (import) go through the service-role key from the server,
-- which bypasses RLS entirely — no insert/update policies are defined
-- for normal logged-in users on purpose.

-- ---------------------------------------------------------------------
-- 6. Auto-create a profile row whenever a new Auth user is created
--    (defaults to role='rep', rep_id null — assign it on /admin/assign)
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'rep');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
