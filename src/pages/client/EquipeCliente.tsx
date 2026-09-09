import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, UserPlus, Mail, X, Trash2, ShieldOff, Shield, Copy, Check, Wallet } from 'lucide-react'
import { Profile, MemberCreditLimit, CreditBalance } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { UsageBar } from '@/components/workspace/UsageBar'
import { totalDisponivel } from '@/lib/credits'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Invite {
  id: string
  email: string
  credit_limit: number | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  token: string
  expires_at: string
  created_at: string
}

type TabKey = 'ativos' | 'pendentes' | 'suspensos'

export default function EquipeCliente() {
  const { profile, isWorkspaceOwner } = useAuth()
  const [tab, setTab] = useState<TabKey>('ativos')
  const [members, setMembers] = useState<Profile[]>([])
  const [limits, setLimits] = useState<Map<string, MemberCreditLimit>>(new Map())
  const [invites, setInvites] = useState<Invite[]>([])
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showInviteResult, setShowInviteResult] = useState<{ url: string; sent: boolean } | null>(null)

  const load = useCallback(async () => {
    if (!profile?.workspace_id) return
    const [{ data: mem }, { data: lim }, { data: inv }, { data: bal }] = await Promise.all([
      supabase.from('profiles').select('*').eq('workspace_id', profile.workspace_id).order('role', { ascending: false }).order('full_name'),
      supabase.from('member_credit_limits').select('*').eq('workspace_id', profile.workspace_id),
      supabase.from('workspace_invites').select('*').eq('workspace_id', profile.workspace_id).order('created_at', { ascending: false }),
      supabase.from('credit_balances').select('*').eq('workspace_id', profile.workspace_id).maybeSingle(),
    ])
    setMembers((mem as Profile[]) || [])
    const m = new Map<string, MemberCreditLimit>()
    ;(lim || []).forEach(l => m.set(l.user_id, l))
    setLimits(m)
    setInvites((inv as Invite[]) || [])
    setBalance(bal as CreditBalance | null)
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async (userId: string, current: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', userId)
    if (error) toast.error('Erro ao atualizar')
    else { toast.success(current ? 'Membro suspenso' : 'Membro reativado'); load() }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remover este membro permanentemente? Ele perderá acesso ao workspace.')) return
    // Não deletamos auth.users, só desvinculamos do workspace
    const { error } = await supabase.from('profiles').update({ workspace_id: null, is_active: false }).eq('id', userId)
    if (error) toast.error('Erro ao remover')
    else { toast.success('Membro removido'); load() }
  }

  const handleUpdateLimit = async (userId: string, newLimit: number | null) => {
    const { error } = await supabase.from('member_credit_limits').upsert({
      workspace_id: profile?.workspace_id,
      user_id: userId,
      limite_mensal: newLimit,
      consumido_mes: limits.get(userId)?.consumido_mes || 0,
    })
    if (error) toast.error('Erro ao atualizar limite')
    else { toast.success('Limite atualizado'); load() }
  }

  const handleRevokeInvite = async (id: string) => {
    const { error } = await supabase.from('workspace_invites').update({ status: 'revoked' }).eq('id', id)
    if (error) toast.error('Erro ao revogar convite')
    else { toast.success('Convite revogado'); load() }
  }

  if (!isWorkspaceOwner) {
    return (
      <div className="text-center py-16">
        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Apenas o dono da conta pode gerenciar a equipe.</p>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>

  const activos = members.filter(m => m.is_active)
  const suspensos = members.filter(m => !m.is_active)
  const pendentes = invites.filter(i => i.status === 'pending')

  const saldoTotal = totalDisponivel(balance)
  const consumidoOrg = Array.from(limits.values()).reduce((sum, l) => sum + (l.consumido_mes || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Colaboradores</h1>
          <p className="text-slate-500 text-sm mt-1">{activos.length} ativo(s) · {pendentes.length} convite(s) pendente(s)</p>
        </div>
        <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-accent-dark transition-all shadow-sm">
          <UserPlus className="w-4 h-4" /> Convidar colaborador
        </button>
      </div>

      {/* Card consumo agregado do workspace */}
      <div className="bg-gradient-to-br from-navy-800 to-navy-900 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider opacity-70">Consumo do workspace este mês</p>
              <p className="text-2xl font-bold mt-0.5">
                {consumidoOrg.toLocaleString('pt-BR')} <span className="text-sm font-normal opacity-70">créditos gastos pela equipe</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider opacity-70">Saldo total disponível</p>
            <p className="text-2xl font-bold text-accent mt-0.5">{saldoTotal.toLocaleString('pt-BR')}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <UsageBar
            usado={consumidoOrg}
            limite={consumidoOrg + saldoTotal}
            showLabel={false}
          />
          <p className="text-xs opacity-60 mt-2">
            Os créditos são compartilhados entre owner e membros. Limites por membro (abaixo) apenas restringem quanto cada um pode gastar dentro desse pool.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {[
            { key: 'ativos' as TabKey, label: `Ativos (${activos.length})` },
            { key: 'pendentes' as TabKey, label: `Convites pendentes (${pendentes.length})` },
            { key: 'suspensos' as TabKey, label: `Suspensos (${suspensos.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === t.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 hover:text-navy-800 hover:border-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'ativos' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {activos.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-sm">Nenhum colaborador ativo. Convide sua equipe pra começar.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Limite mensal</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activos.map(m => {
                  const limit = limits.get(m.id)
                  const isOwner = m.role === 'cliente_owner'
                  return (
                    <tr key={m.id}>
                      <td className="px-6 py-4 text-sm font-medium text-navy-800">{m.full_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{m.email}</td>
                      <td className="px-6 py-4">
                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', isOwner ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-slate-700')}>
                          {isOwner ? 'Owner' : 'Membro'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isOwner ? (
                          <div className="text-xs">
                            <span className="text-slate-500">Acesso total ao pool</span>
                            <p className="text-slate-400 text-[10px] mt-0.5">Sem limite pessoal — pode usar todo o saldo do workspace</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              placeholder="Sem limite"
                              defaultValue={limit?.limite_mensal ?? ''}
                              onBlur={e => {
                                const v = e.target.value.trim()
                                const newLimit = v === '' ? null : parseInt(v)
                                if ((limit?.limite_mensal ?? null) !== newLimit) handleUpdateLimit(m.id, newLimit)
                              }}
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent/30"
                            />
                            <div className="w-24">
                              <UsageBar usado={limit?.consumido_mes || 0} limite={limit?.limite_mensal ?? null} showLabel={false} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!isOwner && (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleToggleActive(m.id, m.is_active)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Suspender">
                              <ShieldOff className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleRemoveMember(m.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remover">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'pendentes' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {pendentes.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-sm">Nenhum convite pendente</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Limite</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Enviado em</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Expira em</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendentes.map(i => (
                  <tr key={i.id}>
                    <td className="px-6 py-4 text-sm font-medium text-navy-800">{i.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{i.credit_limit !== null ? `${i.credit_limit}/mês` : 'Sem limite'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{format(new Date(i.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{format(new Date(i.expires_at), "dd/MM/yyyy", { locale: ptBR })}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => {
                          const url = `${window.location.origin}/invite/${i.token}`
                          navigator.clipboard.writeText(url)
                          toast.success('Link copiado')
                        }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors" title="Copiar link">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRevokeInvite(i.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Cancelar convite">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'suspensos' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {suspensos.length === 0 ? (
            <p className="p-8 text-center text-slate-400 text-sm">Nenhum colaborador suspenso</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50/80"><tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {suspensos.map(m => (
                  <tr key={m.id}>
                    <td className="px-6 py-4 text-sm font-medium text-navy-800">{m.full_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{m.email}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleToggleActive(m.id, m.is_active)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Reativar">
                        <Shield className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={(url, sent) => {
            setShowInviteModal(false)
            setShowInviteResult({ url, sent })
            load()
          }}
        />
      )}

      {showInviteResult && (
        <InviteResultModal result={showInviteResult} onClose={() => setShowInviteResult(null)} />
      )}
    </div>
  )
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (url: string, sent: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [limit, setLimit] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { toast.error('E-mail obrigatório'); return }
    setSending(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email: email.trim(), credit_limit: limit.trim() ? parseInt(limit) : null }),
    })
    setSending(false)
    if (r.ok) {
      const data = await r.json()
      onSuccess(data.invite_url, data.email_sent)
    } else {
      const err = await r.json()
      toast.error(err.error || 'Erro ao criar convite')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-navy-800 text-lg">Convidar colaborador</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="colaborador@empresa.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Limite mensal de créditos <span className="text-slate-400 text-xs font-normal">(opcional)</span></label>
            <input type="number" min="0" value={limit} onChange={e => setLimit(e.target.value)}
              placeholder="Deixe em branco pra sem limite"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
            <button type="submit" disabled={sending} className="flex-1 bg-accent text-white py-2.5 rounded-xl text-sm font-medium hover:bg-accent-dark disabled:opacity-60">
              {sending ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InviteResultModal({ result, onClose }: { result: { url: string; sent: boolean }; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-navy-800 text-lg">Convite criado!</h2>
            <p className="text-slate-500 text-xs">{result.sent ? 'E-mail enviado com sucesso' : 'Copie e envie o link ao colaborador'}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
          <input readOnly value={result.url} className="flex-1 bg-transparent text-xs text-slate-600 focus:outline-none" />
          <button onClick={copy} className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-dark px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4">O convite expira em 7 dias.</p>

        <button onClick={onClose} className="w-full mt-6 bg-navy-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-navy-800">
          Fechar
        </button>
      </div>
    </div>
  )
}
