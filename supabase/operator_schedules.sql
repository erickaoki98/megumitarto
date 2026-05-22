-- Tabela da Escala Semanal de operadores (recorrente, por dia da semana).
-- Rode este SQL no painel do Supabase: SQL Editor > New query > Run.
-- day_of_week segue a convenção do JavaScript: 0 = Domingo ... 6 = Sábado.
-- Atendimento das 08:00 às 23:30 (validado no front-end).

create table if not exists public.operator_schedules (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint operator_schedules_day_uniq unique (operator_id, day_of_week),
  constraint operator_schedules_time_chk check (start_time < end_time)
);

alter table public.operator_schedules enable row level security;

-- Qualquer usuário autenticado pode ler a escala.
drop policy if exists "operator_schedules_select" on public.operator_schedules;
create policy "operator_schedules_select"
  on public.operator_schedules
  for select
  to authenticated
  using (true);

-- Apenas administradores podem criar/alterar/excluir.
drop policy if exists "operator_schedules_admin_write" on public.operator_schedules;
create policy "operator_schedules_admin_write"
  on public.operator_schedules
  for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
