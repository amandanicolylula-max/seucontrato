-- ============================================================
-- Migration 0010: 3 módulos de análise convivendo
-- (legacy = nosso atual; corplaw = puro dos colegas; hibrido = base
-- do corplaw + camadas extras)
-- ============================================================

alter table contract_analyses
  add column if not exists analysis_module text not null default 'legacy';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contract_analyses_module_check') then
    alter table contract_analyses add constraint contract_analyses_module_check
      check (analysis_module in ('legacy','corplaw','hibrido'));
  end if;
end $$;

create index if not exists idx_analyses_module on contract_analyses(analysis_module);

-- Briefing (usado pelos módulos B/C): { negocio, perspectiva, preocupacoes }
alter table contract_analyses
  add column if not exists briefing jsonb;

-- Nível de esforço configurado no momento da análise (B/C)
alter table contract_analyses
  add column if not exists effort text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contract_analyses_effort_check') then
    alter table contract_analyses add constraint contract_analyses_effort_check
      check (effort is null or effort in ('low','medium','high','xhigh','max'));
  end if;
end $$;
