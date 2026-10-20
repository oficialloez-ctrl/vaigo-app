-- VaiGo: pedido de credenciamento de motoristas (não concede acesso automaticamente).
create table if not exists public.vaigo_driver_applications (
  user_id uuid primary key references public.vaigo_profiles(id) on delete cascade,
  vehicle_model text not null check(length(trim(vehicle_model)) between 2 and 100),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.vaigo_driver_applications enable row level security;

create policy vaigo_driver_applications_self_read
  on public.vaigo_driver_applications for select to authenticated
  using(user_id=auth.uid());

create policy vaigo_driver_applications_self_apply
  on public.vaigo_driver_applications for insert to authenticated
  with check(user_id=auth.uid() and status='pending' and reviewed_at is null);

-- Sem permissão de UPDATE/DELETE por usuários: aprovações somente pelo
-- servidor administrativo, com checagens explícitas de autorização.
-- Nunca confie no papel informado pela interface ou user_metadata.
