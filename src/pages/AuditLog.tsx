import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ClipboardList, ChevronLeft, ChevronRight, X, Search } from 'lucide-react'
import { AuditLog as AuditLogType } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PAGE_SIZE = 50

const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: 'Criação', color: 'bg-emerald-100 text-emerald-700' },
  read: { label: 'Visualização', color: 'bg-slate-100 text-slate-600' },
  update: { label: 'Edição', color: 'bg-blue-100 text-blue-700' },
  delete: { label: 'Exclusão', color: 'bg-red-100 text-red-700' },
  upload: { label: 'Upload', color: 'bg-purple-100 text-purple-700' },
  validate: { label: 'Validação', color: 'bg-amber-100 text-amber-700' },
  login: { label: 'Login', color: 'bg-navy-100 text-navy-700' },
  logout: { label: 'Logout', color: 'bg-slate-100 text-slate-500' },
}

// Opções estáticas — disponíveis mesmo quando audit_log está vazio
const ACTION_OPTIONS = Object.entries(actionLabels).map(([value, { label }]) => ({ value, label }))

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([])
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async (uFilter = userFilter, aFilter = actionFilter, from = dateFrom, to = dateTo) => {
    setLoading(true)
    setPage(1)
    let q = supabase
      .from('audit_log')
      .select('*, profiles(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (uFilter) q = q.eq('user_id', uFilter)
    if (aFilter) q = q.eq('action', aFilter)
    if (from) q = q.gte('created_at', from + 'T00:00:00')
    if (to) q = q.lte('created_at', to + 'T23:59:59')
    const { data } = await q
    setLogs(data || [])
    setLoading(false)
  }, [userFilter, actionFilter, dateFrom, dateTo])

  // Carrega sem filtros no mount para popular o dropdown de usuários
  useEffect(() => { fetchLogs('', '', '', '') }, [])

  // Usuários únicos derivados dos logs carregados
  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>()
    return logs
      .filter(l => l.user_id && l.profiles?.full_name)
      .filter(l => { if (seen.has(l.user_id!)) return false; seen.add(l.user_id!); return true })
      .map(l => ({ id: l.user_id!, name: l.profiles!.full_name! }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [logs])

  const hasActiveFilters = userFilter || actionFilter || dateFrom || dateTo

  const clearFilters = () => {
    setUserFilter('')
    setActionFilter('')
    setDateFrom('')
    setDateTo('')
    fetchLogs('', '', '', '')
  }

  const filtered = logs // já filtrado server-side

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Auditoria</h1>
        <p className="text-slate-500 text-sm mt-1">Rastreabilidade completa de todas as ações no sistema</p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* User dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">Usuário</label>
          <select
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white text-slate-700 min-w-[180px]"
          >
            <option value="">Todos os usuários</option>
            {uniqueUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Action dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">Ação</label>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white text-slate-700 min-w-[160px]"
          >
            <option value="">Todas as ações</option>
            {ACTION_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white"
          />
        </div>

        {/* Buscar */}
        <button
          onClick={() => fetchLogs()}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-brand text-white rounded-xl hover:bg-brand-light transition-all self-end"
        >
          <Search className="w-3.5 h-3.5" />
          Buscar
        </button>

        {/* Clear all filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-all self-end"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Record count */}
      {!loading && (
        <p className="text-sm text-slate-500">
          Mostrando <span className="font-semibold text-slate-700">{filtered.length}</span> de{' '}
          <span className="font-semibold text-slate-700">{logs.length}</span> registros
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum registro de auditoria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  {['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'ID da Entidade'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map(log => {
                  const a = actionLabels[log.action] || { label: log.action, color: 'bg-slate-100 text-slate-600' }
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-sm font-medium text-navy-800">{log.profiles?.full_name || 'Sistema'}</p>
                        {log.profiles?.role && <p className="text-xs text-slate-400 capitalize">{log.profiles.role}</p>}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${a.color}`}>
                          {a.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 capitalize">{log.entity_type}</td>
                      <td className="px-6 py-3 text-xs text-slate-400 font-mono truncate max-w-[120px]">
                        {log.entity_id?.slice(0, 8) || '—'}...
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Página <span className="font-semibold text-slate-700">{safePage}</span> de{' '}
            <span className="font-semibold text-slate-700">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
