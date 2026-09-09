import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ContractProblem, Client, MissingClause, ProblemResolutionStatus } from '@/types'
import {
  Plus, Search, ShieldAlert, ChevronDown, ChevronUp,
  X, Loader2, Building2, Calendar, DollarSign, FileText,
  AlertTriangle, Pencil, Trash2, RefreshCw, TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'

const CATEGORIES = [
  { value: 'multa',         label: 'Multa' },
  { value: 'rescisão',      label: 'Rescisão Antecipada' },
  { value: 'litígio',       label: 'Litígio/Disputa' },
  { value: 'inadimplência', label: 'Inadimplência' },
  { value: 'reajuste',      label: 'Reajuste não previsto' },
  { value: 'garantia',      label: 'Falta de garantia' },
  { value: 'outro',         label: 'Outro' },
]

const CAT_COLORS: Record<string, string> = {
  multa:         'bg-red-100 text-red-700',
  rescisão:      'bg-orange-100 text-orange-700',
  litígio:       'bg-purple-100 text-purple-700',
  inadimplência: 'bg-rose-100 text-rose-700',
  reajuste:      'bg-amber-100 text-amber-700',
  garantia:      'bg-yellow-100 text-yellow-700',
  outro:         'bg-slate-100 text-slate-600',
}

const STATUS_OPTIONS: { value: ProblemResolutionStatus; label: string; cls: string }[] = [
  { value: 'aberto',             label: 'Aberto',            cls: 'bg-slate-100 text-slate-600' },
  { value: 'em_acompanhamento',  label: 'Em acompanhamento', cls: 'bg-blue-100 text-blue-700' },
  { value: 'prevenido',          label: 'Prevenido',         cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'materializou',       label: 'Materializou',      cls: 'bg-red-100 text-red-700' },
  { value: 'resolvido',          label: 'Resolvido',         cls: 'bg-navy-100 text-navy-700' },
]

interface WorkspaceOption { id: string; nome: string }

// ─── Card de problema individual ─────────────────────────────────────────────
function ProblemCard({
  problem,
  onEdit,
  onDelete,
}: {
  problem: ContractProblem
  onEdit: (p: ContractProblem) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const catLabel = CATEGORIES.find(c => c.value === problem.impact_category)?.label || problem.impact_category
  const catColor = CAT_COLORS[problem.impact_category] || CAT_COLORS.outro
  const pendingAI = !problem.ai_analyzed_at
  const statusInfo = STATUS_OPTIONS.find(s => s.value === (problem.resolution_status || 'aberto'))

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${catColor}`}>
                {catLabel}
              </span>
              {statusInfo && (
                <span className={clsx('text-xs font-medium px-2.5 py-0.5 rounded-full', statusInfo.cls)}>
                  {statusInfo.label}
                </span>
              )}
              {problem.contract_type && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {problem.contract_type}
                </span>
              )}
              {problem.ai_analyzed_at ? (
                <span className="text-xs text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                  IA analisada
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin" /> IA processando…
                </span>
              )}
            </div>
            <p className="text-sm text-slate-800 leading-snug line-clamp-2">{problem.description}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {problem.counterparty_name && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Building2 className="w-3 h-3" />{problem.counterparty_name}
                </span>
              )}
              {problem.clients?.name && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <FileText className="w-3 h-3" />{problem.clients.name}
                </span>
              )}
              {problem.workspaces?.nome && (
                <span className="flex items-center gap-1 text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  <Building2 className="w-3 h-3" />{problem.workspaces.nome}
                </span>
              )}
              {problem.event_date && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(problem.event_date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              )}
              {problem.financial_impact != null && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <DollarSign className="w-3 h-3" />
                  R$ {Number(problem.financial_impact).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
              {problem.economia_gerada != null && problem.economia_gerada > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <TrendingUp className="w-3 h-3" />
                  R$ {Number(problem.economia_gerada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} evitados
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEdit(problem) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(problem.id) }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {open
              ? <ChevronUp className="w-4 h-4 text-slate-400 ml-1" />
              : <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
            }
          </div>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {/* Descrição completa */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Descrição Completa</p>
            <p className="text-sm text-slate-700 leading-relaxed">{problem.description}</p>
          </div>

          {/* Aguardando IA */}
          {pendingAI && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-amber-700">
                A IA está identificando as cláusulas ausentes. A página atualizará automaticamente quando concluir.
              </p>
            </div>
          )}

          {/* Cláusulas identificadas pela IA */}
          {problem.missing_clauses && problem.missing_clauses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Cláusulas Identificadas como Ausentes pela IA
              </p>
              <div className="space-y-2">
                {problem.missing_clauses.map((mc: MissingClause, i: number) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-800">{mc.clause_type}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{mc.description}</p>
                    {mc.suggested_text && (
                      <div className="mt-2 bg-white border border-amber-200 rounded-lg p-2">
                        <p className="text-xs font-medium text-slate-500 mb-1">Texto sugerido:</p>
                        <p className="text-xs text-slate-700 italic">{mc.suggested_text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendações da IA */}
          {problem.ai_recommendations && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Recomendações da IA</p>
              <p className="text-sm text-slate-700 leading-relaxed">{problem.ai_recommendations}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal de criação / edição ────────────────────────────────────────────────
type FormState = {
  description: string
  counterparty_name: string
  counterparty_document: string
  contract_type: string
  impact_category: string
  event_date: string
  financial_impact: string
  economia_gerada: string
  resolution_status: ProblemResolutionStatus
  workspace_id: string
  client_search: string
  client_id: string
  analyze_ai: boolean
}

const EMPTY_FORM: FormState = {
  description: '', counterparty_name: '', counterparty_document: '',
  contract_type: '', impact_category: 'outro', event_date: '',
  financial_impact: '', economia_gerada: '', resolution_status: 'aberto',
  workspace_id: '', client_search: '', client_id: '', analyze_ai: true,
}

function ProblemModal({
  editing,
  onClose,
  onSuccess,
}: {
  editing: ContractProblem | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { profile } = useAuth()
  const isEdit = !!editing

  const [form, setForm] = useState<FormState>(() => {
    if (editing) {
      return {
        description: editing.description,
        counterparty_name: editing.counterparty_name || '',
        counterparty_document: editing.counterparty_document || '',
        contract_type: editing.contract_type || '',
        impact_category: editing.impact_category,
        event_date: editing.event_date || '',
        financial_impact: editing.financial_impact != null ? String(editing.financial_impact) : '',
        economia_gerada: editing.economia_gerada != null ? String(editing.economia_gerada) : '',
        resolution_status: editing.resolution_status || 'aberto',
        workspace_id: editing.workspace_id || '',
        client_search: editing.clients?.name || '',
        client_id: editing.client_id || '',
        analyze_ai: !editing.ai_analyzed_at,
      }
    }
    return EMPTY_FORM
  })

  const [clients, setClients] = useState<Client[]>([])
  const [showClientList, setShowClientList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [workspacesList, setWorkspacesList] = useState<WorkspaceOption[]>([])

  useEffect(() => {
    supabase.from('workspaces').select('id, nome').order('nome').then(({ data }) => {
      setWorkspacesList((data as WorkspaceOption[]) || [])
    })
  }, [])

  const loadClients = async (q: string) => {
    if (!q) { setClients([]); return }
    const { data } = await supabase.from('clients').select('*').ilike('name', `%${q}%`).limit(5)
    setClients(data || [])
    setShowClientList(true)
  }

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim()) { toast.error('Descreva o problema'); return }
    setSaving(true)

    const showsSavings = form.resolution_status === 'prevenido' || form.resolution_status === 'resolvido'
    const payload = {
      description: form.description.trim(),
      counterparty_name: form.counterparty_name.trim() || null,
      counterparty_document: form.counterparty_document.trim() || null,
      contract_type: form.contract_type.trim() || null,
      impact_category: form.impact_category,
      event_date: form.event_date || null,
      financial_impact: form.financial_impact
        ? parseFloat(form.financial_impact.replace(',', '.'))
        : null,
      economia_gerada: showsSavings && form.economia_gerada
        ? parseFloat(form.economia_gerada.replace(',', '.'))
        : null,
      resolution_status: form.resolution_status,
      workspace_id: form.workspace_id || null,
      client_id: form.client_id || null,
    }

    if (isEdit) {
      // Edição
      const { error } = await supabase
        .from('contract_problems')
        .update(payload)
        .eq('id', editing!.id)

      if (error) { toast.error('Erro ao atualizar problema'); setSaving(false); return }

      // Re-analisar com IA se solicitado
      if (form.analyze_ai) {
        fetch('/api/analyze-problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problemId: editing!.id,
            description: form.description.trim(),
            category: form.impact_category,
            contractType: form.contract_type.trim() || undefined,
          }),
        }).catch(console.error)
        toast.success('Problema atualizado! A IA está re-analisando as cláusulas.')
      } else {
        toast.success('Problema atualizado!')
      }
    } else {
      // Criação
      const { data: inserted, error } = await supabase
        .from('contract_problems')
        .insert({ ...payload, created_by: profile?.id })
        .select()
        .single()

      if (error || !inserted) { toast.error('Erro ao salvar problema'); setSaving(false); return }

      if (form.analyze_ai) {
        fetch('/api/analyze-problem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problemId: inserted.id,
            description: form.description.trim(),
            category: form.impact_category,
            contractType: form.contract_type.trim() || undefined,
          }),
        }).catch(console.error)
        toast.success('Problema registrado! A IA está analisando as cláusulas.')
      } else {
        toast.success('Problema registrado!')
      }
    }

    setSaving(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display text-xl text-navy-900">
            {isEdit ? 'Editar Problema' : 'Registrar Problema'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição do problema *</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Descreva o que ocorreu no contrato e quais foram as consequências…"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
            />
          </div>

          {/* Categoria + Tipo de contrato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoria *</label>
              <select
                value={form.impact_category}
                onChange={e => set('impact_category', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de contrato</label>
              <input
                value={form.contract_type}
                onChange={e => set('contract_type', e.target.value)}
                placeholder="Ex: Prestação de Serviços"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          </div>

          {/* Contraparte */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome da contraparte</label>
              <input
                value={form.counterparty_name}
                onChange={e => set('counterparty_name', e.target.value)}
                placeholder="Nome da empresa ou pessoa"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">CNPJ/CPF</label>
              <input
                value={form.counterparty_document}
                onChange={e => set('counterparty_document', e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          </div>

          {/* Data + Impacto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Data do problema</label>
              <input
                type="date"
                value={form.event_date}
                onChange={e => set('event_date', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Impacto financeiro (R$)</label>
              <input
                value={form.financial_impact}
                onChange={e => set('financial_impact', e.target.value)}
                placeholder="0,00"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
            </div>
          </div>

          {/* Status + Empresa contratante */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select
                value={form.resolution_status}
                onChange={e => set('resolution_status', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Empresa contratante afetada <span className="text-slate-400 font-normal">(workspace)</span>
              </label>
              <select
                value={form.workspace_id}
                onChange={e => set('workspace_id', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="">— nenhum (problema histórico interno) —</option>
                {workspacesList.map(w => <option key={w.id} value={w.id}>{w.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Economia gerada — condicional se status = prevenido/resolvido */}
          {(form.resolution_status === 'prevenido' || form.resolution_status === 'resolvido') && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                Economia gerada (R$) <span className="text-emerald-600 font-normal text-xs">— quanto o CorpLaw evitou de perda</span>
              </label>
              <input
                value={form.economia_gerada}
                onChange={e => set('economia_gerada', e.target.value)}
                placeholder="0,00"
                className="w-full border border-emerald-200 bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-500"
              />
              <p className="text-xs text-emerald-700 mt-1.5">
                Esse valor entra no relatório anual de valor gerado que a CorpLaw apresenta ao cliente.
              </p>
            </div>
          )}

          {/* Cliente */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Cliente afetado <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              value={form.client_search}
              onChange={e => { set('client_search', e.target.value); loadClients(e.target.value) }}
              onBlur={() => setTimeout(() => setShowClientList(false), 150)}
              placeholder="Buscar cliente…"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            {showClientList && clients.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {clients.map(c => (
                  <button key={c.id} type="button"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                    onClick={() => { set('client_id', c.id); set('client_search', c.name); setShowClientList(false) }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {form.client_id && (
              <button type="button" onClick={() => { set('client_id', ''); set('client_search', '') }}
                className="mt-1 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X className="w-3 h-3" /> Remover cliente
              </button>
            )}
          </div>

          {/* Analisar com IA */}
          <label className="flex items-center gap-3 cursor-pointer select-none bg-brand/5 border border-brand/20 rounded-xl px-4 py-3">
            <input
              type="checkbox"
              checked={form.analyze_ai}
              onChange={e => set('analyze_ai', e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {isEdit ? 'Re-analisar com IA' : 'Analisar com IA agora'}
              </p>
              <p className="text-xs text-slate-500">
                {isEdit
                  ? 'A IA atualizará as cláusulas identificadas com base na nova descrição'
                  : 'A IA identificará as cláusulas ausentes e sugerirá texto para prevenir recorrência'
                }
              </p>
            </div>
          </label>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Salvando…' : isEdit ? 'Salvar Alterações' : 'Registrar Problema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function BancoProblemas() {
  const [problems, setProblems] = useState<ContractProblem[]>([])
  const [filtered, setFiltered] = useState<ContractProblem[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [workspaceFilter, setWorkspaceFilter] = useState('')
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProblem, setEditingProblem] = useState<ContractProblem | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('contract_problems')
      .select('*, clients(name), workspaces(nome)')
      .order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar banco de problemas')
    else { setProblems(data || []); setFiltered(data || []) }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.from('workspaces').select('id, nome').order('nome').then(({ data }) => {
      setWorkspaces((data as WorkspaceOption[]) || [])
    })
  }, [])

  useEffect(() => {
    load()

    // Realtime: re-carrega quando a IA termina de analisar um problema
    const channel = supabase
      .channel('problems-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contract_problems' },
        () => { load() }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [load])

  useEffect(() => {
    let result = problems
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.description.toLowerCase().includes(q) ||
        p.counterparty_name?.toLowerCase().includes(q) ||
        p.contract_type?.toLowerCase().includes(q) ||
        p.clients?.name?.toLowerCase().includes(q) ||
        p.workspaces?.nome?.toLowerCase().includes(q)
      )
    }
    if (catFilter) result = result.filter(p => p.impact_category === catFilter)
    if (statusFilter) result = result.filter(p => (p.resolution_status || 'aberto') === statusFilter)
    if (workspaceFilter) result = result.filter(p => p.workspace_id === workspaceFilter)
    setFiltered(result)
  }, [search, catFilter, statusFilter, workspaceFilter, problems])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este problema?')) return
    const { error } = await supabase.from('contract_problems').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else { toast.success('Problema excluído'); load() }
  }

  const handleEdit = (p: ContractProblem) => {
    setEditingProblem(p)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingProblem(null)
  }

  // Métricas
  const totalImpact = problems.reduce((sum, p) => sum + (p.financial_impact || 0), 0)
  const totalEconomia = problems.reduce((sum, p) => sum + (p.economia_gerada || 0), 0)
  const typeCounts = problems.reduce<Record<string, number>>((acc, p) => {
    if (p.contract_type) acc[p.contract_type] = (acc[p.contract_type] || 0) + 1
    return acc
  }, {})
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
  const counterpartyCounts = problems.reduce<Record<string, number>>((acc, p) => {
    if (p.counterparty_name) acc[p.counterparty_name] = (acc[p.counterparty_name] || 0) + 1
    return acc
  }, {})
  const topCounterparty = Object.entries(counterpartyCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Banco de Problemas</h1>
          <p className="text-slate-500 text-sm mt-1">
            {problems.length} problema(s) registrado(s) — base de conhecimento do escritório
          </p>
        </div>
        <button
          onClick={() => { setEditingProblem(null); setModalOpen(true) }}
          className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Registrar Problema
        </button>
      </div>

      {/* Métricas */}
      {problems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipo mais problemático</span>
            </div>
            <p className="text-lg font-semibold text-slate-800">{topType ? topType[0] : '—'}</p>
            {topType && <p className="text-xs text-slate-400">{topType[1]} ocorrência(s)</p>}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contraparte recorrente</span>
            </div>
            <p className="text-lg font-semibold text-slate-800 truncate">{topCounterparty ? topCounterparty[0] : '—'}</p>
            {topCounterparty && <p className="text-xs text-slate-400">{topCounterparty[1]} ocorrência(s)</p>}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Exposição total</span>
            </div>
            <p className="text-lg font-semibold text-slate-800">
              R$ {totalImpact.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-400">soma dos impactos informados</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Economia gerada</span>
            </div>
            <p className="text-lg font-semibold text-emerald-800">
              R$ {totalEconomia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-emerald-600">valor evitado para os clientes</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar problemas…"
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand w-60"
          />
        </div>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={workspaceFilter}
          onChange={e => setWorkspaceFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        >
          <option value="">Todos os clientes</option>
          {workspaces.map(w => <option key={w.id} value={w.id}>{w.nome}</option>)}
        </select>
        {(search || catFilter || statusFilter || workspaceFilter) && (
          <button
            onClick={() => { setSearch(''); setCatFilter(''); setStatusFilter(''); setWorkspaceFilter('') }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">
            {problems.length === 0 ? 'Nenhum problema registrado ainda' : 'Nenhum resultado para os filtros'}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {problems.length === 0
              ? 'Registre problemas ocorridos para enriquecer as análises contratuais'
              : 'Tente ajustar os filtros de busca'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <ProblemCard key={p.id} problem={p} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ProblemModal
          editing={editingProblem}
          onClose={handleCloseModal}
          onSuccess={() => { handleCloseModal(); load() }}
        />
      )}
    </div>
  )
}
