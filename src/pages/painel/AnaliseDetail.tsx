import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ContractAnalysis } from '@/types'
import type { AnaliseDocumento, Gravidade } from '@/lib/corplaw/types'
import { gerarHTML } from '@/lib/corplaw/gerarHTML'
import { AnalysisStatusBadge } from '@/components/analysis/AnalysisStatusBadge'
import { ChatLateral } from '@/components/analysis-corplaw/ChatLateral'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeft, Download, FileText, CheckCircle2, Loader2, Send, AlertCircle, Trash2,
  Star, ChevronDown, ChevronRight, AlertTriangle, ShieldCheck, TrendingUp
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import clsx from 'clsx'

type TabKey = 'resumo' | 'matriz' | 'riscos' | 'recomendacoes' | 'avaliacao'

const GRAVIDADE_CLS: Record<Gravidade, string> = {
  CRÍTICO: 'bg-red-100 text-red-700 border-red-300',
  ALTO:    'bg-orange-100 text-orange-700 border-orange-300',
  MÉDIO:   'bg-amber-100 text-amber-700 border-amber-300',
  BAIXO:   'bg-emerald-100 text-emerald-700 border-emerald-300',
}

export default function AnaliseCorplawDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('resumo')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [exportingPDF, setExportingPDF] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('contract_analyses')
      .select('*, clients(name), author:created_by(id, full_name, role), reviewer:reviewer_id(id, full_name, role)')
      .eq('id', id).single()
    if (error) { toast.error('Análise não encontrada'); navigate('/painel/analise'); return }
    setAnalysis(data as ContractAnalysis)
    setLoading(false)
  }, [id, navigate])

  useEffect(() => {
    load()
    const ch = supabase.channel(`corplaw-detail-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contract_analyses', filter: `id=eq.${id}` }, () => load())
      .subscribe()
    channelRef.current = ch
    return () => { ch.unsubscribe() }
  }, [id, load])

  const perms = useMemo(() => {
    if (!analysis || !profile) return { canSubmit: false, canApprove: false, canDelete: false, chatEnabled: false, chatReason: '' }
    const isAuthor = analysis.created_by === profile.id
    const isReviewer = analysis.reviewer_id === profile.id
    const isSocio = profile.role === 'socio'
    const isAssistente = profile.role === 'assistente'
    let canSubmit = false, canApprove = false, chatEnabled = false, chatReason = ''
    switch (analysis.status) {
      case 'rascunho_estagiario':
        canSubmit = isAuthor && isAssistente
        chatEnabled = isAuthor && isAssistente
        if (!chatEnabled) chatReason = 'Chat só disponível para o autor estagiário'
        break
      case 'aguardando_revisao':
        canApprove = isReviewer || isSocio
        chatEnabled = isReviewer || isSocio
        if (!chatEnabled) chatReason = 'Chat só disponível para o supervisor'
        break
      case 'rascunho':
        canApprove = isAuthor || isSocio
        chatEnabled = isAuthor || isSocio
        if (!chatEnabled) chatReason = 'Chat só disponível para o autor'
        break
      case 'finalizado':
        chatReason = 'Análise finalizada — chat desabilitado'
        break
      default:
        chatReason = 'Chat indisponível neste status'
    }
    return { canSubmit, canApprove, canDelete: isSocio || (profile.role === 'advogado' && isAuthor), chatEnabled, chatReason }
  }, [analysis, profile])

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
    navigate('/painel/analise')
  }

  const handleExportHTML = () => {
    if (!analysis) return
    const analise = (analysis.edited_sections || analysis.ai_sections) as unknown as AnaliseDocumento
    if (!analise) { toast.error('Sem dados de análise para exportar'); return }
    const html = gerarHTML(analise, analysis.title)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Analise-${analysis.title.replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('HTML gerado!')
  }

  const handleExportPDF = () => {
    if (!analysis) return
    const analise = (analysis.edited_sections || analysis.ai_sections) as unknown as AnaliseDocumento
    if (!analise) { toast.error('Sem dados de análise para exportar'); return }
    setExportingPDF(true)
    const worker = new Worker(new URL('../../workers/corplaw-pdf.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ success: boolean; buffer?: ArrayBuffer; error?: string }>) => {
      if (e.data.success && e.data.buffer) {
        const blob = new Blob([e.data.buffer], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Parecer-${analysis.title.replace(/\s+/g, '-')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('PDF gerado!')
      } else {
        toast.error('Falha ao gerar PDF: ' + (e.data.error || 'erro desconhecido'))
      }
      setExportingPDF(false)
      worker.terminate()
    }
    worker.onerror = (err) => {
      toast.error('Erro no worker: ' + err.message)
      setExportingPDF(false)
      worker.terminate()
    }
    worker.postMessage({
      title: analysis.title,
      clientName: analysis.clients?.name,
      createdAt: format(new Date(analysis.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      analise,
    })
  }

  const toggleExpanded = (codigo: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  if (loading) return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
  if (!analysis) return null

  if (analysis.status === 'processando') {
    return (
      <div className="max-w-lg mx-auto py-24 text-center">
        <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
        <p className="text-lg font-semibold text-slate-800">Analista de Contratos processando...</p>
        <p className="text-slate-500 text-sm mt-1">Análise rica com Opus 5 pode levar 1-3 minutos.</p>
      </div>
    )
  }

  if (analysis.status === 'falhou') {
    return (
      <div className="max-w-lg mx-auto py-24 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-semibold text-slate-800">Falha na análise</p>
        <Link to="/painel/analise/nova" className="inline-block mt-4 bg-brand text-white px-6 py-2.5 rounded-xl text-sm font-medium">Nova análise</Link>
      </div>
    )
  }

  const analise = (analysis.edited_sections || analysis.ai_sections) as unknown as AnaliseDocumento
  const showChat = !!analise

  return (
    <div className={clsx(showChat ? 'max-w-none' : 'max-w-5xl mx-auto', 'space-y-6')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/painel/analise')} className="mt-1 p-2 rounded-xl hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl text-navy-900">{analysis.title}</h1>
              <AnalysisStatusBadge status={analysis.status} />
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wider">Corplaw</span>
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
          <button onClick={handleExportPDF} disabled={exportingPDF} className="flex items-center gap-2 bg-brand hover:bg-brand-light disabled:opacity-60 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm">
            {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {exportingPDF ? 'Gerando PDF...' : 'Exportar PDF'}
          </button>
          <button onClick={handleExportHTML} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-brand border border-brand/30 px-3 py-2 rounded-xl text-sm font-medium shadow-sm">
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
            <p className="mt-0.5">{analysis.reviewer?.full_name} precisa aprovar antes de liberar.</p>
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

      {/* Cards KPI */}
      {analise && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <KpiCard icon={AlertTriangle} label="Riscos identificados" value={String(analise.riscos?.length || 0)} color="bg-red-50 text-red-700" />
          <KpiCard icon={TrendingUp} label="Exposição total" value={analise.exposicao_total_brl != null ? `R$ ${analise.exposicao_total_brl.toLocaleString('pt-BR')}` : '—'} color="bg-orange-50 text-orange-700" />
          <KpiCard icon={ShieldCheck} label="Pontos positivos" value={String(analise.pontos_positivos?.length || 0)} color="bg-emerald-50 text-emerald-700" />
          <KpiCard icon={Star} label="Avaliação" value={`${analise.avaliacao_geral}/5`} color="bg-navy-50 text-navy-700" />
        </div>
      )}

      {/* Split: análise + chat lateral (quando aplicável) */}
      {analise && (
        <div className={clsx('grid gap-6', showChat ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1')}>
          <div className="min-w-0 space-y-4">
            <div className="border-b border-slate-200">
              <nav className="flex gap-1 -mb-px overflow-x-auto">
                {([
                  { key: 'resumo', label: 'Resumo' },
                  { key: 'matriz', label: 'Matriz de risco' },
                  { key: 'riscos', label: `Riscos (${analise.riscos?.length || 0})` },
                  { key: 'recomendacoes', label: `Recomendações (${analise.recomendacoes_prioritarias?.length || 0})` },
                  { key: 'avaliacao', label: 'Avaliação' },
                ] as { key: TabKey; label: string }[]).map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={clsx('px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      tab === t.key ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-navy-800')}>
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
          </div>

          {showChat && (
            <div className="h-[600px] lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
              <ChatLateral
                analysisId={analysis.id}
                disabled={!perms.chatEnabled}
                disabledReason={perms.chatReason}
                onAnaliseUpdated={() => load()}
              />
            </div>
          )}
        </div>
      )}

      {/* Ações principais */}
      <div className="flex justify-end pt-4 pb-8 gap-3 border-t border-slate-100">
        {perms.canSubmit && (
          <button onClick={handleSubmitReview} disabled={actionLoading} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar para revisão do supervisor
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

// ─── Subcomponents ────────────────────────────────────────────────────────

export function KpiCard({ icon: Icon, label, value, color }: { icon: typeof AlertTriangle; label: string; value: string; color: string }) {
  return (
    <div className={clsx('rounded-2xl p-4', color)}>
      <div className="flex items-center gap-2 mb-2 opacity-80"><Icon className="w-4 h-4" /><span className="text-xs uppercase tracking-wider font-semibold">{label}</span></div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

export function TabResumo({ analise }: { analise: AnaliseDocumento }) {
  return (
    <div className="space-y-4">
      <Section title="Objeto">{analise.objeto}</Section>
      <Section title="Resumo da operação">{analise.resumo_operacao}</Section>
      <Section title="Contexto do negócio">{analise.contexto_negocio}</Section>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {analise.valor_total && <MetaCard label="Valor total" value={analise.valor_total} />}
        {analise.vigencia && <MetaCard label="Vigência" value={analise.vigencia} />}
        {analise.estrutura_pagamento && <MetaCard label="Pagamento" value={analise.estrutura_pagamento} />}
      </div>
      {analise.partes?.length > 0 && (
        <Section title="Partes">
          <ul className="list-disc list-inside space-y-1 text-sm">
            {analise.partes.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </Section>
      )}
      {analise.pontos_positivos?.length > 0 && (
        <Section title="Pontos positivos" icon={ShieldCheck}>
          <ul className="space-y-2">
            {analise.pontos_positivos.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {analise.prazo_relevante && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-900"><p className="font-semibold">Prazo relevante</p><p>{analise.prazo_relevante}</p></div>
        </div>
      )}
    </div>
  )
}

export function TabMatriz({ analise }: { analise: AnaliseDocumento }) {
  const PROB_INDEX = { 'Baixa': 0, 'Média': 1, 'Alta': 2, 'Muito Alta': 3 } as const
  const IMP_INDEX = { 'Baixo': 0, 'Médio': 1, 'Alto': 2, 'Muito Alto': 3 } as const
  const grid: string[][][] = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => [] as string[]))
  for (const r of analise.riscos || []) {
    const col = PROB_INDEX[r.probabilidade] ?? 0
    const row = 3 - (IMP_INDEX[r.impacto] ?? 0)
    grid[row][col].push(r.codigo)
  }
  const probLabels = ['Baixa', 'Média', 'Alta', 'Muito Alta']
  const impLabels = ['Muito Alto', 'Alto', 'Médio', 'Baixo']
  const cellColor = (col: number, row: number) => {
    const score = (col + 1) * (row + 1)
    if (score >= 9) return 'bg-red-100'
    if (score >= 4) return 'bg-amber-100'
    return 'bg-emerald-100'
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Matriz de risco 4×4 (Probabilidade × Impacto)</p>
      <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-1">
        <div />
        {probLabels.map(p => <div key={p} className="text-xs text-center text-slate-500 font-medium py-2">{p}</div>)}
        {impLabels.map((imp, row) => (
          <div key={imp} className="contents">
            <div className="text-xs text-slate-500 font-medium pr-2 flex items-center">{imp}</div>
            {probLabels.map((_, col) => (
              <div key={col} className={clsx('min-h-[70px] rounded-lg border border-white flex flex-wrap items-center justify-center gap-1 p-2', cellColor(col, 3 - row))}>
                {grid[row][col].map(cod => (
                  <span key={cod} className="text-xs font-bold text-slate-800 bg-white/70 rounded px-1.5 py-0.5">{cod}</span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-4">← IMPACTO (linha) · PROBABILIDADE (coluna) →</p>
    </div>
  )
}

export function TabRiscos({ analise, expanded, toggle }: { analise: AnaliseDocumento; expanded: Set<string>; toggle: (c: string) => void }) {
  return (
    <div className="space-y-3">
      {(analise.riscos || []).map(r => {
        const isOpen = expanded.has(r.codigo)
        return (
          <div key={r.codigo} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <button onClick={() => toggle(r.codigo)} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold text-navy-800 bg-slate-100 rounded px-2 py-0.5">{r.codigo}</span>
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded border', GRAVIDADE_CLS[r.gravidade])}>{r.gravidade}</span>
                  <span className="text-xs text-slate-500 bg-slate-100 rounded px-2 py-0.5">{r.tipo}</span>
                </div>
                <p className="text-sm font-semibold text-navy-900">{r.titulo}</p>
                <p className="text-xs text-slate-500 mt-1">Prob: {r.probabilidade} · Impacto: {r.impacto} · Exp: {r.exposicao_brl != null ? `R$ ${r.exposicao_brl.toLocaleString('pt-BR')}` : '—'}</p>
              </div>
              {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 p-5 space-y-4 text-sm">
                <Field label="Origem" value={r.origem} />
                <Field label="Descrição" value={r.descricao} />
                <Field label="Cruzamento com outras cláusulas" value={r.cruzamento} />
                <Field label="Cenário" value={r.cenario} />
                <Field label="Impacto potencial" value={r.impacto_potencial} />
                <Field label="Recomendação" value={r.recomendacao} highlight />
                {r.clausulas?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Cláusulas envolvidas</p>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 text-xs">
                      {r.clausulas.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TabRecomendacoes({ analise }: { analise: AnaliseDocumento }) {
  return (
    <div className="space-y-3">
      {(analise.recomendacoes_prioritarias || []).map((r, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center">{r.urgencia}</span>
            <p className="text-sm font-semibold text-navy-900">{r.acao}</p>
          </div>
          <p className="text-xs text-slate-500 mt-2"><strong>Se ignorado:</strong> {r.impacto_se_ignorado}</p>
        </div>
      ))}
    </div>
  )
}

export function TabAvaliacao({ analise }: { analise: AnaliseDocumento }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={clsx('w-6 h-6', i < analise.avaliacao_geral ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />
        ))}
        <span className="text-2xl font-bold text-navy-900">{analise.avaliacao_geral}/5</span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{analise.avaliacao_texto}</p>
    </div>
  )
}

function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: typeof AlertTriangle }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
      </div>
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </div>
  )
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-navy-800 font-medium">{value}</p>
    </div>
  )
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={clsx('text-sm leading-relaxed', highlight ? 'text-accent font-medium' : 'text-slate-700')}>{value}</p>
    </div>
  )
}
