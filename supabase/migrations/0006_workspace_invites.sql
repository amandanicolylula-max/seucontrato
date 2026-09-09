-- ============================================================
-- Migration 0006: Convites de colaboradores para workspaces
-- ============================================================

create table if not exists workspace_invites (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  email         text not null,
  invited_by    uuid not null references profiles(id) on delete cascade,
  role          text not null default 'cliente_member' check (role = 'cliente_member'),
  credit_limit  int,                                            -- null = sem limite
  token         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status        text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create unique index if not exists idx_invite_pending_per_email
  on workspace_invites(workspace_id, email) where status = 'pending';

create index if not exists idx_invite_token on workspace_invites(token);

-- ── RLS ──────────────────────────────────────────────────────
alter table workspace_invites enable row level security;

-- Internal users (sócio+advogado+estagiário) veem todos os convites (para debug/suporte)
drop policy if exists "Internal users read all invites" on workspace_invites;
create policy "Internal users read all invites"
  on workspace_invites for select to authenticated
  using (is_internal_user());

-- Owner do workspace gerencia seus próprios convites
drop policy if exists "Workspace owner manages own invites" on workspace_invites;
create policy "Workspace owner manages own invites"
  on workspace_invites for all to authenticated
  using (is_workspace_owner() and workspace_id = current_user_workspace())
  with check (is_workspace_owner() and workspace_id = current_user_workspace());
