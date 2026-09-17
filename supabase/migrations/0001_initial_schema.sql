-- ============================================================
-- SEU CONTRATO — Migration 0001: multi-tenant base + bug fix
-- Incremental: assume que profiles, contracts, clients, audit_log
-- e demais tabelas de contratos JÁ EXISTEM.
-- ============================================================

-- ── 1. Tabela de planos ──────────────────────────────────────
create table if not exists plans (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  text not null unique check (tipo in ('individual','enterprise')),
  nome                  text not null,
  limite_colaboradores  int not null,
  creditos_mensais      int not null,
  preco_mensal          numeric(10,2) not null,
  created_at            timestamptz not null default now()
);

insert into plans (tipo, nome, limite_colaboradores, creditos_mensais, preco_mensal)
values
  ('individual', 'Individual', 1,  50,  99.00),
  ('enterprise', 'Enterprise', 10, 500, 599.00)
on conflict (tipo) do nothing;

-- ── 2. Tabela de workspaces (empresas-clientes) ──────────────
create table if not exists workspaces (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cnpj        text,
  owner_id    uuid references auth.users(id) on delete restrict,
  plan_id     uuid references plans(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_workspaces_owner on workspaces(owner_id);

-- ── 3. Adicionar workspace_id em profiles ────────────────────
alter table profiles
  add column if not exists workspace_id uuid references workspaces(id) on delete set null;

create index if not exists idx_profiles_workspace on profiles(workspace_id);
create index if not exists idx_profiles_role on profiles(role);

-- ── 4. Helper functions para RLS ─────────────────────────────
create or replace function public.current_user_role() returns text
  language sql security definer stable as $$
    select role from profiles where id = auth.uid()
$$;

create or replace function public.current_user_workspace() returns uuid
  language sql security definer stable as $$
    select workspace_id from profiles where id = auth.uid()
$$;

create or replace function public.is_internal_user() returns boolean
  language sql security definer stable as $$
    select current_user_role() in ('socio','administrador','advogado','assistente')
$$;

create or replace function public.is_admin_user() returns boolean
  language sql security definer stable as $$
    select current_user_role() in ('socio','administrador')
$$;

create or replace function public.is_client_user() returns boolean
  language sql security definer stable as $$
    select current_user_role() in ('cliente_owner','cliente_member')
$$;

create or replace function public.is_workspace_owner() returns boolean
  language sql security definer stable as $$
    select current_user_role() = 'cliente_owner'
$$;

-- ── 5. FIX DO BUG: trigger handle_new_user lê role de user_metadata ──
-- Substitui a versão antiga que fazia default = 'assistente' hardcoded.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'assistente')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role      = excluded.role;
  return new;
end;
$$;

-- Recria o trigger (drop + create para garantir)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 6. Trigger auto-criação de workspace para cliente_owner ──
create or replace function public.handle_new_client_workspace() returns trigger
  language plpgsql security definer as $$
declare
  v_workspace_id uuid;
  v_empresa      text;
  v_cnpj         text;
  v_default_plan uuid;
begin
  -- Só cria workspace para cliente_owner
  if new.role <> 'cliente_owner' then
    return new;
  end if;

  -- Só cria se ainda não tem workspace
  if new.workspace_id is not null then
    return new;
  end if;

  select
    coalesce(raw_user_meta_data->>'empresa', new.full_name || ' (empresa)'),
    raw_user_meta_data->>'cnpj'
  into v_empresa, v_cnpj
  from auth.users where id = new.id;

  select id into v_default_plan from plans where tipo = 'individual' limit 1;

  insert into workspaces (nome, cnpj, owner_id, plan_id)
  values (v_empresa, v_cnpj, new.id, v_default_plan)
  returning id into v_workspace_id;

  update profiles set workspace_id = v_workspace_id where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_client_owner_created on profiles;
create trigger on_client_owner_created
  after insert on profiles
  for each row execute function public.handle_new_client_workspace();

-- ── 7. RLS para workspaces e plans ───────────────────────────
alter table workspaces enable row level security;

drop policy if exists "Internal users read all workspaces" on workspaces;
create policy "Internal users read all workspaces"
  on workspaces for select to authenticated
  using (is_internal_user());

drop policy if exists "Client users read own workspace" on workspaces;
create policy "Client users read own workspace"
  on workspaces for select to authenticated
  using (id = current_user_workspace());

drop policy if exists "Admins manage workspaces" on workspaces;
create policy "Admins manage workspaces"
  on workspaces for all to authenticated
  using (is_admin_user());

drop policy if exists "Workspace owner updates own workspace" on workspaces;
create policy "Workspace owner updates own workspace"
  on workspaces for update to authenticated
  using (owner_id = auth.uid());

alter table plans enable row level security;

drop policy if exists "Anyone reads plans" on plans;
create policy "Anyone reads plans"
  on plans for select to authenticated using (true);

drop policy if exists "Admins manage plans" on plans;
create policy "Admins manage plans"
  on plans for all to authenticated
  using (is_admin_user());

-- ── 8. updated_at trigger para workspaces ────────────────────
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_updated_at on workspaces;
create trigger workspaces_updated_at
  before update on workspaces
  for each row execute function public.set_updated_at();

-- ── 9. Reparo de dados existentes ────────────────────────────
-- Se algum usuário foi criado via cadastro cliente antes deste fix,
-- seu profile ficou com role='assistente' (bug). Restaura a partir
-- do user_metadata.role de auth.users.

do $$
declare
  r record;
  v_workspace_id uuid;
  v_default_plan uuid;
begin
  select id into v_default_plan from plans where tipo = 'individual' limit 1;

  for r in
    select
      u.id,
      u.email,
      u.raw_user_meta_data->>'role'    as metadata_role,
      u.raw_user_meta_data->>'empresa' as empresa,
      u.raw_user_meta_data->>'cnpj'    as cnpj,
      p.role                            as current_role,
      p.workspace_id
    from auth.users u
    join profiles p on p.id = u.id
    where u.raw_user_meta_data->>'role' in ('cliente_owner','cliente_member')
      and p.role <> (u.raw_user_meta_data->>'role')
  loop
    -- Corrige o role
    update profiles set role = r.metadata_role where id = r.id;

    -- Se cliente_owner sem workspace, cria
    if r.metadata_role = 'cliente_owner' and r.workspace_id is null then
      insert into workspaces (nome, cnpj, owner_id, plan_id)
      values (
        coalesce(r.empresa, 'Empresa de ' || r.email),
        r.cnpj,
        r.id,
        v_default_plan
      )
      returning id into v_workspace_id;

      update profiles set workspace_id = v_workspace_id where id = r.id;
    end if;
  end loop;
end $$;
