import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ContractAnalysis, AnalysisSection, AnalysisAISections, Client } from '@/types'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
  ArrowLeft, Download, Mail, CheckCircle2, Loader2, Send,
  AlertCircle, Bold, Italic, List, ListOrdered, ChevronDown, ChevronUp,
  FileText, Save, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { AnalysisStatusBadge } from '@/components/analysis/AnalysisStatusBadge'

const RISK_CONFIG = {
  alto:  { label: 'Alto',  cls: 'bg-red-100 text-red-700 border-red-200' },
  medio: { label: 'Médio', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  baixo: { label: 'Baixo', cls: 'bg-green-100 text-green-700 border-green-200' },
}

// ─── Editor de seção individual ───────────────────────────────────────────────
function SectionEditor({
  section,
  onSave,
  readOnly,
}: {
  section: AnalysisSection
  onSave: (id: string, content: string) => void
  readOnly: boolean
}) {
  const [open, setOpen] = useState(true)
  const [dirty, setDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: section.conteudo.replace(/\n/g, '<br/>'),
    editable: !readOnly,
    onUpdate: () => {
      if (readOnly) return
      setDirty(true)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const text = editor?.getText({ blockSeparator: '\n' }) || ''
        onSave(section.id, text)
        setDirty(false)
      }, 2000)
    },
  })

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  const handleManualSave = () => {
    if (readOnly) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const text = editor?.getText({ blockSeparator: '\n' }) || ''
    onSave(section.id, text)
    setDirty(false)
  }

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="font-semibold text-sm text-navy-900 uppercase tracking-wide">
          {section.titulo}
        </span>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600">não salvo</span>}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!readOnly && (
            <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
              <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors ${editor?.isActive('bold') ? 'bg-slate-200 text-slate-800' : ''}`}>
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors ${editor?.isActive('italic') ? 'bg-slate-200 text-slate-800' : ''}`}>
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors ${editor?.isActive('bulletList') ? 'bg-slate-200 text-slate-800' : ''}`}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors ${editor?.isActive('orderedList') ? 'bg-slate-200 text-slate-800' : ''}`}>
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1" />
              <button type="button" onClick={handleManualSave}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-light font-medium px-2 py-1 rounded-lg hover:bg-brand/5 transition-colors">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
          )}

          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none min-h-[120px] text-slate-700 focus:outline-none
              [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[120px]
              [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_li]:my-0.5"
          />
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ContractAnalysisDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('contract_analyses')
      .select('*, clients(name, email), author:created_by(id, full_name, role), reviewer:reviewer_id(id, full_name, role)')
      .eq('id', id)
      .single()
    if (error) { toast.error('Análise não encontrada'); navigate('/painel/analise'); return }
    setAnalysis(data as ContractAnalysis)
    setLoading(false)
  }, [id, navigate])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`analysis-detail-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contract_analyses', filter: `id=eq.${id}` }, () => load())
      .subscribe()
    channelRef.current = channel
    return () => { channel.unsubscribe() }
  }, [id, load])

  // ═══ Permissions ═══
  const perms = useMemo(() => {
    if (!analysis || !profile) return { canEdit: false, canSubmit: false, canApprove: false, canDelete: false }
    const isAuthor = analysis.created_by === profile.id
    const isReviewer = analysis.reviewer_id === profile.id
    const isSocio = profile.role === 'socio'
    const isAdvogado = profile.role === 'advogado'
    const isAssistente = profile.role === 'assistente'

    let canEdit = false
    let canSubmit = false
    let canApprove = false

    switch (analysis.status) {
      case 'rascunho_estagiario':
        canEdit = isAuthor && isAssistente
        canSubmit = isAuthor && isAssistente
        break
      case 'aguardando_revisao':
        canEdit = isReviewer || isSocio
        canApprove = isReviewer || isSocio
        break
      case 'rascunho':
        canEdit = isAuthor || isSocio
        canApprove = isAuthor || isSocio
        break
      case 'finalizado':
      case 'falhou':
      case 'processando':
        // nada
        break
    }

    const canDelete = isSocio || (isAdvogado && isAuthor)
    return { canEdit, canSubmit, canApprove, canDelete }
  }, [analysis, profile])

  const handleSaveSection = useCallback(async (sectionId: string, content: string) => {
    if (!analysis || !analysis.edited_sections) return
    const updated: AnalysisAISections = {
      ...analysis.edited_sections,
      secoes: analysis.edited_sections.secoes.map(s =>
        s.id === sectionId ? { ...s, conteudo: content } : s
      ),
    }
    const { error } = await supabase
      .from('contract_analyses')
      .update({ edited_sections: updated, updated_at: new Date().toISOString() })
      .eq('id', analysis.id)
    if (error) toast.error('Erro ao salvar seção')
    else {
      setAnalysis(prev => prev ? { ...prev, edited_sections: updated } : prev)
      toast.success('Seção salva', { duration: 1500 })
    }
  }, [analysis])

  const handleSubmitForReview = async () => {
    if (!analysis) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/submit-analysis-for-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ analysis_id: analysis.id }),
    })
    setActionLoading(false)
    if (r.ok) { toast.success('Enviado para revisão do seu supervisor!'); load() }
    else {
      const err = await r.json()
      toast.error(err.error || 'Erro ao enviar para revisão')
    }
  }

  const handleApprove = async () => {
    if (!analysis) return
    if (!confirm('Aprovar e liberar este parecer para o cliente?')) return
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/approve-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ analysis_id: analysis.id }),
    })
    setActionLoading(false)
    if (r.ok) { toast.success('Parecer aprovado e liberado!'); load() }
    else {
      const err = await r.json()
      toast.error(err.error || 'Erro ao aprovar')
    }
  }

  const handleDelete = async () => {
    if (!analysis) return
    setDeleting(true)
    await supabase.storage.from('analyses').remove([`${analysis.id}.pdf`])
    const { error } = await supabase.from('contract_analyses').delete().eq('id', analysis.id)
    if (error) { toast.error('Erro ao excluir análise'); setDeleting(false); return }
    toast.success('Análise excluída')
    navigate('/painel/analise')
  }

  const handleExportPDF = () => {
    if (!analysis) return
    const secs = analysis.edited_sections || analysis.ai_sections
    if (!secs) return
    const cName = (analysis.clients as Client & { name?: string })?.name
    setExportingPDF(true)

    const worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (e: MessageEvent<{ success: boolean; buffer?: ArrayBuffer; error?: string }>) => {
      if (e.data.success && e.data.buffer) {
        const blob = new Blob([e.data.buffer], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Parecer-${analysis.title.replace(/\s+/g, '-')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('PDF gerado com sucesso!')
      } else toast.error('Erro ao gerar PDF. Tente novamente.')
      setExportingPDF(false)
      worker.terminate()
    }
    worker.onerror = () => { toast.error('Erro ao gerar PDF. Tente novamente.'); setExportingPDF(false); worker.terminate() }
    worker.postMessage({ title: analysis.title, clientName: cName, sections: secs })
  }

  const buildGmailLink = () => {
    if (!analysis) return '#'
    const clientEmail = (analysis.clients as Client & { email?: string })?.email || ''
    const subject = encodeURIComponent(`Parecer Contratual — ${analysis.title}`)
    const body = encodeURIComponent(`Prezado(a),\n\nSegue em anexo o parecer contratual referente a: ${analysis.title}.\n\nAtenciosamente,\nSeu Contrato`)
    return `https://mail.google.com/mail/?view=cm&to=${clientEmail}&su=${subject}&body=${body}`
  }

  if (loading) return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
  if (!analysis) return null

  if (analysis.status === 'processando') {
    return (
      <div className="max-w-lg mx-auto py-24 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 bg-brand/10 rounded-2xl flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800">Gerando Parecer Jurídico…</p>
          <p className="text-slate-500 text-sm mt-1">A IA está analisando o contrato. Aguarde alguns instantes.</p>
        </div>
      </div>
    )
  }

  if (analysis.status === 'falhou') {
    return (
      <div className="max-w-lg mx-auto py-24 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800">Falha na análise</p>
          <p className="text-slate-500 text-sm mt-1">Ocorreu um erro ao gerar o parecer. Tente criar uma nova análise.</p>
        </div>
        <Link to="/painel/analise/nova" className="bg-brand text-white px-6 py-2.5 rounded-xl text-sm font-medium">Nova Análise</Link>
      </div>
    )
  }

  const sections = analysis.edited_sections || analysis.ai_sections
  const risk = analysis.risk_level && RISK_CONFIG[analysis.risk_level as keyof typeof RISK_CONFIG]
  const clientName = (analysis.clients as Client & { name?: string })?.name

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/painel/analise')} className="mt-1 p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl text-navy-900">{analysis.title}</h1>
              {risk && <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${risk.cls}`}>Risco {risk.label}</span>}
              <AnalysisStatusBadge status={analysis.status} />
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {clientName && <span className="mr-2">Cliente: {clientName} ·</span>}
              {format(new Date(analysis.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {analysis.author && <span> · Autor: {analysis.author.full_name}</span>}
              {analysis.reviewer && <span> · Supervisor: {analysis.reviewer.full_name}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {perms.canDelete && (deleteConfirm ? (
            <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <span className="text-xs text-red-700 font-medium mr-1">Excluir?</span>
              <button onClick={handleDelete} disabled={deleting} className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-0.5 rounded hover:bg-red-100 transition-colors">
                {deleting ? 'Excluindo…' : 'Confirmar'}
              </button>
              <button onClick={() => setDeleteConfirm(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all" title="Excluir análise">
              <Trash2 className="w-4 h-4" />
            </button>
          ))}
          {analysis.status === 'finalizado' && (
            <a href={buildGmailLink()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
              <Mail className="w-4 h-4" /> Enviar
            </a>
          )}
          {sections && (
            <button onClick={handleExportPDF} disabled={exportingPDF} className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-3 py-2 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-60">
              {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exportingPDF ? 'Gerando…' : 'Exportar PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Contexto por status */}
      {analysis.status === 'aguardando_revisao' && !perms.canApprove && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Aguardando revisão do supervisor</p>
            <p className="mt-0.5">{analysis.reviewer?.full_name} precisa aprovar antes desta análise ser liberada.</p>
          </div>
        </div>
      )}
      {analysis.status === 'aguardando_revisao' && perms.canApprove && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm text-navy-900">
            <p className="font-semibold">Análise aguardando sua revisão</p>
            <p className="mt-0.5">Revise o conteúdo e clique em "Aprovar e liberar" para publicar ao cliente.</p>
          </div>
        </div>
      )}

      {/* Resumo executivo */}
      {sections?.resumo_executivo && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-brand" />
            <span className="text-xs font-semibold text-brand uppercase tracking-wide">Resumo Executivo</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{sections.resumo_executivo}</p>
        </div>
      )}

      {/* Metadados */}
      {sections?.partes && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sections.partes.contratante && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Contratante</p>
              <p className="text-sm text-slate-800 font-medium">{sections.partes.contratante}</p>
            </div>
          )}
          {sections.partes.contratada && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Contratada</p>
              <p className="text-sm text-slate-800 font-medium">{sections.partes.contratada}</p>
            </div>
          )}
          {sections.objeto && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Objeto</p>
              <p className="text-sm text-slate-800">{sections.objeto}</p>
            </div>
          )}
        </div>
      )}

      {/* Seções editáveis */}
      {sections?.secoes && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
            Seções do Parecer {perms.canEdit ? '— edite diretamente abaixo' : '(somente leitura)'}
          </p>
          {sections.secoes.map(s => (
            <SectionEditor key={s.id} section={s} onSave={handleSaveSection} readOnly={!perms.canEdit} />
          ))}
        </div>
      )}

      {/* Ações principais por status */}
      <div className="flex justify-end pt-2 pb-8 gap-3">
        {perms.canSubmit && (
          <button onClick={handleSubmitForReview} disabled={actionLoading}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-60">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar para revisão do supervisor
          </button>
        )}
        {perms.canApprove && (
          <button onClick={handleApprove} disabled={actionLoading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-60">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Aprovar e liberar
          </button>
        )}
      </div>
    </div>
  )
}
