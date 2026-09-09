-- ============================================================
-- Migration 0004: Sistema de créditos (balances, transactions, member limits)
-- ============================================================

-- Saldo por workspace
create table if not exists credit_balances (
  workspace_id       uuid primary key references workspaces(id) on delete cascade,
  saldo_avulso       int not null default 0,      -- créditos comprados, não expiram
  saldo_mensal_ciclo jsonb not null default '[]'::jsonb, -- lista de {creditos, expira_em}
  ultima_renovacao   timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Histórico de todas as movimentações
create table if not exists credit_transactions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid references profiles(id) on delete set null,
  tipo            text not null check (tipo in (
    'compra',        -- cliente comprou avulso
    'consumo',       -- feature usada
    'estorno',       -- devolução
    'renovacao',     -- ciclo mensal adicionado
    'bonus_corplaw', -- cortesia dada pelo sócio
    'expiracao'      -- ciclo mensal antigo expirou
  )),
  quantidade      int not null,                    -- +N = crédito, -N = débito
  referencia_tipo text,                            -- 'contract' | 'analysis' | 'purchase'
  referencia_id   uuid,
  descricao       text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_credit_tx_workspace on credit_transactions(workspace_id, created_at desc);
create index if not exists idx_credit_tx_user      on credit_transactions(user_id);

-- Limite de gasto por membro do workspace
create table if not exists member_credit_limits (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  limite_mensal int,                    -- null = sem limite
  consumido_mes int not null default 0,
  reset_at      timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ── Function auxiliar: débito FIFO nos ciclos ──────────────────
create or replace function public._debit_credits_fifo(
  p_workspace_id uuid,
  p_amount int
) returns void language plpgsql security definer as $$
declare
  v_ciclos    jsonb;
  v_ciclo     jsonb;
  v_novo      jsonb := '[]'::jsonb;
  v_restante  int := p_amount;
  v_creditos  int;
  v_ordered   jsonb;
begin
  select saldo_mensal_ciclo into v_ciclos from credit_balances where workspace_id = p_workspace_id;

  -- Ordena ciclos por expira_em ASC (mais antigos primeiro) e filtra não-expirados
  select coalesce(jsonb_agg(c order by (c->>'expira_em')::timestamptz), '[]'::jsonb)
  into v_ordered
  from jsonb_array_elements(v_ciclos) c
  where (c->>'expira_em')::timestamptz > now();

  -- Débita FIFO
  for v_ciclo in select * from jsonb_array_elements(v_ordered) loop
    v_creditos := (v_ciclo->>'creditos')::int;
    if v_restante <= 0 then
      -- Já debitado o suficiente, mantém restante do ciclo
      v_novo := v_novo || v_ciclo;
    elsif v_creditos <= v_restante then
      -- Consome ciclo inteiro
      v_restante := v_restante - v_creditos;
    else
      -- Consome parcial e mantém o resto
      v_novo := v_novo || jsonb_build_object(
        'creditos', v_creditos - v_restante,
        'expira_em', v_ciclo->>'expira_em'
      );
      v_restante := 0;
    end if;
  end loop;

  -- Se ainda tem restante, débita do avulso
  if v_restante > 0 then
    update credit_balances set saldo_avulso = saldo_avulso - v_restante
    where workspace_id = p_workspace_id;
  end if;

  update credit_balances set saldo_mensal_ciclo = v_novo, updated_at = now()
  where workspace_id = p_workspace_id;
end; $$;

-- ── Function principal: consume_credits ────────────────────────
create or replace function public.consume_credits(
  p_workspace_id uuid,
  p_user_id uuid,
  p_amount int,
  p_ref_type text,
  p_ref_id uuid,
  p_descricao text
) returns jsonb language plpgsql security definer as $$
declare
  v_saldo_avulso int;
  v_ciclos jsonb;
  v_limite int;
  v_consumido int;
  v_total_ciclos int;
  v_total_disponivel int;
begin
  select saldo_avulso, saldo_mensal_ciclo into v_saldo_avulso, v_ciclos
  from credit_balances where workspace_id = p_workspace_id for update;

  if v_saldo_avulso is null then
    return jsonb_build_object('success', false, 'error', 'workspace_sem_balance');
  end if;

  select coalesce(sum((c->>'creditos')::int), 0) into v_total_ciclos
  from jsonb_array_elements(v_ciclos) c
  where (c->>'expira_em')::timestamptz > now();

  v_total_disponivel := v_total_ciclos + v_saldo_avulso;

  if v_total_disponivel < p_amount then
    return jsonb_build_object('success', false, 'error', 'saldo_insuficiente', 'saldo', v_total_disponivel);
  end if;

  select limite_mensal, consumido_mes into v_limite, v_consumido
  from member_credit_limits where workspace_id = p_workspace_id and user_id = p_user_id;

  if v_limite is not null and (v_consumido + p_amount) > v_limite then
    return jsonb_build_object('success', false, 'error', 'limite_pessoal_excedido',
      'limite', v_limite, 'consumido', v_consumido);
  end if;

  perform public._debit_credits_fifo(p_workspace_id, p_amount);

  if v_limite is not null then
    update member_credit_limits set consumido_mes = consumido_mes + p_amount, updated_at = now()
    where workspace_id = p_workspace_id and user_id = p_user_id;
  end if;

  insert into credit_transactions (workspace_id, user_id, tipo, quantidade, referencia_tipo, referencia_id, descricao)
  values (p_workspace_id, p_user_id, 'consumo', -p_amount, p_ref_type, p_ref_id, p_descricao);

  return jsonb_build_object('success', true, 'saldo_restante', v_total_disponivel - p_amount);
end; $$;

-- ── Function: renew_monthly_credits ────────────────────────────
create or replace function public.renew_monthly_credits() returns int
  language plpgsql security definer as $$
declare
  r record;
  v_plan_creditos int;
  v_ciclos jsonb;
  v_expirados int;
  v_novo_ciclo jsonb;
  v_novos_ciclos jsonb;
  v_count int := 0;
begin
  for r in
    select b.workspace_id, w.plan_id, b.saldo_mensal_ciclo, p.creditos_mensais
    from credit_balances b
    join workspaces w on w.id = b.workspace_id
    join plans p on p.id = w.plan_id
    where b.ultima_renovacao + interval '30 days' <= now()
  loop
    -- Remove ciclos expirados e calcula quantidade que expirou
    select coalesce(sum((c->>'creditos')::int), 0) into v_expirados
    from jsonb_array_elements(r.saldo_mensal_ciclo) c
    where (c->>'expira_em')::timestamptz <= now();

    -- Ciclos que ainda são válidos (não expiraram)
    select coalesce(jsonb_agg(c), '[]'::jsonb) into v_novos_ciclos
    from jsonb_array_elements(r.saldo_mensal_ciclo) c
    where (c->>'expira_em')::timestamptz > now();

    -- Adiciona novo ciclo com validade de 90 dias
    v_novo_ciclo := jsonb_build_object(
      'creditos', r.creditos_mensais,
      'expira_em', (now() + interval '90 days')::text
    );
    v_novos_ciclos := v_novos_ciclos || v_novo_ciclo;

    update credit_balances
    set saldo_mensal_ciclo = v_novos_ciclos,
        ultima_renovacao = now(),
        updated_at = now()
    where workspace_id = r.workspace_id;

    -- Transactions
    insert into credit_transactions (workspace_id, tipo, quantidade, descricao)
    values (r.workspace_id, 'renovacao', r.creditos_mensais, 'Renovação mensal do plano');

    if v_expirados > 0 then
      insert into credit_transactions (workspace_id, tipo, quantidade, descricao)
      values (r.workspace_id, 'expiracao', -v_expirados, 'Créditos mensais expiraram (>3 meses)');
    end if;

    -- Reset limites pessoais dos membros do workspace
    update member_credit_limits set consumido_mes = 0, reset_at = now() + interval '30 days', updated_at = now()
    where workspace_id = r.workspace_id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

-- ── Trigger: ao criar workspace, popula credit_balance com ciclo inicial ──
create or replace function public.handle_new_workspace() returns trigger
  language plpgsql security definer as $$
declare
  v_creditos_plano int;
begin
  select creditos_mensais into v_creditos_plano from plans where id = new.plan_id;

  insert into credit_balances (workspace_id, saldo_avulso, saldo_mensal_ciclo, ultima_renovacao)
  values (
    new.id,
    0,
    jsonb_build_array(jsonb_build_object(
      'creditos', coalesce(v_creditos_plano, 0),
      'expira_em', (now() + interval '90 days')::text
    )),
    now()
  );

  -- Também cria member_credit_limits para o owner (sem limite)
  insert into member_credit_limits (workspace_id, user_id, limite_mensal, consumido_mes)
  values (new.id, new.owner_id, null, 0)
  on conflict do nothing;

  return new;
end; $$;

drop trigger if exists on_workspace_created on workspaces;
create trigger on_workspace_created
  after insert on workspaces
  for each row execute function public.handle_new_workspace();

-- ── Popular credit_balance para workspaces já existentes (retro) ──
insert into credit_balances (workspace_id, saldo_avulso, saldo_mensal_ciclo, ultima_renovacao)
select
  w.id,
  0,
  jsonb_build_array(jsonb_build_object(
    'creditos', p.creditos_mensais,
    'expira_em', (now() + interval '90 days')::text
  )),
  now()
from workspaces w
join plans p on p.id = w.plan_id
where not exists (select 1 from credit_balances b where b.workspace_id = w.id);

insert into member_credit_limits (workspace_id, user_id, limite_mensal, consumido_mes)
select w.id, w.owner_id, null, 0
from workspaces w
where not exists (
  select 1 from member_credit_limits m
  where m.workspace_id = w.id and m.user_id = w.owner_id
);

-- ── RLS: credit_balances, credit_transactions, member_credit_limits ──
alter table credit_balances enable row level security;
alter table credit_transactions enable row level security;
alter table member_credit_limits enable row level security;

drop policy if exists "Internal users read all balances" on credit_balances;
create policy "Internal users read all balances"
  on credit_balances for select to authenticated using (is_internal_user());

drop policy if exists "Client owner reads own balance" on credit_balances;
create policy "Client owner reads own balance"
  on credit_balances for select to authenticated
  using (is_client_user() and workspace_id = current_user_workspace());

drop policy if exists "Internal users read all transactions" on credit_transactions;
create policy "Internal users read all transactions"
  on credit_transactions for select to authenticated using (is_internal_user());

drop policy if exists "Client owner reads own transactions" on credit_transactions;
create policy "Client owner reads own transactions"
  on credit_transactions for select to authenticated
  using (is_workspace_owner() and workspace_id = current_user_workspace());

drop policy if exists "Internal users read all limits" on member_credit_limits;
create policy "Internal users read all limits"
  on member_credit_limits for select to authenticated using (is_internal_user());

drop policy if exists "Workspace members read workspace limits" on member_credit_limits;
create policy "Workspace members read workspace limits"
  on member_credit_limits for select to authenticated
  using (is_client_user() and workspace_id = current_user_workspace());

drop policy if exists "Owner manages workspace limits" on member_credit_limits;
create policy "Owner manages workspace limits"
  on member_credit_limits for all to authenticated
  using (is_workspace_owner() and workspace_id = current_user_workspace());
