-- LOCKIN Initial Schema

-- Profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timer_duration int default 25,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  next_action text,
  objective text,
  status text default 'active' check (status in ('active', 'paused', 'shipped')),
  priority text default 'medium' check (priority in ('high', 'medium', 'low')),
  notes text,
  context_dump text,
  estimated_minutes int default 0,
  total_minutes int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;

create policy "Users can view own projects" on projects
  for select using (auth.uid() = user_id);
create policy "Users can insert own projects" on projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on projects
  for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on projects
  for delete using (auth.uid() = user_id);

-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  duration int not null,
  estimated int,
  action text,
  date date not null,
  created_at timestamptz default now()
);

alter table sessions enable row level security;

create policy "Users can view own sessions" on sessions
  for select using (auth.uid() = user_id);
create policy "Users can insert own sessions" on sessions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on sessions
  for update using (auth.uid() = user_id);
create policy "Users can delete own sessions" on sessions
  for delete using (auth.uid() = user_id);

-- Daily Plans
create table daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  planned_project_ids uuid[],
  estimates jsonb,
  committed boolean default false,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table daily_plans enable row level security;

create policy "Users can view own daily plans" on daily_plans
  for select using (auth.uid() = user_id);
create policy "Users can insert own daily plans" on daily_plans
  for insert with check (auth.uid() = user_id);
create policy "Users can update own daily plans" on daily_plans
  for update using (auth.uid() = user_id);
create policy "Users can delete own daily plans" on daily_plans
  for delete using (auth.uid() = user_id);

-- Shutdown Log
create table shutdown_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  completed boolean default true,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table shutdown_log enable row level security;

create policy "Users can view own shutdown logs" on shutdown_log
  for select using (auth.uid() = user_id);
create policy "Users can insert own shutdown logs" on shutdown_log
  for insert with check (auth.uid() = user_id);
create policy "Users can update own shutdown logs" on shutdown_log
  for update using (auth.uid() = user_id);
create policy "Users can delete own shutdown logs" on shutdown_log
  for delete using (auth.uid() = user_id);
