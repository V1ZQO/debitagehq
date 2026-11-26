-- =====================================================================
--  DebitageHQ 0.4.0 : réactions emoji et images dans la discussion
--  À coller dans Supabase > SQL Editor puis « Run ».
--  Tu peux le relancer sans risque : il ne supprime aucune donnée.
-- =====================================================================

-- ---------- Images dans la discussion et les messages privés ----------
alter table public.messages add column if not exists img text;
alter table public.dms add column if not exists img text;

do $$
begin
  alter table public.messages add constraint messages_img_ok check (img is null or img like 'chat/%');
exception when duplicate_object then null;
end $$;

-- Un message privé peut maintenant être juste une image (sans texte)
alter table public.dms drop constraint if exists dms_body_check;
do $$
begin
  alter table public.dms add constraint dms_body_ok
    check (char_length(body) <= 4000 and (char_length(body) >= 1 or img is not null));
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.dms add constraint dms_img_ok check (img is null or img like 'chat/%');
exception when duplicate_object then null;
end $$;

-- ---------- Réactions emoji ----------
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  msg uuid references public.messages on delete cascade,
  dm uuid references public.dms on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  at timestamptz not null default now(),
  check ((msg is null) <> (dm is null))
);
create unique index if not exists reactions_unique on public.reactions (coalesce(msg, dm), user_id, emoji);
create index if not exists reactions_msg on public.reactions (msg);
create index if not exists reactions_dm on public.reactions (dm);
alter table public.reactions enable row level security;

-- Réactions sur un message privé : visibles seulement par les 2 personnes de la conversation
drop policy if exists "réactions lire" on public.reactions;
create policy "réactions lire" on public.reactions for select using (
  public.is_member() and (
    msg is not null
    or exists (select 1 from public.dms d where d.id = dm and (d.sender = auth.uid() or d.recipient = auth.uid()))
  ));

drop policy if exists "réactions ajouter" on public.reactions;
create policy "réactions ajouter" on public.reactions for insert with check (
  public.is_member() and user_id = auth.uid() and (
    msg is not null
    or exists (select 1 from public.dms d where d.id = dm and (d.sender = auth.uid() or d.recipient = auth.uid()))
  ));

drop policy if exists "réactions retirer" on public.reactions;
create policy "réactions retirer" on public.reactions for delete using (user_id = auth.uid());

-- Temps réel
do $$
begin
  alter publication supabase_realtime add table public.reactions;
exception when duplicate_object then null;
end $$;
