-- ============================================================
-- Migration 0003: Remove 'administrador' + supervisor_id + análise status
-- ============================================================

-- 1. Consolidar administradores existentes em sócios (se houver)
update profiles set role = 'socio' where role = 'administrador';

-- 2. CHECK constraint no role (coluna é text, não enum)
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('socio', 'advogado', 'assistente', 'cliente_owner', 'cliente_member'));

-- 3. Atualizar helpers RLS (remover 'administrador')
create or replace function public.is_internal_user() returns boolean
  language sql security definer stable as $$
    select current_user_role() in ('socio','advogado','assistente')
$$;

create or replace function public.is_admin_user() returns boolean
  language sql security definer stable as $$
    select current_user_role() = 'socio'
$$;

-- 4. Adicionar supervisor_id em profiles
alter table profiles add column if not exists supervisor_id uuid references profiles(id) on delete set null;
create index if not exists idx_profiles_supervisor on profiles(supervisor_id);

-- Constraint: estagiário OBRIGATORIAMENTE tem supervisor
create or replace function public.check_assistente_has_supervisor() returns trigger
  language plpgsql as $$
begin
  if new.role = 'assistente' and new.supervisor_id is null then
    raise exception 'Estagiário (role=assistente) precisa ter um supervisor definido';
  end if;
  return new;
end; $$;

drop trigger if exists ensure_assistente_supervisor on profiles;
create trigger ensure_assistente_supervisor
  before insert or update of role, supervisor_id on profiles
  for each row execute function public.check_assistente_has_supervisor();

-- Constraint: supervisor tem que ser advogado ou sócio (e ativo)
create or replace function public.check_supervisor_is_lawyer() returns trigger
  language plpgsql as $$
declare
  v_supervisor_role text;
begin
  if new.supervisor_id is null then return new; end if;
  select role into v_supervisor_role from profiles where id = new.supervisor_id;
  if v_supervisor_role not in ('advogado', 'socio') then
    raise exception 'Supervisor precisa ser advogado ou sócio (é: %)', v_supervisor_role;
  end if;
  return new;
end; $$;

drop trigger if exists ensure_supervisor_is_lawyer on profiles;
create trigger ensure_supervisor_is_lawyer
  before insert or update of supervisor_id on profiles
  for each row execute function public.check_supervisor_is_lawyer();

-- 5. Novos status de análise
alter table contract_analyses drop constraint if exists contract_analyses_status_check;
alter table contract_analyses add constraint contract_analyses_status_check
  check (status in (
    'processando',
    'rascunho_estagiario',
    'aguardando_revisao',
    'rascunho',
    'finalizado',
    'falhou'
  ));

-- 6. Campos de revisão em contract_analyses
alter table contract_analyses
  add column if not exists reviewer_id uuid references profiles(id) on delete set null,
  add column if not exists submitted_for_review_at timestamptz,
  add column if not exists reviewed_at timestamptz;

create index if not exists idx_analyses_reviewer on contract_analyses(reviewer_id);
