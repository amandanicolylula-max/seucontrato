import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ContractAnalysis } from '@/types'
import type { AnaliseHibrida, SecaoLivre } from '@/lib/corplaw/types-hibrido'
import { gerarHTML } from '@/lib/corplaw/gerarHTML'
import { AnalysisStatusBadge } from '@/components/analysis/AnalysisStatusBadge'
import { ChatLateral } from '@/components/analysis-corplaw/ChatLateral'
import { TabResumo, TabMatriz, TabRiscos, TabRecomendacoes, TabAvaliacao, KpiCard } from './AnaliseCorplawDetail'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeft, Download, CheckCircle2, Loader2, Send, AlertCircle, Trash2,
  Star, AlertTriangle, ShieldCheck, TrendingUp, Plus, X, FileText, Sparkles, Printer, Save
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type TabKey = 'resumo' | 'matriz' | 'riscos' | 'recomendacoes' | 'avaliacao' | 'secoes_livres' | 'anotacoes'

export default function AnaliseHibridaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('resumo')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [anotacoesDraft, setAnotacoesDraft] = useState('')
  const [anotacoesDirty, setAnotacoesDirty] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('contract_analyses')
      .select('*, clients(name), author:created_by(id, full_name, role), reviewer:reviewer_id(id, full_name, role)')
      .eq('id', id).single()
    if (error) { toast.error('Análise não encontrada'); navigate('/painel/analise-hibrida'); return }
    setAnalysis(data as ContractAnalysis)
    // Sync anotações se veio do banco
    const analise = (data.edited_sections || data.ai_sections) as unknown as AnaliseHibrida
    if (analise && !anotacoesDirty) setAnotacoesDraft(analise.anotacoes_advogado || '')
    setLoading(false)
  }, [id, navigate, anotacoesDirty])

  useEffect(() => {
    load()
    const ch = supabase.channel(`hib-detail-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contract_analyses', filter: `id=eq.${id}` }, () => load())
      .subscribe()
    channelRef.current = ch
    return () => { ch.unsubscribe() }
  }, [id, load])

  const perms = useMemo(() => {
    if (!analysis || !profile) return { canSubmit: false, canApprove: false, canDelete: false, canEdit: false, chatEnabled: false, chatReason: '' }
    const isAuthor = analysis.created_by === profile.id
    const isReviewer = analysis.reviewer_id === profile.id
    const isSocio = profile.role === 'socio'
    const isAssistente = profile.role === 'assistente'
    let canSubmit = false, canApprove = false, canEdit = false, chatEnabled = false, chatReason = ''
    switch (analysis.status) {
      case 'rascunho_estagiario':
        canSubmit = isAuthor && isAssistente
        canEdit = isAuthor && isAssistente
        chatEnabled = canEdit
        if (!chatEnabled) chatReason = 'Só para o autor estagiário'
        break
      case 'aguardando_revisao':
        canApprove = isReviewer || isSocio
        canEdit = isReviewer || isSocio
        chatEnabled = canEdit
        if (!chatEnabled) chatReason = 'Só para o supervisor'
        break
      case 'rascunho':
        canApprove = isAuthor || isSocio
        canEdit = isAuthor || isSocio
        chatEnabled = canEdit
        if (!chatEnabled) chatReason = 'Só para o autor'
        break
      case 'finalizado':
        chatReason = 'Análise finalizada — só leitura'
        break
    }
    return { canSubmit, canApprove, canEdit, canDelete: isSocio || (profile.role === 'advogado' && isAuthor), chatEnabled, chatReason }
  }, [analysis, profile])

  const analise = analysis ? ((analysis.edited_sections || analysis.ai_sections) as unknown as AnaliseHibrida) : null

  const handleSaveHybridField = useCallback(async (updater: (prev: AnaliseHibrida) => AnaliseHibrida) => {
    if (!analysis || !analise) return
    const updated = updater(analise)
    const { error } = await supabase
      .from('contract_analyses')
      .update({ edited_sections: updated, updated_at: new Date().toISOString() })
      .eq('id', analysis.id)
    if (error) toast.error('Erro ao salvar')
    else setAnalysis(prev => prev ? ({ ...prev, edited_sections: updated as unknown as ContractAnalysis['edited_sections'] }) : prev)
  }, [analysis, analise])

  const addSecaoLivre = () => {
    if (!analise) return
    const nova: SecaoLivre = {
      id: crypto.randomUUID(),
      titulo: 'Nova seção',
      conteudo: '',
      created_by: profile?.id,
      created_at: new Date().toISOString(),
    }
    handleSaveHybridField(a => ({ ...a, secoes_livres: [...(a.secoes_livres || []), nova] }))
  }

  const updateSecaoLivre = (id: string, patch: Partial<SecaoLivre>) => {
    handleSaveHybridField(a => ({
      ...a,
      secoes_livres: (a.secoes_livres || []).map(s => s.id === id ? { ...s, ...patch } : s),
    }))
  }

  const removeSecaoLivre = (id: string) => {
    if (!confirm('Remover esta seção livre?')) return
    handleSaveHybridField(a => ({
      ...a,
      secoes_livres: (a.secoes_livres || []).filter(s => s.id !== id),
    }))
  }

  const saveAnotacoes = () => {
    handleSaveHybridField(a => ({ ...a, anotacoes_advogado: anotacoesDraft }))
    setAnotacoesDirty(false)
    toast.success('Anotações salvas')
  }

  const toggleExpanded = (codigo: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const handleSubmitReview = async () => {
    if (!analysis) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/submit-analysis-for-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ analysis_id: analysis.id }),
    })
    setActionLoading(false)
    if (r.ok) { toast.success('Enviado para revisão!'); load() }
    else { const e = await r.json(); toast.error(e.error || 'Erro') }
  }

  const handleApprove = async () => {
    if (!analysis || !confirm('Aprovar e liberar pro cliente?')) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/approve-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ analysis_id: analysis.id }),
    })
    setActionLoading(false)
    if (r.ok) { toast.success('Aprovado!'); load() }
    else { const e = await r.json(); toast.error(e.error || 'Erro') }
  }

  const handleDelete = async () => {
    if (!analysis || !confirm('Excluir esta análise?')) return
    await supabase.from('contract_analyses').delete().eq('id', analysis.id)
    toast.success('Excluída')
    navigate('/painel/analise-hibrida')
  }

  const handleExportHTML = () => {
    if (!analysis || !analise) return
    const html = gerarHTML(analise, analysis.title)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Analise-${analysis.title.replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('HTML gerado')
  }

  const handleExportPDF = () => {
    if (!analysis || !analise) return
    const html = gerarHTML(analise, analysis.title)
    const printWindow = window.open('', '_blank')
    if (!printWindow) { toast.error('Popup bloqueado. Habilite popups.'); return }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }
    toast.success('Use "Salvar como PDF" na janela de impressão')
  }

  if (loading) return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
  if (!analysis) return null

  if (analysis.status === 'processando') {
    return (
      <div className="max-w-lg mx-auto py-24 text-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
        <p className="text-lg font-semibold text-slate-800">Análise Híbrida processando…</p>
        <p className="text-slate-500 text-sm mt-1">Base Corplaw + camadas híbridas. 1-3 minutos.</p>
      </div>
    )
  }

  if (analysis.status === 'falhou') {
    return (
      <div className="max-w-lg mx-auto py-24 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-semibold text-slate-800">Falha na análise</p>
        <Link to="/painel/analise-hibrida/nova" className="inline-block mt-4 bg-brand text-white px-6 py-2.5 rounded-xl text-sm font-medium">Nova análise</Link>
      </div>
    )
  }

  if (!analise) return null

  return (
    <div className="max-w-none space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/painel/analise-hibrida')} className="mt-1 p-2 rounded-xl hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl text-navy-900">{analysis.title}</h1>
              <AnalysisStatusBadge status={analysis.status} />
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Híbrida
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {analysis.clients?.name && <span>{analysis.clients.name} · </span>}
              {format(new Date(analysis.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {analysis.author && <span> · Autor: {analysis.author.full_name}</span>}
              {analysis.reviewer && <span> · Supervisor: {analysis.reviewer.full_name}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {perms.canDelete && (
            <button onClick={handleDelete} className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleExportPDF} className="flex items-center gap-2 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-slate-50">
            <Printer className="w-4 h-4" /> Exportar PDF
          </button>
          <button onClick={handleExportHTML} className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm">
            <Download className="w-4 h-4" /> Exportar HTML
          </button>
        </div>
      </div>

      {/* Status banners */}
      {analysis.status === 'aguardando_revisao' && !perms.canApprove && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Aguardando revisão do supervisor</p>
            <p className="mt-0.5">{analysis.reviewer?.full_name} precisa aprovar.</p>
          </div>
        </div>
      )}
      {analysis.status === 'aguardando_revisao' && perms.canApprove && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-accent mt-0.5" />
          <div className="text-sm text-navy-900">
            <p className="font-semibold">Análise aguardando sua revisão</p>
            <p className="mt-0.5">Revise e clique em "Aprovar e liberar" para publicar ao cliente.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KpiCard icon={AlertTriangle} label="Riscos" value={String(analise.riscos?.length || 0)} color="bg-red-50 text-red-700" />
        <KpiCard icon={TrendingUp} label="Exposição total" value={analise.exposicao_total_brl != null ? `R$ ${analise.exposicao_total_brl.toLocaleString('pt-BR')}` : '—'} color="bg-orange-50 text-orange-700" />
        <KpiCard icon={ShieldCheck} label="Pontos positivos" value={String(analise.pontos_positivos?.length || 0)} color="bg-emerald-50 text-emerald-700" />
        <KpiCard icon={Star} label="Avaliação" value={`${analise.avaliacao_geral}/5`} color="bg-navy-50 text-navy-700" />
      </div>

      {/* Split: análise + chat */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <div className="border-b border-slate-200">
            <nav className="flex gap-1 -mb-px overflow-x-auto">
              {([
                { key: 'resumo', label: 'Resumo' },
                { key: 'matriz', label: 'Matriz' },
                { key: 'riscos', label: `Riscos (${analise.riscos?.length || 0})` },
                { key: 'recomendacoes', label: `Recomendações (${analise.recomendacoes_prioritarias?.length || 0})` },
                { key: 'avaliacao', label: 'Avaliação' },
                { key: 'secoes_livres', label: `📝 Seções livres (${analise.secoes_livres?.length || 0})` },
                { key: 'anotacoes', label: '📌 Anotações' },
              ] as { key: TabKey; label: string }[]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={clsx('px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    tab === t.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-navy-800')}>
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {tab === 'resumo' && <TabResumo analise={analise} />}
          {tab === 'matriz' && <TabMatriz analise={analise} />}
          {tab === 'riscos' && <TabRiscos analise={analise} expanded={expanded} toggle={toggleExpanded} />}
          {tab === 'recomendacoes' && <TabRecomendacoes analise={analise} />}
          {tab === 'avaliacao' && <TabAvaliacao analise={analise} />}

          {tab === 'secoes_livres' && (
            <SecoesLivresPanel
              secoes={analise.secoes_livres || []}
              canEdit={perms.canEdit}
              onAdd={addSecaoLivre}
              onUpdate={updateSecaoLivre}
              onRemove={removeSecaoLivre}
            />
          )}

          {tab === 'anotacoes' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anotações do advogado</p>
                {anotacoesDirty && perms.canEdit && (
                  <button onClick={saveAnotacoes} className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-800 font-medium">
                    <Save className="w-3.5 h-3.5" /> Salvar
                  </button>
                )}
              </div>
              <textarea
                value={anotacoesDraft}
                onChange={e => { setAnotacoesDraft(e.target.value); setAnotacoesDirty(true) }}
                disabled={!perms.canEdit}
                rows={12}
                placeholder="Escreva aqui suas notas contextuais, observações do escritório, avaliações complementares…"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 disabled:bg-slate-50 resize-y font-mono"
              />
              <p className="text-xs text-slate-400 mt-2">Este campo é livre — use markdown básico para formatar.</p>
            </div>
          )}
        </div>

        <div className="h-[600px] lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
          <ChatLateral
            analysisId={analysis.id}
            disabled={!perms.chatEnabled}
            disabledReason={perms.chatReason}
            onAnaliseUpdated={() => load()}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end pt-4 pb-8 gap-3 border-t border-slate-100">
        {perms.canSubmit && (
          <button onClick={handleSubmitReview} disabled={actionLoading} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar para revisão
          </button>
        )}
        {perms.canApprove && (
          <button onClick={handleApprove} disabled={actionLoading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Aprovar e liberar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Painel de Seções Livres ──────────────────────────────────────────

function SecoesLivresPanel({
  secoes, canEdit, onAdd, onUpdate, onRemove,
}: {
  secoes: SecaoLivre[]
  canEdit: boolean
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<SecaoLivre>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      {canEdit && (
        <button onClick={onAdd} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Adicionar seção livre
        </button>
      )}
      {secoes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Nenhuma seção livre ainda</p>
          <p className="text-xs text-slate-400 mt-1">{canEdit ? 'Adicione notas complementares específicas deste contrato.' : 'Só o autor/supervisor pode adicionar.'}</p>
        </div>
      ) : (
        secoes.map(s => (
          <SecaoLivreItem key={s.id} secao={s} canEdit={canEdit}
            onUpdate={patch => onUpdate(s.id, patch)}
            onRemove={() => onRemove(s.id)} />
        ))
      )}
    </div>
  )
}

function SecaoLivreItem({ secao, canEdit, onUpdate, onRemove }: {
  secao: SecaoLivre
  canEdit: boolean
  onUpdate: (patch: Partial<SecaoLivre>) => void
  onRemove: () => void
}) {
  const [titulo, setTitulo] = useState(secao.titulo)
  const [conteudo, setConteudo] = useState(secao.conteudo)
  const [dirty, setDirty] = useState(false)

  const save = () => { onUpdate({ titulo, conteudo }); setDirty(false); toast.success('Seção salva') }

  return (
    <div className="border border-purple-200 bg-purple-50/30 rounded-2xl p-5">
      <div className="flex items-start gap-2 mb-3">
        <input
          value={titulo} onChange={e => { setTitulo(e.target.value); setDirty(true) }}
          disabled={!canEdit}
          className="flex-1 bg-transparent text-sm font-semibold text-navy-800 focus:outline-none border-b border-transparent focus:border-purple-300 disabled:opacity-70"
        />
        {canEdit && (
          <>
            {dirty && <button onClick={save} className="text-xs text-purple-700 hover:text-purple-800 font-medium px-2 py-1 rounded hover:bg-purple-100">
              <Save className="w-3.5 h-3.5" />
            </button>}
            <button onClick={onRemove} className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      <textarea
        value={conteudo} onChange={e => { setConteudo(e.target.value); setDirty(true) }}
        disabled={!canEdit}
        rows={4}
        placeholder="Conteúdo…"
        className="w-full bg-white border border-purple-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 disabled:opacity-70 resize-y"
      />
    </div>
  )
}
