import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, FileText, Calendar, AlertTriangle, TrendingUp, CheckCircle2, Clock, Pencil, X, Save, Plus, Trash2, Download, Eye, EyeOff, Flag } from 'lucide-react'
import { Badge } from '@/components/UI/Badge'
import { Contract, ContractMetadata, ContractObligation, ContractOpportunity, ContractMilestone } from '@/types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

type EditableMetadata = Partial<Omit<ContractMetadata, 'id' | 'contract_id' | 'raw_extraction' | 'validated_by' | 'validated_at' | 'created_at' | 'updated_at'>>

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [contract, setContract] = useState<Contract | null>(null)
  const [metadata, setMetadata] = useState<ContractMetadata | null>(null)
  const [obligations, setObligations] = useState<ContractObligation[]>([])
  const [opportunities, setOpportunities] = useState<ContractOpportunity[]>([])
  const [loading, setLoading] = useState(true)

  // Edit states
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaForm, setMetaForm] = useState<EditableMetadata>({})
  const [savingMeta, setSavingMeta] = useState(false)

  // Obligation editing
  const [editingOblId, setEditingOblId] = useState<string | null>(null)
  const [oblForm, setOblForm] = useState<Partial<ContractObligation>>({})
  const [addingObl, setAddingObl] = useState(false)
  const [newObl, setNewObl] = useState({ party: '', description: '', due_date: '', is_recurring: false, status: 'pendente' })

  // Milestones
  const [milestones, setMilestones] = useState<ContractMilestone[]>([])
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [savingMilestone, setSavingMilestone] = useState(false)
  const [newMilestone, setNewMilestone] = useState({ title: '', milestone_date: '', type: 'custom', description: '', alerts: { d90: false, d30: false, d15: true, d7: true } })

  // PDF
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [showPdf, setShowPdf] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const [{ data: c }, { data: m }, { data: o }, { data: op }, { data: ms }] = await Promise.all([
        supabase.from('contracts').select('*, clients(*)').eq('id', id).single(),
        supabase.from('contract_metadata').select('*').eq('contract_id', id).single(),
        supabase.from('contract_obligations').select('*').eq('contract_id', id).order('due_date'),
        supabase.from('contract_opportunities').select('*').eq('contract_id', id),
        supabase.from('contract_milestones').select('*').eq('contract_id', id).order('milestone_date'),
      ])
      setContract(c)
      setMetadata(m)
      setObligations(o || [])
      setOpportunities(op || [])
      setMilestones(ms || [])

      // URL assinada do PDF com tratamento de erro
      if (c?.file_path) {
        const { data: urlData } = await supabase.storage.from('contracts').createSignedUrl(c.file_path, 3600)
        if (urlData?.signedUrl) setPdfUrl(urlData.signedUrl)
      }
    } catch {
      // Carregamento silencioso — o estado fica como está
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  // === METADATA EDITING ===
  const startEditMeta = () => {
    if (!metadata) return
    setMetaForm({
      contracting_party: metadata.contracting_party || '',
      contracting_party_document: metadata.contracting_party_document || '',
      contracted_party: metadata.contracted_party || '',
      contracted_party_document: metadata.contracted_party_document || '',
      object_description: metadata.object_description || '',
      start_date: metadata.start_date || '',
      end_date: metadata.end_date || '',
      total_duration: metadata.total_duration || '',
      auto_renewal: metadata.auto_renewal || false,
      renewal_notice_days: metadata.renewal_notice_days || undefined,
      total_value: metadata.total_value || undefined,
      installment_value: metadata.installment_value || undefined,
      installment_count: metadata.installment_count || undefined,
      readjustment_index: metadata.readjustment_index || '',
      penalty_clause: metadata.penalty_clause || '',
      termination_clause: metadata.termination_clause || '',
      jurisdiction: metadata.jurisdiction || '',
      has_confidentiality_clause: metadata.has_confidentiality_clause || false,
      has_liability_limitation: metadata.has_liability_limitation || false,
    })
    setEditingMeta(true)
  }

  const saveMeta = async () => {
    if (!metadata?.id) return
    setSavingMeta(true)
    const { error } = await supabase.from('contract_metadata').update(metaForm).eq('id', metadata.id)
    if (error) {
      toast.error('Erro ao salvar metadados')
    } else {
      toast.success('Metadados atualizados!')
      // Atualiza estado local em vez de recarregar tudo
      setMetadata(prev => prev ? { ...prev, ...metaForm } : prev)
      setEditingMeta(false)
    }
    setSavingMeta(false)
  }

  // === OBLIGATION EDITING ===
  const startEditObl = (obl: ContractObligation) => {
    setEditingOblId(obl.id)
    setOblForm({ party: obl.party, description: obl.description, due_date: obl.due_date || '', is_recurring: obl.is_recurring, status: obl.status })
  }

  const saveObl = async () => {
    if (!editingOblId) return
    const { error } = await supabase.from('contract_obligations').update(oblForm).eq('id', editingOblId)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Obrigação atualizada!')
    setObligations(prev => prev.map(o => o.id === editingOblId ? { ...o, ...oblForm } as ContractObligation : o))
    setEditingOblId(null)
  }

  const toggleOblStatus = async (obl: ContractObligation) => {
    const newStatus = obl.status === 'cumprida' ? 'pendente' : 'cumprida'
    const { error } = await supabase.from('contract_obligations').update({ status: newStatus }).eq('id', obl.id)
    if (error) { toast.error('Erro ao atualizar'); return }
    setObligations(prev => prev.map(o => o.id === obl.id ? { ...o, status: newStatus } : o))
  }

  const deleteObl = async (oblId: string) => {
    if (!confirm('Excluir esta obrigação?')) return
    const { error } = await supabase.from('contract_obligations').delete().eq('id', oblId)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Obrigação excluída')
    setObligations(prev => prev.filter(o => o.id !== oblId))
  }

  const addObligation = async () => {
    if (!newObl.party || !newObl.description) { toast.error('Preencha parte e descrição'); return }
    const { data, error } = await supabase.from('contract_obligations').insert({
      contract_id: id, ...newObl, due_date: newObl.due_date || null
    }).select().single()
    if (error) { toast.error('Erro ao adicionar'); return }
    toast.success('Obrigação adicionada!')
    if (data) setObligations(prev => [...prev, data as ContractObligation])
    setAddingObl(false)
    setNewObl({ party: '', description: '', due_date: '', is_recurring: false, status: 'pendente' })
  }

  // === OPPORTUNITY STATUS ===
  const updateOppStatus = async (oppId: string, status: string) => {
    const { error } = await supabase.from('contract_opportunities').update({ status }).eq('id', oppId)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success('Status atualizado!')
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, status: status as ContractOpportunity['status'] } : o))
  }

  // === MILESTONES ===
  const addMilestone = async () => {
    if (!newMilestone.title || !newMilestone.milestone_date) { toast.error('Preencha título e data'); return }
    setSavingMilestone(true)
    const { data: ms, error } = await supabase.from('contract_milestones').insert({
      contract_id: id, title: newMilestone.title, milestone_date: newMilestone.milestone_date,
      type: newMilestone.type, description: newMilestone.description || null,
    }).select().single()
    if (error || !ms) { toast.error('Erro ao salvar marco'); setSavingMilestone(false); return }
    const alertsToInsert: { contract_id: string; alert_date: string; alert_type: string; days_before: number; message: string; milestone_id: string }[] = []
    const base = new Date(newMilestone.milestone_date + 'T12:00:00')
    const shifts: [keyof typeof newMilestone.alerts, number][] = [['d90', 90], ['d30', 30], ['d15', 15], ['d7', 7]]
    for (const [key, days] of shifts) {
      if (!newMilestone.alerts[key]) continue
      const d = new Date(base); d.setDate(d.getDate() - days)
      alertsToInsert.push({ contract_id: id!, alert_date: d.toISOString().split('T')[0], alert_type: 'vencimento', days_before: days, message: `${days} dias antes: ${newMilestone.title}`, milestone_id: ms.id })
    }
    if (alertsToInsert.length > 0) await supabase.from('contract_alerts').insert(alertsToInsert)
    toast.success('Marco adicionado!')
    setMilestones(prev => [...prev, ms as ContractMilestone].sort((a, b) => a.milestone_date.localeCompare(b.milestone_date)))
    setShowMilestoneModal(false)
    setNewMilestone({ title: '', milestone_date: '', type: 'custom', description: '', alerts: { d90: false, d30: false, d15: true, d7: true } })
    setSavingMilestone(false)
  }

  const deleteMilestone = async (msId: string) => {
    if (!confirm('Excluir este marco e seus alertas?')) return
    const { error } = await supabase.from('contract_milestones').delete().eq('id', msId)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Marco excluído')
    setMilestones(prev => prev.filter(m => m.id !== msId))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
  if (!contract) return <div className="text-center py-16 text-slate-400">Contrato não encontrado</div>

  const raw = (metadata?.raw_extraction || {}) as Record<string, unknown>

  const metaFields = metadata ? [
    { key: 'contracting_party', label: 'Contratante', value: metadata.contracting_party, doc: metadata.contracting_party_document, sub: [raw.contracting_party_nationality, raw.contracting_party_marital_status, raw.contracting_party_profession].filter(Boolean).join(' · ') || null },
    { key: 'contracted_party', label: 'Contratada', value: metadata.contracted_party, doc: metadata.contracted_party_document, sub: [raw.contracted_party_nationality, raw.contracted_party_marital_status, raw.contracted_party_profession].filter(Boolean).join(' · ') || null },
    { key: 'object_description', label: 'Objeto', value: metadata.object_description },
    { key: 'dates', label: 'Vigência', value: metadata.start_date && metadata.end_date ? `${format(new Date(metadata.start_date + 'T12:00:00'), 'dd/MM/yyyy')} → ${format(new Date(metadata.end_date + 'T12:00:00'), 'dd/MM/yyyy')}` : metadata.start_date ? `A partir de ${format(new Date(metadata.start_date + 'T12:00:00'), 'dd/MM/yyyy')}` : null },
    { key: 'total_value', label: 'Valor Total', value: metadata.total_value ? `R$ ${Number(metadata.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : (raw.total_value_description as string | null) || null, sub: metadata.installment_count && metadata.installment_value ? `${metadata.installment_count}x de R$ ${Number(metadata.installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null },
    { key: 'payment', label: 'Pagamento', value: raw.payment_method as string | null, sub: raw.payment_due_day ? `Vencimento: dia ${raw.payment_due_day}` : null },
    { key: 'readjustment', label: 'Reajuste', value: metadata.readjustment_index, sub: [raw.readjustment_periodicity, raw.readjustment_base_date ? `base: ${format(new Date(String(raw.readjustment_base_date) + 'T12:00:00'), 'dd/MM/yyyy')}` : null].filter(Boolean).join(' · ') || null },
    { key: 'auto_renewal', label: 'Renovação Automática', value: metadata.auto_renewal !== null ? (metadata.auto_renewal ? 'Sim' : 'Não') : null, sub: metadata.renewal_notice_days ? `Aviso com ${metadata.renewal_notice_days} dias de antecedência` : null },
    { key: 'termination', label: 'Rescisão', value: raw.termination_notice_days ? `Aviso prévio: ${raw.termination_notice_days} dias` : null, sub: raw.termination_penalty_percentage ? `Multa: ${raw.termination_penalty_percentage}% do valor restante` : null },
    { key: 'late_penalty', label: 'Inadimplemento', value: raw.late_payment_penalty_percentage ? `Multa: ${raw.late_payment_penalty_percentage}%` : null, sub: raw.interest_rate_monthly ? `Juros: ${raw.interest_rate_monthly}% a.m.` : null },
    { key: 'jurisdiction', label: 'Foro', value: metadata.jurisdiction },
    { key: 'has_confidentiality_clause', label: 'Sigilo', value: metadata.has_confidentiality_clause !== null ? (metadata.has_confidentiality_clause ? 'Possui cláusula' : 'Sem cláusula') : null },
    { key: 'has_liability_limitation', label: 'Limitação de Responsabilidade', value: metadata.has_liability_limitation !== null ? (metadata.has_liability_limitation ? 'Possui cláusula' : 'Sem cláusula') : null },
    { key: 'has_exclusivity', label: 'Exclusividade', value: raw.has_exclusivity_clause !== undefined ? (raw.has_exclusivity_clause ? `Sim — ${raw.exclusivity_beneficiary || 'parte não especificada'}` : 'Não') : null },
  ] : []

  const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/painel/contratos" className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl text-navy-900">{contract.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-500">{contract.clients?.name}</span>
            {contract.contract_type && <span className="text-slate-300">·</span>}
            {contract.contract_type && <span className="text-sm text-slate-500">{contract.contract_type}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={contract.status} />
          <Badge value={contract.extraction_status} />
        </div>
      </div>

      {/* PDF Preview */}
      {pdfUrl && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy-800">
              <FileText className="w-4 h-4 text-brand" />
              {contract.file_name || 'Documento'}
              {contract.file_size && <span className="text-xs text-slate-400 font-normal ml-1">({(contract.file_size / 1024).toFixed(0)} KB)</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPdf(!showPdf)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all">
                {showPdf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPdf ? 'Ocultar' : 'Visualizar'}
              </button>
              <a href={pdfUrl} download={contract.file_name} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand-light transition-all">
                <Download className="w-3.5 h-3.5" /> Baixar PDF
              </a>
            </div>
          </div>
          {showPdf && (
            <iframe src={pdfUrl + '#toolbar=1'} className="w-full max-h-[80vh] aspect-[8.5/11] border-0" title="PDF Preview" />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Metadata */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-navy-800 flex items-center gap-2"><FileText className="w-4 h-4 text-brand" /> Dados Extraídos</h2>
              {metadata && !editingMeta && (
                <button onClick={startEditMeta} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand hover:bg-brand/5 transition-all">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              {editingMeta && (
                <div className="flex gap-2">
                  <button onClick={() => setEditingMeta(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100">
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                  <button onClick={saveMeta} disabled={savingMeta} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand-light disabled:opacity-60">
                    <Save className="w-3.5 h-3.5" /> {savingMeta ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>

            {!metadata ? (
              <p className="text-sm text-slate-400 py-4 text-center">Extração não realizada</p>
            ) : editingMeta ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Contratante</label>
                  <input className={inputClass} value={metaForm.contracting_party || ''} onChange={e => setMetaForm(f => ({ ...f, contracting_party: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Doc. Contratante</label>
                  <input className={inputClass} value={metaForm.contracting_party_document || ''} onChange={e => setMetaForm(f => ({ ...f, contracting_party_document: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Contratada</label>
                  <input className={inputClass} value={metaForm.contracted_party || ''} onChange={e => setMetaForm(f => ({ ...f, contracted_party: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Doc. Contratada</label>
                  <input className={inputClass} value={metaForm.contracted_party_document || ''} onChange={e => setMetaForm(f => ({ ...f, contracted_party_document: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Objeto</label>
                  <textarea rows={3} className={inputClass} value={metaForm.object_description || ''} onChange={e => setMetaForm(f => ({ ...f, object_description: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Início</label>
                  <input type="date" className={inputClass} value={metaForm.start_date || ''} onChange={e => setMetaForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Término</label>
                  <input type="date" className={inputClass} value={metaForm.end_date || ''} onChange={e => setMetaForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Valor Total (R$)</label>
                  <input type="number" step="0.01" className={inputClass} value={metaForm.total_value ?? ''} onChange={e => setMetaForm(f => ({ ...f, total_value: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className={labelClass}>Valor Parcela (R$)</label>
                  <input type="number" step="0.01" className={inputClass} value={metaForm.installment_value ?? ''} onChange={e => setMetaForm(f => ({ ...f, installment_value: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className={labelClass}>Nº Parcelas</label>
                  <input type="number" className={inputClass} value={metaForm.installment_count ?? ''} onChange={e => setMetaForm(f => ({ ...f, installment_count: e.target.value ? Number(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className={labelClass}>Índice de Reajuste</label>
                  <input className={inputClass} value={metaForm.readjustment_index || ''} onChange={e => setMetaForm(f => ({ ...f, readjustment_index: e.target.value }))} placeholder="IPCA, IGP-M..." />
                </div>
                <div>
                  <label className={labelClass}>Foro</label>
                  <input className={inputClass} value={metaForm.jurisdiction || ''} onChange={e => setMetaForm(f => ({ ...f, jurisdiction: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Duração Total</label>
                  <input className={inputClass} value={metaForm.total_duration || ''} onChange={e => setMetaForm(f => ({ ...f, total_duration: e.target.value }))} placeholder="12 meses" />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Cláusula Penal</label>
                  <textarea rows={2} className={inputClass} value={metaForm.penalty_clause || ''} onChange={e => setMetaForm(f => ({ ...f, penalty_clause: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Cláusula de Rescisão</label>
                  <textarea rows={2} className={inputClass} value={metaForm.termination_clause || ''} onChange={e => setMetaForm(f => ({ ...f, termination_clause: e.target.value }))} />
                </div>
                <div className="col-span-2 flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300" checked={metaForm.auto_renewal || false} onChange={e => setMetaForm(f => ({ ...f, auto_renewal: e.target.checked }))} />
                    Renovação Automática
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300" checked={metaForm.has_confidentiality_clause || false} onChange={e => setMetaForm(f => ({ ...f, has_confidentiality_clause: e.target.checked }))} />
                    Cláusula de Sigilo
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300" checked={metaForm.has_liability_limitation || false} onChange={e => setMetaForm(f => ({ ...f, has_liability_limitation: e.target.checked }))} />
                    Limitação de Responsabilidade
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {metaFields.filter(f => f.value !== null && f.value !== undefined && f.value !== '').map(({ label, value, doc, sub }) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-50">
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">{label}</p>
                    <p className="text-sm text-navy-800">{value}</p>
                    {doc && <p className="text-xs text-slate-400 mt-0.5">{doc}</p>}
                    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Obligations */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-navy-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-brand" /> Obrigações ({obligations.length})</h2>
              <button onClick={() => setAddingObl(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand hover:bg-brand/5 transition-all">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            {/* Add obligation form */}
            {addingObl && (
              <div className="mb-4 p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-3">
                <p className="text-xs font-semibold text-brand">Nova Obrigação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input className={inputClass} placeholder="Parte responsável" value={newObl.party} onChange={e => setNewObl(f => ({ ...f, party: e.target.value }))} />
                  <input type="date" className={inputClass} value={newObl.due_date} onChange={e => setNewObl(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <textarea rows={2} className={inputClass} placeholder="Descrição da obrigação" value={newObl.description} onChange={e => setNewObl(f => ({ ...f, description: e.target.value }))} />
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300" checked={newObl.is_recurring} onChange={e => setNewObl(f => ({ ...f, is_recurring: e.target.checked }))} />
                  Recorrente
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setAddingObl(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
                  <button onClick={addObligation} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand-light">Salvar</button>
                </div>
              </div>
            )}

            {obligations.length === 0 && !addingObl ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhuma obrigação identificada</p>
            ) : (
              <div className="space-y-2">
                {obligations.map(ob => (
                  editingOblId === ob.id ? (
                    <div key={ob.id} className="p-3 rounded-xl border border-brand/20 bg-brand/5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input className={inputClass} value={oblForm.party || ''} onChange={e => setOblForm(f => ({ ...f, party: e.target.value }))} />
                        <input type="date" className={inputClass} value={oblForm.due_date || ''} onChange={e => setOblForm(f => ({ ...f, due_date: e.target.value }))} />
                      </div>
                      <textarea rows={2} className={inputClass} value={oblForm.description || ''} onChange={e => setOblForm(f => ({ ...f, description: e.target.value }))} />
                      <div className="flex items-center justify-between">
                        <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" value={oblForm.status} onChange={e => setOblForm(f => ({ ...f, status: e.target.value }))}>
                          <option value="pendente">Pendente</option>
                          <option value="cumprida">Cumprida</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingOblId(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
                          <button onClick={saveObl} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand-light">Salvar</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={ob.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 group hover:border-slate-200 transition-all">
                      <button onClick={() => toggleOblStatus(ob)} className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${ob.status === 'cumprida' ? 'border-emerald-400 bg-emerald-400' : 'border-slate-300 hover:border-brand'}`}>
                        {ob.status === 'cumprida' && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-navy-800 ${ob.status === 'cumprida' ? 'line-through opacity-60' : ''}`}>{ob.description}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500 font-medium">{ob.party}</span>
                          {ob.due_date && <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(ob.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>}
                          {ob.is_recurring && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Recorrente</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditObl(ob)} className="p-1 text-slate-400 hover:text-brand"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteObl(ob.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-navy-800 flex items-center gap-2"><Flag className="w-4 h-4 text-brand" /> Marcos do Contrato ({milestones.length})</h2>
              <button onClick={() => setShowMilestoneModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand hover:bg-brand/5 transition-all">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
            {milestones.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhum marco cadastrado</p>
            ) : (
              <div className="space-y-2">
                {milestones.map(ms => {
                  const typeLabels: Record<string, string> = { vencimento: 'Vencimento', renovacao: 'Renovação', pagamento: 'Pagamento', revisao: 'Revisão', compliance: 'Compliance', custom: 'Personalizado' }
                  const typeColors: Record<string, string> = { vencimento: 'bg-red-50 text-red-700', renovacao: 'bg-blue-50 text-blue-700', pagamento: 'bg-emerald-50 text-emerald-700', revisao: 'bg-amber-50 text-amber-700', compliance: 'bg-purple-50 text-purple-700', custom: 'bg-slate-100 text-slate-600' }
                  return (
                    <div key={ms.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 group hover:border-slate-200 transition-all">
                      <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Flag className="w-3.5 h-3.5 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy-800">{ms.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColors[ms.type] || typeColors.custom}`}>{typeLabels[ms.type] || ms.type}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(ms.milestone_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                        </div>
                        {ms.description && <p className="text-xs text-slate-400 mt-1">{ms.description}</p>}
                      </div>
                      <button onClick={() => deleteMilestone(ms.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Penalties */}
          {(metadata?.penalty_clause || metadata?.termination_clause) && !editingMeta && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-semibold text-navy-800 mb-3 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4 text-amber-500" /> Penalidades</h3>
              {metadata?.penalty_clause && <div className="mb-2"><p className="text-xs font-semibold text-slate-500">Multa</p><p className="text-sm text-slate-700 mt-0.5">{metadata.penalty_clause}</p></div>}
              {metadata?.termination_clause && <div><p className="text-xs font-semibold text-slate-500">Rescisão</p><p className="text-sm text-slate-700 mt-0.5">{metadata.termination_clause}</p></div>}
            </div>
          )}

          {/* Vulnerabilidades */}
          {(() => {
            const vulns = opportunities.filter(op => op.type.startsWith('Vulnerabilidade:'))
            if (vulns.length === 0) return null
            return (
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
                <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Vulnerabilidades ({vulns.length})
                </h3>
                <div className="space-y-2">
                  {vulns.map(op => (
                    <div key={op.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-xs font-semibold text-amber-800">{op.type.replace('Vulnerabilidade: ', '')}</p>
                      <p className="text-xs text-amber-700 mt-0.5">{op.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge value={op.risk_level} />
                        <select value={op.status} onChange={e => updateOppStatus(op.id, e.target.value)}
                          className="text-xs border border-amber-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-300 text-amber-700 bg-white">
                          <option value="identificada">Identificada</option>
                          <option value="em_abordagem">Em Abordagem</option>
                          <option value="convertida">Convertida</option>
                          <option value="descartada">Descartada</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Oportunidades de Serviço */}
          {(() => {
            const services = opportunities.filter(op => op.type.startsWith('Serviço B&D:'))
            const legacy = opportunities.filter(op => !op.type.startsWith('Vulnerabilidade:') && !op.type.startsWith('Serviço B&D:'))
            const all = [...services, ...legacy]
            return (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="font-semibold text-navy-800 mb-3 flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-brand" /> Oportunidades de Serviço ({all.length})
                </h3>
                {all.length === 0 ? <p className="text-xs text-slate-400 text-center py-2">Nenhuma identificada</p> : (
                  <div className="space-y-2">
                    {all.map(op => (
                      <div key={op.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-semibold text-navy-700">{op.type.replace('Serviço B&D: ', '')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{op.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge value={op.risk_level} />
                          <select value={op.status} onChange={e => updateOppStatus(op.id, e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand/30 text-slate-600 bg-white">
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
          })()}

          {/* File info */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-navy-800 mb-3 text-sm">Informações</h3>
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500">{contract.file_name || '—'}</p>
              {contract.file_size && <p className="text-xs text-slate-400">{(contract.file_size / 1024).toFixed(0)} KB</p>}
              <p className="text-xs text-slate-400">Criado em {format(new Date(contract.created_at), 'dd/MM/yyyy')}</p>
              {metadata?.validated_at && (
                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
                  <CheckCircle2 className="w-3 h-3" /> Validado em {format(new Date(metadata.validated_at), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Milestone Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-navy-800 text-lg">Novo Marco</h2>
              <button onClick={() => setShowMilestoneModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Título *</label>
                <input className={inputClass} placeholder="Ex: Pagamento Q2, Revisão de SLA" value={newMilestone.title} onChange={e => setNewMilestone(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Data *</label>
                <input type="date" className={inputClass} value={newMilestone.milestone_date} onChange={e => setNewMilestone(f => ({ ...f, milestone_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select className={inputClass} value={newMilestone.type} onChange={e => setNewMilestone(f => ({ ...f, type: e.target.value }))}>
                  <option value="vencimento">Vencimento</option>
                  <option value="renovacao">Renovação</option>
                  <option value="pagamento">Pagamento</option>
                  <option value="revisao">Revisão</option>
                  <option value="compliance">Compliance</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Descrição (opcional)</label>
                <textarea rows={2} className={inputClass} placeholder="Detalhes adicionais..." value={newMilestone.description} onChange={e => setNewMilestone(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Alertas antecipados</label>
                <div className="flex gap-4 mt-2 flex-wrap">
                  {([['d90', '90 dias'], ['d30', '30 dias'], ['d15', '15 dias'], ['d7', '7 dias']] as [keyof typeof newMilestone.alerts, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300" checked={newMilestone.alerts[key]} onChange={e => setNewMilestone(f => ({ ...f, alerts: { ...f.alerts, [key]: e.target.checked } }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowMilestoneModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
                <button type="button" onClick={addMilestone} disabled={savingMilestone} className="flex-1 bg-brand text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-light disabled:opacity-60">
                  {savingMilestone ? 'Salvando...' : 'Salvar Marco'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
