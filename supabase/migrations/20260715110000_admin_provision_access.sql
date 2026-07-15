-- Permite ao administrador vincular acesso a um usuário já existente no Auth pelo e-mail.

create or replace function public.admin_provision_access_by_email(
  p_email text,
  p_role_id uuid,
  p_page_keys text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_page_key text;
begin
  if not public.is_administrator() then
    raise exception 'Apenas administradores podem provisionar acessos.';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'Informe um e-mail válido.';
  end if;

  if p_page_keys is null or array_length(p_page_keys, 1) is null then
    raise exception 'Selecione ao menos uma página.';
  end if;

  select id
  into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'Usuário não encontrado no Auth. Use "Criar acesso" com senha temporária.';
  end if;

  insert into public.user_profiles (id, email, role_id)
  values (v_user_id, lower(trim(p_email)), p_role_id)
  on conflict (id) do update
    set role_id = excluded.role_id,
        email = excluded.email;

  delete from public.user_page_access where user_id = v_user_id;

  foreach v_page_key in array p_page_keys loop
    insert into public.user_page_access (user_id, page_key)
    values (v_user_id, v_page_key)
    on conflict do nothing;
  end loop;

  return v_user_id;
end;
$$;

revoke all on function public.admin_provision_access_by_email(text, uuid, text[]) from public;
grant execute on function public.admin_provision_access_by_email(text, uuid, text[]) to authenticated;
