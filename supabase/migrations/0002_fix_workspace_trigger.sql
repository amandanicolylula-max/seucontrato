-- ============================================================
-- Migration 0002: Unifica criação de profile + workspace em um trigger só
-- Fix para o erro "Database error creating new user" que aparecia ao
-- tentar registrar cliente_owner.
-- ============================================================

-- Remove o trigger de cascata que estava causando o problema
drop trigger if exists on_client_owner_created on profiles;
drop function if exists public.handle_new_client_workspace();

-- Recria handle_new_user fazendo TUDO num só bloco atômico
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
declare
  v_role         text;
  v_full_name    text;
  v_empresa      text;
  v_cnpj         text;
  v_default_plan uuid;
  v_workspace_id uuid;
begin
  v_role      := coalesce(new.raw_user_meta_data->>'role', 'assistente');
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_empresa   := new.raw_user_meta_data->>'empresa';
  v_cnpj      := new.raw_user_meta_data->>'cnpj';

  -- Se for cliente_owner, cria workspace primeiro (para ter o id)
  if v_role = 'cliente_owner' then
    select id into v_default_plan from public.plans where tipo = 'individual' limit 1;

    insert into public.workspaces (nome, cnpj, owner_id, plan_id)
    values (
      coalesce(v_empresa, v_full_name || ' (empresa)'),
      v_cnpj,
      new.id,
      v_default_plan
    )
    returning id into v_workspace_id;
  end if;

  -- Insere/atualiza profile
  insert into public.profiles (id, full_name, email, role, workspace_id)
  values (new.id, v_full_name, new.email, v_role, v_workspace_id)
  on conflict (id) do update
    set full_name    = excluded.full_name,
        role         = excluded.role,
        workspace_id = coalesce(excluded.workspace_id, profiles.workspace_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
