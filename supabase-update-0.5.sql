-- =====================================================================
--  DebitageHQ 0.5.0 : profils des membres (photo, rôle, bio)
--  À coller dans Supabase > SQL Editor puis « Run ».
--  Tu peux le relancer sans risque : il ne supprime aucune donnée.
-- =====================================================================

alter table public.members add column if not exists avatar text;
alter table public.members add column if not exists role text not null default '';
alter table public.members add column if not exists bio text not null default '';

do $$
begin
  alter table public.members add constraint members_avatar_ok check (avatar is null or avatar like 'avatars/%');
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.members add constraint members_role_ok check (char_length(role) <= 40);
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.members add constraint members_bio_ok check (char_length(bio) <= 300);
exception when duplicate_object then null;
end $$;
