-- Páginas das equipes da esteira Econômico (Primeira Chave)

insert into public.dashboard_pages (key, label, sort_order) values
  ('team:imparaveis', 'Imparáveis', 5),
  ('team:domina', 'Domina', 6),
  ('team:legado', 'Legado', 7),
  ('team:lobos', 'Lobos', 8)
on conflict (key) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;
