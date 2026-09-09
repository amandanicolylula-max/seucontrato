import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Plus, Search, FileScan, ChevronRight, Calendar, Sparkles } from 'lucide-react'
import { ContractAnalysis } from '@/types'
import { AnalysisStatusBadge } from '@/components/analysis/AnalysisStatusBadge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import clsx from 'clsx'

type TabKey = 'minha_fila' | 'todas'

export default function AnaliseHibridaList() {
  const { profile } = useAuth()
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  const [tab, setTab] = useState<TabKey>('minha_fila')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('contract_analyses')
      .select('*, clients(name), author:created_by(id, full_name), reviewer:reviewer_id(id, full_name)')
      .eq('analysis_module', 'hibrido')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAnalyses(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    let list = analyses
    if (tab === 'minha_fila' && profile) {
      if (profile.role === 'assistente') {
        list = list.filter(a => a.created_by === profile.id && ['rascunho_estagiario', 'aguardando_revisao'].includes(a.status))
      } else if (profile.role === 'advogado') {
        list = list.filter(a =>
          (a.status === 'aguardando_revisao' && a.reviewer_id === profile.id) ||
          (a.status === 'rascunho' && a.created_by === profile.id)
        )
      } else if (profile.role === 'socio') {
        list = list.filter(a => ['aguardando_revisao', 'rascunho', 'rascunho_estagiario'].includes(a.status))
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.clients?.name?.toLowerCase().includes(q))
    }
    return list
  }, [analyses, tab, search, profile])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl text-navy-900">Análise Híbrida</h1>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold uppercase tracking-wider">Beta</span>
          </div>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            Base Corplaw + seções livres editáveis + anotações do advogado + PDF
          </p>
        </div>
        <Link to="/painel/analise-hibrida/nova" className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Nova Análise
        </Link>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {[
            { key: 'minha_fila' as TabKey, label: 'Minha fila' },
            { key: 'todas' as TabKey, label: 'Todas' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx('px-4 py-3 text-sm font-medium border-b-2 transition-colors', tab === t.key ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-navy-800')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <FileScan className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nenhuma análise híbrida ainda. Comece uma nova.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
          {filtered.map(a => (
            <Link key={a.id} to={`/painel/analise-hibrida/${a.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileScan className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-800 truncate">{a.title}</p>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  {a.clients?.name && <span>{a.clients.name} ·</span>}
                  <Calendar className="w-3 h-3" />
                  {format(new Date(a.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  {a.author && <span>· {a.author.full_name}</span>}
                </p>
              </div>
              <AnalysisStatusBadge status={a.status} />
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
