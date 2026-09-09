-- ============================================================
-- Migration 0009: contract_problems ganha economia_gerada + resolution_status
-- (workspace_id já foi adicionado na migration 0005)
-- ============================================================

alter table contract_problems
  add column if not exists economia_gerada numeric(12,2);

alter table contract_problems
  add column if not exists resolution_status text default 'aberto';

-- Constraint check pra resolution_status (só adiciona se ainda não existir)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contract_problems_resolution_status_check'
  ) then
    alter table contract_problems add constraint contract_problems_resolution_status_check
      check (resolution_status in ('aberto','em_acompanhamento','prevenido','materializou','resolvido'));
  end if;
end $$;

create index if not exists idx_problems_status on contract_problems(resolution_status);
