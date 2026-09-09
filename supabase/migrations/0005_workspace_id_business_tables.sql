-- ============================================================
-- Migration 0005: Adiciona workspace_id em tabelas de negócio +
-- RLS pra clientes acessarem só o próprio workspace
-- ============================================================

-- Adiciona workspace_id (nullable pra compatibilidade com dados internos antigos)
alter table contracts         add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table clients           add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table contract_analyses add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table contract_problems add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

create index if not exists idx_contracts_workspace         on contracts(workspace_id);
create index if not exists idx_clients_workspace           on clients(workspace_id);
create index if not exists idx_contract_analyses_workspace on contract_analyses(workspace_id);
create index if not exists idx_contract_problems_workspace on contract_problems(workspace_id);

-- ── RLS: contracts ──────────────────────────────────────────
alter table contracts enable row level security;

drop policy if exists "Internal users read all contracts" on contracts;
create policy "Internal users read all contracts"
  on contracts for select to authenticated using (is_internal_user());

drop policy if exists "Internal users manage all contracts" on contracts;
create policy "Internal users manage all contracts"
  on contracts for all to authenticated using (is_internal_user());

drop policy if exists "Client users read own workspace contracts" on contracts;
create policy "Client users read own workspace contracts"
  on contracts for select to authenticated
  using (is_client_user() and workspace_id = current_user_workspace());

drop policy if exists "Client users insert own workspace contracts" on contracts;
create policy "Client users insert own workspace contracts"
  on contracts for insert to authenticated
  with check (is_client_user() and workspace_id = current_user_workspace());

drop policy if exists "Client users update own workspace contracts" on contracts;
create policy "Client users update own workspace contracts"
  on contracts for update to authenticated
  using (is_client_user() and workspace_id = current_user_workspace());

drop policy if exists "Workspace owner deletes contracts" on contracts;
create policy "Workspace owner deletes contracts"
  on contracts for delete to authenticated
  using (is_workspace_owner() and workspace_id = current_user_workspace());

-- ── RLS: clients ────────────────────────────────────────────
alter table clients enable row level security;

drop policy if exists "Internal users manage all clients" on clients;
create policy "Internal users manage all clients"
  on clients for all to authenticated using (is_internal_user());

drop policy if exists "Client users read own workspace clients" on clients;
create policy "Client users read own workspace clients"
  on clients for select to authenticated
  using (is_client_user() and workspace_id = current_user_workspace());

drop policy if exists "Client users insert own workspace clients" on clients;
create policy "Client users insert own workspace clients"
  on clients for insert to authenticated
  with check (is_client_user() and workspace_id = current_user_workspace());

drop policy if exists "Client users update own workspace clients" on clients;
create policy "Client users update own workspace clients"
  on clients for update to authenticated
  using (is_client_user() and workspace_id = current_user_workspace());

-- ── RLS: contract_analyses ─────────────────────────────────
alter table contract_analyses enable row level security;

drop policy if exists "Internal users manage all analyses" on contract_analyses;
create policy "Internal users manage all analyses"
  on contract_analyses for all to authenticated using (is_internal_user());

drop policy if exists "Client users read own workspace analyses" on contract_analyses;
create policy "Client users read own workspace analyses"
  on contract_analyses for select to authenticated
  using (is_client_user() and workspace_id = current_user_workspace() and status = 'finalizado');

drop policy if exists "Client users create own workspace analyses" on contract_analyses;
create policy "Client users create own workspace analyses"
  on contract_analyses for insert to authenticated
  with check (is_client_user() and workspace_id = current_user_workspace());

-- ── RLS: contract_problems ─────────────────────────────────
alter table contract_problems enable row level security;

drop policy if exists "Internal users manage all problems" on contract_problems;
create policy "Internal users manage all problems"
  on contract_problems for all to authenticated using (is_internal_user());

-- Cliente não vê banco de problemas (é conhecimento interno)
