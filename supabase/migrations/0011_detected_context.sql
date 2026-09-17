-- 0011: adiciona coluna detected_context para armazenar tipo/contraparte detectados
-- pela pré-análise Haiku, usados no enriquecimento com Banco de Problemas.
-- Também simplifica o check constraint pra permitir só 'corplaw' (único módulo).

alter table contract_analyses
  add column if not exists detected_context jsonb;

alter table contract_analyses
  drop constraint if exists contract_analyses_module_check;

alter table contract_analyses
  add constraint contract_analyses_module_check
  check (analysis_module = 'corplaw');

alter table contract_analyses
  alter column analysis_module set default 'corplaw';
