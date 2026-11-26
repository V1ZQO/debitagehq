-- =====================================================================
--  DEBITAGEHQ : mise à jour du serveur pour la v0.3 (onglet Notifications)
--  À coller une seule fois dans Supabase > SQL Editor, puis Run.
--  Sans risque : ne supprime rien et peut être relancé.
-- =====================================================================

-- Notifications : chacun ne voit que les siennes
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient uuid not null references auth.users on delete cascade,
  actor uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('task')),
  space text not null default 'serveur' check (space in ('serveur','cheat')),
  ref uuid,
  title text not null default '' check (char_length(title) <= 200),
  at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient on public.notifications (recipient, at desc);
alter table public.notifications enable row level security;

drop policy if exists "notif lire" on public.notifications;
create policy "notif lire" on public.notifications for select using (recipient = auth.uid());

drop policy if exists "notif créer" on public.notifications;
create policy "notif créer" on public.notifications for insert
  with check (public.is_member() and actor = auth.uid() and recipient <> auth.uid()
              and exists (select 1 from public.members m where m.user_id = recipient));

drop policy if exists "notif marquer lu" on public.notifications;
create policy "notif marquer lu" on public.notifications for update
  using (recipient = auth.uid()) with check (recipient = auth.uid());

drop policy if exists "notif supprimer" on public.notifications;
create policy "notif supprimer" on public.notifications for delete using (recipient = auth.uid());

-- Le destinataire ne peut modifier que la date de lecture
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- C'est fini !
