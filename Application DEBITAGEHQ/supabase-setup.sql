-- =====================================================================
--  LE QG : installation du serveur (à coller dans Supabase > SQL Editor)
--  Tu peux le relancer sans risque : il ne supprime aucune donnée.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Code secret de l'équipe ----------
-- Seules les personnes qui ont ce code peuvent rejoindre l'équipe.
-- Remplace REMPLACE-MOI... par ton propre code avant de lancer le script.
-- ATTENTION : si ton équipe existe déjà, remets ton code actuel, sinon les invitations changent.
create table if not exists public.team_secret (
  id int primary key default 1,
  secret text not null
);
insert into public.team_secret (id, secret) values (1, 'REMPLACE-MOI-PAR-UN-CODE-SECRET')
  on conflict (id) do update set secret = excluded.secret;
alter table public.team_secret enable row level security;  -- personne ne peut le lire

-- ---------- Membres ----------
create table if not exists public.members (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  joined_at timestamptz not null default now()
);
alter table public.members enable row level security;

create or replace function public.is_member() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid())
$$;

create or replace function public.join_team(code text, display_name text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if not exists (select 1 from public.team_secret where secret = code) then return false; end if;
  insert into public.members (user_id, name)
    values (auth.uid(), left(coalesce(nullif(trim(display_name), ''), 'Membre'), 40))
    on conflict (user_id) do nothing;
  return true;
end $$;
revoke all on function public.join_team(text, text) from anon;
grant execute on function public.join_team(text, text) to authenticated;

drop policy if exists "membres lisent" on public.members;
create policy "membres lisent" on public.members for select using (public.is_member());
drop policy if exists "chacun son nom" on public.members;
create policy "chacun son nom" on public.members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Données de l'équipe ----------
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text not null default 'upload',
  path text, url text, size bigint, type text, folder text default 'Autre',
  author uuid default auth.uid(), at timestamptz not null default now()
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, descr text default '', tag text default 'Autre', prio text default 'Normale',
  assignee uuid, status text not null default 'todo',
  author uuid default auth.uid(), at timestamptz not null default now(), upd timestamptz default now()
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null, ev_date date not null, ev_time text default '', place text default '', descr text default '',
  going uuid[] not null default '{}',
  author uuid default auth.uid(), at timestamptz not null default now()
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Sans titre', tag text default 'Idée', body text default '',
  author uuid default auth.uid(), upd_by uuid default auth.uid(),
  at timestamptz not null default now(), upd timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) <= 4000),
  author uuid default auth.uid(), at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['files','tasks','events','notes','messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "membres" on public.%I', t);
    execute format('create policy "membres" on public.%I for all using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

-- ---------- Temps réel ----------
do $$
declare t text;
begin
  foreach t in array array['files','tasks','events','notes','messages','members'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- Stockage des fichiers (50 Mo max par fichier) ----------
insert into storage.buckets (id, name, public, file_size_limit)
  values ('files', 'files', false, 52428800)
  on conflict (id) do nothing;

drop policy if exists "qg lire" on storage.objects;
create policy "qg lire" on storage.objects for select using (bucket_id = 'files' and public.is_member());
drop policy if exists "qg envoyer" on storage.objects;
create policy "qg envoyer" on storage.objects for insert with check (bucket_id = 'files' and public.is_member());
drop policy if exists "qg supprimer" on storage.objects;
create policy "qg supprimer" on storage.objects for delete using (bucket_id = 'files' and public.is_member());

-- C'est fini ! Retourne dans l'application Le QG.
