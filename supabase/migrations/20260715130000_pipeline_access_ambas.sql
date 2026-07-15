-- Opção "ambas as esteiras" + recarrega cache do PostgREST

insert into public.dashboard_pipelines (key, label, bitrix_category_id, sort_order) values
  ('ambas', 'Ambas as esteiras', 0, 0)
on conflict (key) do update
  set label = excluded.label,
      bitrix_category_id = excluded.bitrix_category_id,
      sort_order = excluded.sort_order;

notify pgrst, 'reload schema';
