-- Esteiras (pipelines Bitrix) visíveis por usuário

create table if not exists public.dashboard_pipelines (
  key text primary key,
  label text not null,
  bitrix_category_id int not null,
  sort_order int not null default 0
);

insert into public.dashboard_pipelines (key, label, bitrix_category_id, sort_order) values
  ('comercial_geral', 'Comercial Geral', 16, 1),
  ('economico', 'Econômico', 64, 2)
on conflict (key) do update
  set label = excluded.label,
      bitrix_category_id = excluded.bitrix_category_id,
      sort_order = excluded.sort_order;

alter table public.user_profiles
  add column if not exists pipeline_key text references public.dashboard_pipelines (key) default 'comercial_geral';

update public.user_profiles
set pipeline_key = 'comercial_geral'
where pipeline_key is null;

alter table public.user_profiles
  alter column pipeline_key set default 'comercial_geral';

alter table public.dashboard_pipelines enable row level security;

drop policy if exists "dashboard_pipelines_read_authenticated" on public.dashboard_pipelines;
create policy "dashboard_pipelines_read_authenticated"
  on public.dashboard_pipelines
  for select
  to authenticated
  using (true);
