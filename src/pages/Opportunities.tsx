import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Search } from 'lucide-react'
import { Badge } from '@/components/UI/Badge'
import { ContractOpportunity, OpportunityStatus } from '@/types'
import toast from 'react-hot-toast'

const statusOptions: { value: OpportunityStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'identificada', label: 'Identificadas' },
  { value: 'em_abordagem', label: 'Em Abordagem' },
  { value: 'convertida', label: 'Convertidas' },
  { value: 'descartada', label: 'Descartadas' },
]

export default function Opportunities() {
  const [opps, setOpps] = useState<ContractOpportunity[]>([])
  const [filtered, setFiltered] = useState<ContractOpportunity[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [riskFilter, setRiskFilter] = useState<string>('todos')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('contract_opportunities')
      .select('*, contracts(title), clients(name)').order('created_at', { ascending: false })
    setOpps(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let f = opps
    if (search) f = f.filter(o => o.type.toLowerCase().includes(search.toLowerCase()) || o.description.toLowerCase().includes(search.toLowerCase()))
    if (statusFilter !== 'todos') f = f.filter(o => o.status === statusFilter)
    if (riskFilter !== 'todos') f = f.filter(o => o.risk_level === riskFilter)
    setFiltered(f)
  }, [search, statusFilter, riskFilter, opps])

  const updateStatus = async (id: string, status: OpportunityStatus) => {
    const { error } = await supabase.from('contract_opportunities').update({ status }).eq('id', id)
    if (error) toast.error('Erro ao atualizar status')
    else { toast.success('Status atualizado!'); load() }
  }

  const stats = {
    total: opps.length,
    identificadas: opps.filter(o => o.status === 'identificada').length,
    abordagem: opps.filter(o => o.status === 'em_abordagem').length,
    convertidas: opps.filter(o => o.status === 'convertida').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Oportunidades</h1>
        <p className="text-slate-500 text-sm mt-1">Vulnerabilidades identificadas pela IA nos contratos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-navy-700' },
          { label: 'Identificadas', value: stats.identificadas, color: 'bg-blue-600' },
          { label: 'Em Abordagem', value: stats.abordagem, color: 'bg-amber-500' },
          { label: 'Convertidas', value: stats.convertidas, color: 'bg-emerald-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${color} text-white rounded-2xl p-5 shadow-sm`}>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm opacity-80 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar oportunidades..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white" />
        </div>
        <div className="flex gap-2">
          {statusOptions.map(({ value, label }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === value ? 'bg-brand text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand/40'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Risk filter row */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Risco:</span>
        {([['todos', 'Todos'], ['alto', 'Alto'], ['médio', 'Médio'], ['baixo', 'Baixo']] as [string, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setRiskFilter(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              riskFilter === v
                ? v === 'alto' ? 'bg-red-500 text-white border-red-500'
                  : v === 'médio' ? 'bg-amber-500 text-white border-amber-500'
                  : v === 'baixo' ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nenhuma oportunidade encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map(op => (
            <div key={op.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-navy-800 text-sm">{op.type}</p>
                  {op.contracts && (
                    <Link to={`/contratos/${op.contract_id}`} className="text-xs text-brand hover:underline mt-0.5 block">{op.contracts.title}</Link>
                  )}
                </div>
                <div className="flex gap-1.5 ml-3">
                  <Badge value={op.risk_level} />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">{op.description}</p>
              {op.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-4 italic">"{op.notes}"</p>}
              <div className="flex items-center justify-between">
                <Badge value={op.status} />
                <select value={op.status} onChange={e => updateStatus(op.id, e.target.value as OpportunityStatus)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand/30 text-slate-600 bg-white">
                  <option value="identificada">Identificada</option>
                  <option value="em_abordagem">Em Abordagem</option>
                  <option value="convertida">Convertida</option>
                  <option value="descartada">Descartada</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
