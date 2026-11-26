-- =====================================================================
--  DEBITAGEHQ : mise à jour du serveur (messages privés, espaces Serveur / Cheat)
--  À coller une seule fois dans Supabase > SQL Editor, puis Run.
--  Sans risque : ne supprime rien et peut être relancé.
-- =====================================================================

-- « Vu pour la dernière fois » des membres
alter table public.members add column if not exists last_seen timestamptz;

-- Messages privés : seuls l'expéditeur et le destinataire peuvent les lire
create table if not exists public.dms (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null default auth.uid() references auth.users on delete cascade,
  recipient uuid not null references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists dms_pair on public.dms (sender, recipient, at desc);
create index if not exists dms_recipient on public.dms (recipient, at desc);
alter table public.dms enable row level security;

drop policy if exists "dm lire" on public.dms;
create policy "dm lire" on public.dms for select
  using (public.is_member() and (sender = auth.uid() or recipient = auth.uid()));

drop policy if exists "dm envoyer" on public.dms;
create policy "dm envoyer" on public.dms for insert
  with check (public.is_member() and sender = auth.uid()
              and exists (select 1 from public.members m where m.user_id = recipient));

drop policy if exists "dm marquer lu" on public.dms;
create policy "dm marquer lu" on public.dms for update
  using (recipient = auth.uid()) with check (recipient = auth.uid());

drop policy if exists "dm supprimer" on public.dms;
create policy "dm supprimer" on public.dms for delete using (sender = auth.uid());

-- Le destinataire ne peut modifier que la date de lecture, jamais le texte
revoke update on public.dms from authenticated, anon;
grant update (read_at) on public.dms to authenticated;

-- Temps réel
do $$
begin
  alter publication supabase_realtime add table public.dms;
exception when duplicate_object then null;
end $$;


-- Deux espaces séparés : Serveur GTA 6 et Cheat (les données existantes vont dans Serveur)
do $$
declare t text;
begin
  foreach t in array array['files','tasks','events','notes','messages'] loop
    execute format('alter table public.%I add column if not exists space text not null default ''serveur''', t);
    begin
      execute format('alter table public.%I add constraint %I check (space in (''serveur'',''cheat''))', t, t || '_space_ok');
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- C'est fini !
