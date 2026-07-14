create extension if not exists "pgcrypto";

create table if not exists public.project_workspaces (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_name text not null,
  workspace jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_workspaces enable row level security;

create policy "Users manage their workspaces"
on public.project_workspaces for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  gate_id text not null check (gate_id in ('user','pain','alternative','acquisition','payment','delivery')),
  slug text not null unique,
  title text not null,
  introduction text not null default '',
  questions jsonb not null,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  answers jsonb not null,
  contact text,
  consent_to_contact boolean not null default false,
  submitted_at timestamptz not null default now()
);

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;

create policy "Owners manage surveys" on public.surveys for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Anyone reads published surveys" on public.surveys for select
using (status = 'published');
create policy "Anyone submits published surveys" on public.survey_responses for insert
with check (exists (select 1 from public.surveys where surveys.id = survey_id and surveys.status = 'published'));
create policy "Owners read survey responses" on public.survey_responses for select
using (exists (select 1 from public.surveys where surveys.id = survey_id and surveys.user_id = auth.uid()));
