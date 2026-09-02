import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Plus, Search, FileText, Trash2 } from 'lucide-react'
import { Badge } from '@/components/UI/Badge'
import { Contract } from '@/types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function Contracts() {
  const location = useLocation()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [filtered, setFiltered] = useState<Contract[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [clientFilter, setClientFilter] = useState('todos')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('contracts').select('*, clients(name)').order('created_at', { ascending: false })
    setContracts(data || [])
    setFiltered(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const clienteParam = params.get('cliente')
    if (clienteParam) setClientFilter(clienteParam)
  }, [location.search])

  useEffect(() => { load() }, [])

  const clientOptions = useMemo(() => {
    const names = contracts.map(c => c.clients?.name).filter(Boolean) as string[]
    return [...new Set(names)].sort()
  }, [contracts])

  useEffect(() => {
    let f = contracts
    if (search) f = f.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.clients?.name?.toLowerCase().includes(search.toLowerCase()))
    if (statusFilter !== 'todos') f = f.filter(c => c.status === statusFilter)
    if (clientFilter !== 'todos') f = f.filter(c => c.clients?.name === clientFilter)
    setFiltered(f)
  }, [search, statusFilter, clientFilter, contracts])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Tem certeza que deseja excluir este contrato?')) return
    await supabase.from('contract_alerts').delete().eq('contract_id', id)
    await supabase.from('contract_obligations').delete().eq('contract_id', id)
    await supabase.from('contract_opportunities').delete().eq('contract_id', id)
    await supabase.from('contract_metadata').delete().eq('contract_id', id)
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir contrato')
    else { toast.success('Contrato excluído!'); load() }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Contratos</h1>
          <p className="text-slate-500 text-sm mt-1">{contracts.length} contrato(s) cadastrado(s)</p>
        </div>
        <Link to="/painel/contratos/novo" className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Novo Contrato
        </Link>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contratos..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white text-slate-700">
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="em_renovacao">Em Renovação</option>
          <option value="encerrado">Encerrado</option>
          <option value="arquivado">Arquivado</option>
        </select>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white text-slate-700">
          <option value="todos">Todos os clientes</option>
          {clientOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum contrato encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>{['Título', 'Cliente', 'Tipo', 'Status', 'Extração', 'Criado em', ''].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-navy-800">{c.title}</p>
                    {c.file_name && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{c.file_name}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.clients?.name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.contract_type || '—'}</td>
                  <td className="px-6 py-4"><Badge value={c.status} /></td>
                  <td className="px-6 py-4"><Badge value={c.extraction_status} /></td>
                  <td className="px-6 py-4 text-sm text-slate-500">{format(new Date(c.created_at), 'dd/MM/yyyy')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/painel/contratos/${c.id}`} className="text-brand text-sm font-medium hover:underline">Ver</Link>
                      <button onClick={(e) => handleDelete(c.id, e)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
