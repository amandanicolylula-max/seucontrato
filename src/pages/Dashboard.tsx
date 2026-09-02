import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FileText, Users, Clock, TrendingUp, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { format, isAfter, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/UI/Badge'
import { Contract, ContractOpportunity } from '@/types'

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, ativos: 0, vencendo: 0, oportunidades: 0 })
  const [recentContracts, setRecentContracts] = useState<Contract[]>([])
  const [opportunities, setOpportunities] = useState<ContractOpportunity[]>([])
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data: contracts }, { data: opps }] = await Promise.all([
          supabase.from('contracts').select('*, clients(name)').order('created_at', { ascending: false }),
          supabase.from('contract_opportunities').select('*, contracts(title), clients(name)').eq('status', 'identificada').limit(5),
        ])
        if (cancelled) return
        const c = contracts || []
        const ativos = c.filter(x => x.status === 'ativo').length
        const vencendo = c.filter(x => {
          if (!x.end_date) return false
          const d = new Date(x.end_date)
          return isAfter(d, new Date()) && !isAfter(d, addDays(new Date(), 30))
        }).length
        const byType: Record<string, number> = {}
        c.forEach(x => { const t = x.contract_type || 'Outros'; byType[t] = (byType[t] || 0) + 1 })
        setStats({ total: c.length, ativos, vencendo, oportunidades: (opps || []).length })
        setRecentContracts(c.slice(0, 5))
        setOpportunities(opps || [])
        setChartData(Object.entries(byType).map(([name, value]) => ({ name, value })))
      } catch {
        // Erro silencioso: o timeout global do supabase.ts (30s) já trata hangs
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const statCards = [
    { label: 'Total de Contratos', value: stats.total, icon: FileText, color: 'bg-navy-900 text-white', iconBg: 'bg-white/10', accent: '' },
    { label: 'Contratos Ativos', value: stats.ativos, icon: Users, color: 'bg-navy-800 text-white', iconBg: 'bg-white/10', accent: '' },
    { label: 'Vencendo em 30 dias', value: stats.vencendo, icon: Clock, color: stats.vencendo > 0 ? 'bg-amber-500 text-white' : 'bg-navy-700 text-white', iconBg: 'bg-white/10', accent: '' },
    { label: 'Oportunidades', value: stats.oportunidades, icon: TrendingUp, color: 'bg-navy-700 text-white', iconBg: 'bg-white/10', accent: '' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, iconBg }) => (
          <div key={label} className={`rounded-2xl p-5 ${color} shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-sm opacity-70 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-navy-800 mb-6">Contratos por Tipo</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? '#1E1A34' : i === 1 ? '#00A499' : '#94a3b8'} />)}
                  <LabelList dataKey="value" position="top" style={{ fontSize: '12px', fill: '#64748b', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Nenhum dado disponível</div>
          )}
        </div>

        {/* Opportunities */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy-800">Oportunidades</h2>
            <Link to="/oportunidades" className="text-brand text-xs font-medium hover:underline flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {opportunities.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Nenhuma oportunidade</p>
            ) : opportunities.map(op => (
              <div key={op.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-sm font-medium text-navy-800 truncate">{op.type}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{op.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge value={op.risk_level} />
                  <Badge value={op.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Contracts */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-50">
          <h2 className="font-semibold text-navy-800">Contratos Recentes</h2>
          <Link to="/contratos" className="text-brand text-xs font-medium hover:underline flex items-center gap-1">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left">
              {['Contrato', 'Cliente', 'Tipo', 'Status', 'Extração'].map(h => (
                <th key={h} className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {recentContracts.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <Link to={`/contratos/${c.id}`} className="text-sm font-medium text-navy-800 hover:text-brand truncate max-w-[200px] block">
                    {c.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{c.clients?.name || '—'}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{c.contract_type || '—'}</td>
                <td className="px-6 py-4"><Badge value={c.status} /></td>
                <td className="px-6 py-4"><Badge value={c.extraction_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {recentContracts.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">Nenhum contrato cadastrado ainda</div>
        )}
      </div>
    </div>
  )
}
