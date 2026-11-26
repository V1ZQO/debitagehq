-- =====================================================================
--  DebitageHQ 0.5.2 : notes sur les tâches
--  À coller dans Supabase > SQL Editor puis « Run ».
--  Tu peux le relancer sans risque : il ne supprime aucune donnée.
--  (Si ce n'est pas déjà fait, lance aussi supabase-update-0.5.sql.)
-- =====================================================================

create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task uuid not null references public.tasks on delete cascade,
  author uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  at timestamptz not null default now()
);
create index if not exists task_notes_task on public.task_notes (task, at);
alter table public.task_notes enable row level security;

-- Toute l'équipe peut lire et ajouter des notes ; chacun ne supprime que les siennes
drop policy if exists "notes de tâche lire" on public.task_notes;
create policy "notes de tâche lire" on public.task_notes for select using (public.is_member());
drop policy if exists "notes de tâche ajouter" on public.task_notes;
create policy "notes de tâche ajouter" on public.task_notes for insert with check (public.is_member() and author = auth.uid());
drop policy if exists "notes de tâche retirer" on public.task_notes;
create policy "notes de tâche retirer" on public.task_notes for delete using (author = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.task_notes;
exception when duplicate_object then null;
end $$;
