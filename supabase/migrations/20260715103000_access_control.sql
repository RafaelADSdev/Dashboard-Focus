-- Gestão de acesso: papéis, perfis e páginas do dashboard

create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order int not null default 0
);

insert into public.app_roles (slug, name, sort_order) values
  ('superintendente', 'Superintendente', 1),
  ('administrador', 'Administrador', 2),
  ('diretor', 'Diretor', 3),
  ('lider', 'Líder', 4)
on conflict (slug) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

create table if not exists public.dashboard_pages (
  key text primary key,
  label text not null,
  sort_order int not null default 0
);

insert into public.dashboard_pages (key, label, sort_order) values
  ('overview', 'Visão Geral', 1),
  ('team:elite', 'Focus Elite', 2),
  ('team:lider', 'Focus Líder', 3),
  ('team:total', 'Focus Total', 4)
on conflict (key) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role_id uuid not null references public.app_roles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_page_access (
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  page_key text not null references public.dashboard_pages (key) on delete cascade,
  primary key (user_id, page_key)
);

create index if not exists user_profiles_role_id_idx on public.user_profiles (role_id);
create index if not exists user_page_access_page_key_idx on public.user_page_access (page_key);

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    join public.app_roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.slug = 'administrador'
  );
$$;

revoke all on function public.is_administrator() from public;
grant execute on function public.is_administrator() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id from public.app_roles where slug = 'lider' limit 1;

  insert into public.user_profiles (id, email, full_name, role_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    default_role_id
  )
  on conflict (id) do nothing;

  insert into public.user_page_access (user_id, page_key)
  values (new.id, 'overview')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

alter table public.app_roles enable row level security;
alter table public.dashboard_pages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_page_access enable row level security;

drop policy if exists "app_roles_read_authenticated" on public.app_roles;
create policy "app_roles_read_authenticated"
  on public.app_roles
  for select
  to authenticated
  using (true);

drop policy if exists "dashboard_pages_read_authenticated" on public.dashboard_pages;
create policy "dashboard_pages_read_authenticated"
  on public.dashboard_pages
  for select
  to authenticated
  using (true);

drop policy if exists "user_profiles_read_own_or_admin" on public.user_profiles;
create policy "user_profiles_read_own_or_admin"
  on public.user_profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_administrator());

drop policy if exists "user_profiles_update_admin" on public.user_profiles;
create policy "user_profiles_update_admin"
  on public.user_profiles
  for update
  to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());

drop policy if exists "user_profiles_insert_admin" on public.user_profiles;
create policy "user_profiles_insert_admin"
  on public.user_profiles
  for insert
  to authenticated
  with check (public.is_administrator());

drop policy if exists "user_page_access_read_own_or_admin" on public.user_page_access;
create policy "user_page_access_read_own_or_admin"
  on public.user_page_access
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_administrator());

drop policy if exists "user_page_access_write_admin" on public.user_page_access;
create policy "user_page_access_write_admin"
  on public.user_page_access
  for all
  to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());

-- Perfis para usuários já existentes antes da migration
insert into public.user_profiles (id, email, full_name, role_id)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  (select id from public.app_roles where slug = 'lider' limit 1)
from auth.users u
where not exists (
  select 1 from public.user_profiles p where p.id = u.id
);

insert into public.user_page_access (user_id, page_key)
select p.id, 'overview'
from public.user_profiles p
where not exists (
  select 1 from public.user_page_access a where a.user_id = p.id
);

-- O bootstrap administrativo é definido em runtime exclusivamente por
-- VITE_ADMIN_EMAILS, sem contas pessoais fixadas nesta migration.
