-- VaiGo: fundação do backend (versão inicial).
-- Execute manualmente no SQL Editor de um projeto Supabase de TESTES.
-- Nunca execute em produção sem revisão, migrações e testes de segurança.
create extension if not exists pgcrypto;

create type public.vaigo_ride_status as enum ('requested','accepted','arrived','in_progress','completed','cancelled');
create type public.vaigo_driver_status as enum ('offline','online','busy');

create table if not exists public.vaigo_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 2 and 100),
 phone text,
 role text not null default 'rider' check (role in ('rider','driver')),
 created_at timestamptz not null default now()
);
create table if not exists public.vaigo_drivers (
 user_id uuid primary key references public.vaigo_profiles(id) on delete cascade,
 vehicle_model text,
 vehicle_plate text,
 approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
 availability public.vaigo_driver_status not null default 'offline',
 updated_at timestamptz not null default now()
);
create table if not exists public.vaigo_rides (
 id uuid primary key default gen_random_uuid(),
 rider_id uuid not null references public.vaigo_profiles(id),
 driver_id uuid references public.vaigo_drivers(user_id),
 status public.vaigo_ride_status not null default 'requested',
 pickup_label text not null,
 pickup_lat double precision not null check (pickup_lat between -90 and 90),
 pickup_lon double precision not null check (pickup_lon between -180 and 180),
 destination_label text not null,
 destination_lat double precision not null check (destination_lat between -90 and 90),
 destination_lon double precision not null check (destination_lon between -180 and 180),
 pickup_verified_manually boolean not null default false,
 destination_verified_manually boolean not null default false,
 estimated_fare_cents integer not null check (estimated_fare_cents >= 0),
 offered_driver_cents integer not null check (offered_driver_cents >= 0),
 created_at timestamptz not null default now(),
 accepted_at timestamptz,
 started_at timestamptz,
 completed_at timestamptz
);
create index if not exists vaigo_rides_rider_created on public.vaigo_rides(rider_id,created_at desc);
create index if not exists vaigo_rides_driver_status on public.vaigo_rides(driver_id,status);
create table if not exists public.vaigo_driver_locations (
 driver_id uuid primary key references public.vaigo_drivers(user_id) on delete cascade,
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 accuracy_m double precision check (accuracy_m>=0),
 updated_at timestamptz not null default now()
);

alter table public.vaigo_profiles enable row level security;
alter table public.vaigo_drivers enable row level security;
alter table public.vaigo_rides enable row level security;
alter table public.vaigo_driver_locations enable row level security;

-- Políticas de leitura limitadas ao titular e aos participantes da corrida.
create policy vaigo_profiles_self_read on public.vaigo_profiles for select to authenticated using (id=auth.uid());
create policy vaigo_profiles_self_insert on public.vaigo_profiles for insert to authenticated with check (id=auth.uid() and role='rider');
create policy vaigo_drivers_self_read on public.vaigo_drivers for select to authenticated using (user_id=auth.uid());
create policy vaigo_rides_participant_read on public.vaigo_rides for select to authenticated using (rider_id=auth.uid() or driver_id=auth.uid());
create policy vaigo_locations_self_read on public.vaigo_driver_locations for select to authenticated using (driver_id=auth.uid());

-- Sem políticas de INSERT/UPDATE em corridas pelo cliente:
-- criação, aceite atômico, OTP e mudanças de status deverão passar por endpoints
-- autenticados no servidor, com autorização e validação de estado.
-- Sem políticas de SELECT global de posições dos motoristas: exposição futura
-- deve ser restrita a corridas autorizadas via serviço de localização.
