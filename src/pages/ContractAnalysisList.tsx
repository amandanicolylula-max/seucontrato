import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Plus, Search, FileSearch, ChevronRight, Calendar, User, Trash2 } from 'lucide-react'
import { ContractAnalysis } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import clsx from 'clsx'

const RISK_CONFIG = {
  alto:  { label: 'Risco Alto',  cls: 'bg-red-100 text-red-700' },
  medio: { label: 'Risco Médio', cls: 'bg-amber-100 text-amber-700' },
  baixo: { label: 'Risco Baixo', cls: 'bg-green-100 text-green-700' },
}
const STATUS_CONFIG = {
  processando:         { label: 'Processando…',      cls: 'bg-blue-100 text-blue-700' },
  rascunho_estagiario: { label: 'Rascunho estagiário', cls: 'bg-purple-100 text-purple-700' },
  aguardando_revisao:  { label: 'Aguardando revisão', cls: 'bg-amber-100 text-amber-700' },
  rascunho:            { label: 'Rascunho',           cls: 'bg-slate-100 text-slate-600' },
  finalizado:          { label: 'Finalizado',         cls: 'bg-emerald-100 text-emerald-700' },
  falhou:              { label: 'Falhou',             cls: 'bg-red-100 text-red-600' },
}

type TabKey = 'minha_fila' | 'todas'

export default function ContractAnalysisList() {
  const { profile } = useAuth()
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>('minha_fila')
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('contract_analyses')
      .select('*, clients(name), author:created_by(id, full_name), reviewer:reviewer_id(id, full_name)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar análises')
    else setAnalyses(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    setDeleting(true)
    // Remove PDF from storage if exists
    await supabase.storage.from('analyses').remove([`${id}.pdf`])
    const { error } = await supabase.from('contract_analyses').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir análise')
    else { toast.success('Análise excluída'); setAnalyses(prev => prev.filter(a => a.id !== id)) }
    setDeleteConfirm(null)
    setDeleting(false)
  }

  const filtered = useMemo(() => {
    let list = analyses

    // Filtro por aba
    if (tab === 'minha_fila' && profile) {
      if (profile.role === 'assistente') {
        // Estagiário vê suas próprias análises (drafts + aguardando)
        list = list.filter(a =>
          a.created_by === profile.id &&
          ['rascunho_estagiario', 'aguardando_revisao'].includes(a.status)
        )
      } else if (profile.role === 'advogado') {
        // Advogado vê análises aguardando sua revisão + seus próprios drafts
        list = list.filter(a =>
          (a.status === 'aguardando_revisao' && a.reviewer_id === profile.id) ||
          (a.status === 'rascunho' && a.created_by === profile.id)
        )
      } else if (profile.role === 'socio') {
        // Sócio vê todas as pendentes (aguardando + rascunhos)
        list = list.filter(a =>
          ['aguardando_revisao', 'rascunho', 'rascunho_estagiario'].includes(a.status)
        )
      }
    }

    // Filtro por busca
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.clients?.name?.toLowerCase().includes(q)
      )
    }

    return list
  }, [analyses, tab, search, profile])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Análise Contratual</h1>
          <p className="text-slate-500 text-sm mt-1">{analyses.length} parecer(es) gerado(s)</p>
        </div>
        <Link
          to="/painel/analise/nova"
          className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nova Análise
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {([
            { key: 'minha_fila' as TabKey, label: 'Minha fila' },
            { key: 'todas' as TabKey, label: 'Todas as análises' },
          ]).map(t => (
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

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar análises…"
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <FileSearch className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Nenhuma análise encontrada</p>
          <p className="text-slate-400 text-sm mt-1">Clique em "+ Nova Análise" para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100">
            {filtered.map(a => {
              const risk = a.risk_level && RISK_CONFIG[a.risk_level as keyof typeof RISK_CONFIG]
              const status = STATUS_CONFIG[a.status]
              return (
                <div key={a.id} className="flex items-center group hover:bg-slate-50 transition-colors">
                  <Link
                    to={`/painel/analise/${a.id}`}
                    className="flex items-center gap-4 px-6 py-4 flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileSearch className="w-5 h-5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {a.clients?.name && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <User className="w-3 h-3" />{a.clients.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(a.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {risk && (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${risk.cls}`}>
                          {risk.label}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </Link>
                  {/* Delete */}
                  <div className="px-4 flex-shrink-0">
                    {deleteConfirm === a.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deleting}
                          className="text-xs text-red-600 font-medium hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.preventDefault(); setDeleteConfirm(a.id) }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Excluir análise"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
