-- ============================================================
-- Migration 0007: Auditoria multi-tenant (só sócio lê)
-- ============================================================

-- 1. Adiciona colunas workspace_id + scope
alter table audit_log
  add column if not exists workspace_id uuid references workspaces(id) on delete set null,
  add column if not exists scope        text not null default 'internal' check (scope in ('internal','client'));

create index if not exists idx_audit_workspace on audit_log(workspace_id, created_at desc);
create index if not exists idx_audit_scope on audit_log(scope);

-- 2. Function helper para logs
create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_workspace_id uuid,
  p_old jsonb default null,
  p_new jsonb default null
) returns void language plpgsql security definer as $$
begin
  insert into audit_log (user_id, action, entity_type, entity_id, workspace_id, scope, old_data, new_data)
  values (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_workspace_id,
    case when p_workspace_id is null then 'internal' else 'client' end,
    p_old,
    p_new
  );
end; $$;

-- 3. RLS: só sócio lê audit_log (advogado NÃO acessa)
alter table audit_log enable row level security;

drop policy if exists "Only socio reads audit" on audit_log;
create policy "Only socio reads audit"
  on audit_log for select to authenticated
  using (is_admin_user());

-- 4. Trigger genérico de auditoria para tabelas críticas
create or replace function public.audit_row_change() returns trigger
  language plpgsql security definer as $$
declare
  v_action text;
  v_workspace_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_entity_id uuid;
begin
  if TG_OP = 'INSERT' then
    v_action := 'create';
    v_new := to_jsonb(NEW);
    v_entity_id := NEW.id;
    v_workspace_id := (case when to_jsonb(NEW) ? 'workspace_id' then (NEW.workspace_id)::uuid else null end);
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_entity_id := NEW.id;
    v_workspace_id := (case when to_jsonb(NEW) ? 'workspace_id' then (NEW.workspace_id)::uuid else null end);
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_entity_id := OLD.id;
    v_workspace_id := (case when to_jsonb(OLD) ? 'workspace_id' then (OLD.workspace_id)::uuid else null end);
  end if;

  perform public.log_audit(v_action, TG_TABLE_NAME, v_entity_id, v_workspace_id, v_old, v_new);

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end; $$;

-- 5. Aplicar triggers nas tabelas de negócio principais
drop trigger if exists audit_contracts on contracts;
create trigger audit_contracts
  after insert or update or delete on contracts
  for each row execute function public.audit_row_change();

drop trigger if exists audit_contract_analyses on contract_analyses;
create trigger audit_contract_analyses
  after insert or update or delete on contract_analyses
  for each row execute function public.audit_row_change();

drop trigger if exists audit_workspaces on workspaces;
create trigger audit_workspaces
  after insert or update or delete on workspaces
  for each row execute function public.audit_row_change();

drop trigger if exists audit_credit_transactions on credit_transactions;
create trigger audit_credit_transactions
  after insert on credit_transactions
  for each row execute function public.audit_row_change();

drop trigger if exists audit_workspace_invites on workspace_invites;
create trigger audit_workspace_invites
  after insert or update on workspace_invites
  for each row execute function public.audit_row_change();
