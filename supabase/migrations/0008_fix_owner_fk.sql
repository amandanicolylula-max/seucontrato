-- ============================================================
-- Migration 0008: Fix FK workspaces.owner_id → profiles.id
-- (era auth.users; PostgREST não conseguia embed profiles em workspaces)
-- Também reordena handle_new_user para inserir profile antes de workspace
-- ============================================================

-- 1. Verificação de integridade retroativa
do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
  from workspaces w
  where not exists (select 1 from profiles p where p.id = w.owner_id);

  if v_orphans > 0 then
    raise exception 'Existem % workspace(s) cujo owner_id não bate com nenhum profile. Aborta.', v_orphans;
  end if;
end $$;

-- 2. Drop FK antigo (para auth.users) e cria novo (para profiles)
alter table workspaces drop constraint if exists workspaces_owner_id_fkey;

alter table workspaces
  add constraint workspaces_owner_id_fkey
  foreign key (owner_id) references profiles(id) on delete restrict;

-- 3. Reescreve handle_new_user com ordem correta: profile PRIMEIRO
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

  -- 1) Insere/atualiza profile primeiro (sem workspace_id ainda)
  insert into public.profiles (id, full_name, email, role)
  values (new.id, v_full_name, new.email, v_role)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role      = excluded.role;

  -- 2) Se cliente_owner, cria workspace agora (FK owner_id → profiles.id já vai bater)
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

    -- 3) Atualiza o profile agora com workspace_id
    update public.profiles set workspace_id = v_workspace_id where id = new.id;
  end if;

  return new;
end;
$$;

-- Trigger não precisa ser recriado (o nome/target não mudou)
