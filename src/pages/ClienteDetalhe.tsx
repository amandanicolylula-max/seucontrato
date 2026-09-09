import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Building2, FileText, FileScan, CreditCard, Users, Activity, LayoutDashboard } from 'lucide-react'
import { Workspace, CreditBalance, Profile, CreditTransaction, MemberCreditLimit, Contract, ContractAnalysis, AuditLog } from '@/types'
import { PlanBadge } from '@/components/workspace/PlanBadge'
import { CreditBalanceCard } from '@/components/workspace/CreditBalanceCard'
import { UsageBar } from '@/components/workspace/UsageBar'
import { AnalysisStatusBadge } from '@/components/analysis/AnalysisStatusBadge'
import { Badge } from '@/components/UI/Badge'
import { useAuth } from '@/hooks/useAuth'
import { totalDisponivel, tipoTransacao, formatCreditos } from '@/lib/credits'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import toast from 'react-hot-toast'

type TabKey = 'overview' | 'colaboradores' | 'financeiro' | 'contratos' | 'analises' | 'atividade'

export default function ClienteDetalhe() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) || 'overview'
  const { profile } = useAuth()
  const isSocio = profile?.role === 'socio'
  const isSocioOrAdvogado = profile?.role === 'socio' || profile?.role === 'advogado'

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: ws }, { data: bal }, { data: mem }] = await Promise.all([
        supabase.from('workspaces').select('*, plans(*), profiles!workspaces_owner_id_fkey(id, full_name, email)').eq('id', workspaceId).single(),
        supabase.from('credit_balances').select('*').eq('workspace_id', workspaceId).maybeSingle(),
        supabase.from('profiles').select('*').eq('workspace_id', workspaceId).order('role', { ascending: false }).order('full_name'),
      ])
      if (cancelled) return
      setWorkspace(ws as Workspace | null)
      setBalance(bal as CreditBalance | null)
      setMembers((mem as Profile[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [workspaceId])

  const tabs: { key: TabKey; label: string; icon: typeof LayoutDashboard; show: boolean }[] = [
    { key: 'overview',      label: 'Overview',      icon: LayoutDashboard, show: true },
    { key: 'colaboradores', label: 'Colaboradores', icon: Users,           show: true },
    { key: 'financeiro',    label: 'Financeiro',    icon: CreditCard,      show: isSocioOrAdvogado },
    { key: 'contratos',     label: 'Contratos',     icon: FileText,        show: true },
    { key: 'analises',      label: 'Análises',      icon: FileScan,        show: true },
    { key: 'atividade',     label: 'Atividade',     icon: Activity,        show: isSocio },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  )

  if (!workspace) return (
    <div className="text-center py-16">
      <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500">Workspace não encontrado</p>
      <Link to="/painel/clientes-plataforma" className="inline-flex items-center gap-1 text-accent mt-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar para lista
      </Link>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/painel/clientes-plataforma" className="inline-flex items-center gap-1 text-slate-500 hover:text-navy-800 text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Clientes da Plataforma
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl text-navy-900">{workspace.nome}</h1>
              {workspace.plans && <PlanBadge tipo={workspace.plans.tipo} />}
            </div>
            <p className="text-slate-500 text-sm mt-1">
              CNPJ: {workspace.cnpj || '—'} · Owner: {workspace.profiles?.full_name} ({workspace.profiles?.email})
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.filter(t => t.show).map(t => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setParams({ tab: t.key })}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-slate-500 hover:text-navy-800 hover:border-slate-200'
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview'      && <TabOverview workspace={workspace} balance={balance} members={members} showFinanceiro={isSocioOrAdvogado} />}
      {tab === 'colaboradores' && <TabColaboradores members={members} workspaceId={workspace.id} showFinanceiro={isSocioOrAdvogado} />}
      {tab === 'financeiro' && isSocioOrAdvogado && <TabFinanceiro workspaceId={workspace.id} balance={balance} isSocio={isSocio} onRefresh={() => window.location.reload()} />}
      {tab === 'contratos'     && <TabContratos workspaceId={workspace.id} />}
      {tab === 'analises'      && <TabAnalises workspaceId={workspace.id} />}
      {tab === 'atividade' && isSocio && <TabAtividade workspaceId={workspace.id} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ABAS
// ═══════════════════════════════════════════════════════════════

function TabOverview({ workspace, balance, members, showFinanceiro }: { workspace: Workspace; balance: CreditBalance | null; members: Profile[]; showFinanceiro: boolean }) {
  const limite = workspace.plans?.limite_colaboradores ?? 0
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider mb-2">
          <Users className="w-4 h-4" /> Colaboradores
        </div>
        <p className="text-3xl font-bold text-navy-900">{members.length} / {limite}</p>
      </div>

      {showFinanceiro && balance && (
        <div className="md:col-span-2">
          <CreditBalanceCard balance={balance} />
        </div>
      )}
    </div>
  )
}

function TabColaboradores({ members, workspaceId, showFinanceiro }: { members: Profile[]; workspaceId: string; showFinanceiro: boolean }) {
  const [limits, setLimits] = useState<Map<string, MemberCreditLimit>>(new Map())

  useEffect(() => {
    if (!showFinanceiro) return
    supabase.from('member_credit_limits').select('*').eq('workspace_id', workspaceId).then(({ data }) => {
      const m = new Map<string, MemberCreditLimit>()
      ;(data || []).forEach(l => m.set(l.user_id, l))
      setLimits(m)
    })
  }, [workspaceId, showFinanceiro])

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil</th>
            {showFinanceiro && <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Limite / Consumo mês</th>}
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {members.map(m => {
            const limit = limits.get(m.id)
            return (
              <tr key={m.id}>
                <td className="px-6 py-4 text-sm font-medium text-navy-800">{m.full_name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{m.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    m.role === 'cliente_owner' ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-slate-700'
                  )}>
                    {m.role === 'cliente_owner' ? 'Owner' : 'Membro'}
                  </span>
                </td>
                {showFinanceiro && (
                  <td className="px-6 py-4">
                    <UsageBar usado={limit?.consumido_mes || 0} limite={limit?.limite_mensal ?? null} />
                  </td>
                )}
                <td className="px-6 py-4">
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  )}>
                    {m.is_active ? 'Ativo' : 'Suspenso'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabFinanceiro({ workspaceId, balance, isSocio, onRefresh }: { workspaceId: string; balance: CreditBalance | null; isSocio: boolean; onRefresh: () => void }) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [descricao, setDescricao] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    supabase.from('credit_transactions')
      .select('*, profiles(full_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setTransactions((data as CreditTransaction[]) || []))
  }, [workspaceId])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = parseInt(amount)
    if (isNaN(qty) || qty <= 0) { toast.error('Quantidade inválida'); return }
    setAdding(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/admin-add-credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ workspace_id: workspaceId, quantidade: qty, descricao })
    })
    setAdding(false)
    if (r.ok) {
      toast.success(`${qty} créditos cortesia adicionados`)
      setShowAddModal(false); setAmount(''); setDescricao('')
      onRefresh()
    } else {
      const err = await r.json()
      toast.error(err.error || 'Erro ao adicionar créditos')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CreditBalanceCard balance={balance} className="md:col-span-2" />
        {isSocio && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setShowAddModal(true)} className="flex items-center justify-center gap-2 bg-accent text-white rounded-2xl px-4 py-3 text-sm font-medium hover:bg-accent-dark transition-all shadow-sm">
              Adicionar créditos cortesia
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-navy-800">Histórico de transações</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm">Nenhuma transação ainda</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantidade</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Autor</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map(t => {
                const tp = tipoTransacao(t.tipo)
                return (
                  <tr key={t.id}>
                    <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                    <td className="px-6 py-3"><span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium', tp.cor)}>{tp.label}</span></td>
                    <td className={clsx('px-6 py-3 text-sm font-semibold', t.quantidade > 0 ? 'text-emerald-600' : 'text-slate-700')}>{formatCreditos(t.quantidade)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{t.profiles?.full_name || 'Sistema'}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{t.descricao || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <h2 className="font-semibold text-navy-800 text-lg mb-4">Adicionar créditos cortesia</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantidade *</label>
                <input type="number" min="1" required value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" placeholder="100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição (opcional)</label>
                <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" placeholder="Ex: Bônus de fidelidade" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={adding} className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-medium hover:bg-accent-dark disabled:opacity-60">{adding ? 'Adicionando...' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TabContratos({ workspaceId }: { workspaceId: string }) {
  const [contracts, setContracts] = useState<Contract[]>([])
  useEffect(() => {
    supabase.from('contracts').select('*, clients(name)').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      .then(({ data }) => setContracts((data as Contract[]) || []))
  }, [workspaceId])

  if (contracts.length === 0) {
    return <div className="text-center py-16 bg-white rounded-2xl border border-slate-100"><FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500 text-sm">Nenhum contrato deste cliente ainda</p></div>
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50/80"><tr>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Adicionado em</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-50">
          {contracts.map(c => (
            <tr key={c.id}>
              <td className="px-6 py-3"><Link to={`/painel/contratos/${c.id}`} className="text-sm font-medium text-navy-800 hover:text-accent">{c.title}</Link></td>
              <td className="px-6 py-3 text-sm text-slate-600">{c.contract_type || '—'}</td>
              <td className="px-6 py-3"><Badge value={c.status} /></td>
              <td className="px-6 py-3 text-sm text-slate-500">{format(new Date(c.created_at), 'dd/MM/yyyy')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabAnalises({ workspaceId }: { workspaceId: string }) {
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  useEffect(() => {
    supabase.from('contract_analyses').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      .then(({ data }) => setAnalyses((data as ContractAnalysis[]) || []))
  }, [workspaceId])

  if (analyses.length === 0) {
    return <div className="text-center py-16 bg-white rounded-2xl border border-slate-100"><FileScan className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500 text-sm">Nenhuma análise solicitada por este cliente</p></div>
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50/80"><tr>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Solicitada em</th>
          <th className="px-6 py-3 text-right"></th>
        </tr></thead>
        <tbody className="divide-y divide-slate-50">
          {analyses.map(a => (
            <tr key={a.id}>
              <td className="px-6 py-3 text-sm font-medium text-navy-800">{a.title}</td>
              <td className="px-6 py-3"><AnalysisStatusBadge status={a.status} /></td>
              <td className="px-6 py-3 text-sm text-slate-500">{format(new Date(a.created_at), 'dd/MM/yyyy')}</td>
              <td className="px-6 py-3 text-right"><Link to={`/painel/analise/${a.id}`} className="text-accent text-sm hover:underline">Abrir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabAtividade({ workspaceId }: { workspaceId: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  useEffect(() => {
    supabase.from('audit_log').select('*, profiles(full_name, role)').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setLogs((data as AuditLog[]) || []))
  }, [workspaceId])

  if (logs.length === 0) {
    return <div className="text-center py-16 bg-white rounded-2xl border border-slate-100"><Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500 text-sm">Nenhuma atividade registrada</p></div>
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50/80"><tr>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Quando</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuário</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação</th>
          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Entidade</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-50">
          {logs.map(l => (
            <tr key={l.id}>
              <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap">{format(new Date(l.created_at), "dd/MM HH:mm", { locale: ptBR })}</td>
              <td className="px-6 py-3 text-sm text-slate-700">{l.profiles?.full_name || 'Sistema'}</td>
              <td className="px-6 py-3 text-sm text-slate-600">{l.action}</td>
              <td className="px-6 py-3 text-sm text-slate-500">{l.entity_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
