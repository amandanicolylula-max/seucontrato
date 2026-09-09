import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Building2, Search, ChevronRight } from 'lucide-react'
import { Workspace, CreditBalance } from '@/types'
import { PlanBadge } from '@/components/workspace/PlanBadge'
import { useAuth } from '@/hooks/useAuth'
import { totalDisponivel } from '@/lib/credits'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Row extends Workspace {
  balance?: CreditBalance
  member_count: number
}

export default function ClientesPlataforma() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { isAdmin, profile } = useAuth()
  const isInternal = profile?.role === 'socio' || profile?.role === 'advogado'

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Fetch workspaces + owner + plan + balance + count of members
      const [{ data: ws }, { data: balances }, { data: memberCounts }] = await Promise.all([
        supabase.from('workspaces').select('*, plans(*), profiles!workspaces_owner_id_fkey(id, full_name, email)').order('nome'),
        supabase.from('credit_balances').select('*'),
        supabase.from('profiles').select('workspace_id').not('workspace_id', 'is', null),
      ])
      if (cancelled) return

      const balanceMap = new Map<string, CreditBalance>((balances || []).map(b => [b.workspace_id, b as CreditBalance]))
      const countMap = new Map<string, number>()
      ;(memberCounts || []).forEach(m => {
        if (m.workspace_id) countMap.set(m.workspace_id, (countMap.get(m.workspace_id) || 0) + 1)
      })

      const enriched: Row[] = (ws || []).map((w: Workspace) => ({
        ...w,
        balance: balanceMap.get(w.id),
        member_count: countMap.get(w.id) || 0,
      }))
      setRows(enriched)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.nome.toLowerCase().includes(q) ||
      (r.cnpj || '').toLowerCase().includes(q) ||
      (r.profiles?.email || '').toLowerCase().includes(q)
    )
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Clientes da Plataforma</h1>
          <p className="text-slate-500 text-sm mt-1">{rows.length} empresa(s) contratante(s)</p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por empresa, CNPJ ou e-mail do owner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plano</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Colaboradores</th>
                {isInternal && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Créditos</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Criado em</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-navy-800">{r.nome}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.cnpj || 'CNPJ não informado'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-700">{r.profiles?.full_name || '—'}</p>
                    <p className="text-xs text-slate-400">{r.profiles?.email || ''}</p>
                  </td>
                  <td className="px-6 py-4">
                    {r.plans ? <PlanBadge tipo={r.plans.tipo} /> : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {r.member_count} / {r.plans?.limite_colaboradores || '?'}
                  </td>
                  {isInternal && (
                    <td className="px-6 py-4 text-sm font-medium text-navy-800">
                      {totalDisponivel(r.balance).toLocaleString('pt-BR')}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {format(new Date(r.created_at), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/painel/clientes-plataforma/${r.id}`} className="inline-flex items-center gap-1 text-accent text-sm font-medium hover:underline">
                      Ver <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
