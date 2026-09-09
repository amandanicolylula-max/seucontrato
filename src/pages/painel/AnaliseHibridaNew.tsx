import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Client } from '@/types'
import { Upload, X, Loader2, FileText, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { NIVEIS, CONFIG_PADRAO, type NivelEsforco } from '@/lib/corplaw/esforco'
import type { Perspectiva } from '@/lib/corplaw/types'

const PERSPECTIVAS: { valor: Perspectiva; label: string; descricao: string }[] = [
  { valor: 'recebido_de_terceiro', label: 'Recebido de terceiro', descricao: 'Cliente decide se assina' },
  { valor: 'escrito_pelo_cliente',  label: 'Escrito pelo cliente', descricao: 'Ainda não enviado' },
  { valor: 'viabilidade',           label: 'Análise de viabilidade', descricao: 'Contrato não fechado' },
  { valor: 'vigente_prevencao',     label: 'Já vigente — prevenção', descricao: 'Foco em riscos atuais' },
]

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
}

export default function AnaliseHibridaNew() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [negocio, setNegocio] = useState('')
  const [perspectiva, setPerspectiva] = useState<Perspectiva>('recebido_de_terceiro')
  const [preocupacoes, setPreocupacoes] = useState('')
  const [effort, setEffort] = useState<NivelEsforco>(CONFIG_PADRAO.analise)
  const [mainFile, setMainFile] = useState<File | null>(null)
  const [accessoryFiles, setAccessoryFiles] = useState<File[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [showClients, setShowClients] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const searchClients = async (q: string) => {
    if (!q.trim()) { setClients([]); return }
    const { data } = await supabase.from('clients').select('*').ilike('name', `%${q}%`).limit(6)
    setClients(data || [])
    setShowClients(true)
  }

  const mainDropzone = useDropzone({ accept: ACCEPT, maxFiles: 1, onDrop: files => setMainFile(files[0] || null) })
  const accessoryDropzone = useDropzone({ accept: ACCEPT, onDrop: files => setAccessoryFiles(prev => [...prev, ...files]) })

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    channelRef.current?.unsubscribe()
  }, [])

  const waitFor = (analysisId: string) => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    const ch = supabase.channel(`hib-${analysisId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contract_analyses', filter: `id=eq.${analysisId}` },
        payload => {
          const status = (payload.new as { status: string }).status
          if (['rascunho', 'rascunho_estagiario', 'finalizado'].includes(status)) {
            cleanup()
            navigate(`/painel/analise-hibrida/${analysisId}`)
          } else if (status === 'falhou') {
            cleanup(); setProcessing(false)
            toast.error('A análise falhou. Verifique o arquivo.')
          }
        })
      .subscribe()
    channelRef.current = ch
  }

  const cleanup = () => {
    channelRef.current?.unsubscribe()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mainFile) return toast.error('Envie o contrato principal')
    if (!title.trim()) return toast.error('Dê um título à análise')
    if (!negocio.trim()) return toast.error('Descreva o negócio')

    setProcessing(true)
    try {
      const { data: analysis, error: insErr } = await supabase.from('contract_analyses').insert({
        title: title.trim(), client_id: clientId,
        analysis_module: 'hibrido', status: 'processando',
        briefing: { negocio: negocio.trim(), perspectiva, preocupacoes: preocupacoes.trim() },
        effort, created_by: profile?.id,
        workspace_id: profile?.workspace_id || null,
      }).select().single()
      if (insErr || !analysis) throw new Error(insErr?.message || 'Falha ao criar análise')

      const mainExt = mainFile.name.split('.').pop()?.toLowerCase()
      const mainPath = `${analysis.id}/main.${mainExt}`
      const { error: upErr } = await supabase.storage.from('analyses').upload(mainPath, mainFile, { upsert: true })
      if (upErr) throw new Error('Falha no upload: ' + upErr.message)

      const accessoryPaths: string[] = []
      for (let i = 0; i < accessoryFiles.length; i++) {
        const f = accessoryFiles[i]
        const ext = f.name.split('.').pop()?.toLowerCase()
        const path = `${analysis.id}/acessorio-${i}.${ext}`
        const { error } = await supabase.storage.from('analyses').upload(path, f, { upsert: true })
        if (!error) accessoryPaths.push(path)
      }

      await fetch('/api/analyze-hibrida', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysis.id, mainFilePath: mainPath, accessoryPaths,
          briefing: { negocio: negocio.trim(), perspectiva, preocupacoes: preocupacoes.trim() }, effort,
        }),
      })
      waitFor(analysis.id)
    } catch (err) {
      setProcessing(false)
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    }
  }

  if (processing) {
    return (
      <div className="max-w-lg mx-auto py-24 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800">Análise Híbrida processando…</p>
          <p className="text-slate-500 text-sm mt-1">Base Corplaw + camadas híbridas. 1-3 minutos.</p>
          <p className="text-slate-400 text-xs mt-3">{elapsed}s decorridos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl text-navy-900">Nova Análise Híbrida</h1>
          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold uppercase tracking-wider">Beta</span>
        </div>
        <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          Análise Corplaw rica + camadas do advogado (seções livres + anotações + PDF)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Título da análise *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: Contrato Fornecedor XPTO"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente afetado <span className="text-slate-400 font-normal">(opcional)</span></label>
          <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); searchClients(e.target.value) }}
            onBlur={() => setTimeout(() => setShowClients(false), 150)} placeholder="Buscar…"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20" />
          {showClients && clients.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg">
              {clients.map(c => (
                <button key={c.id} type="button" className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50"
                  onClick={() => { setClientId(c.id); setClientSearch(c.name); setShowClients(false) }}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-100">
          <h2 className="font-semibold text-navy-800 text-sm">Briefing da análise</h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Negócio do cliente *</label>
            <input value={negocio} onChange={e => setNegocio(e.target.value)} required
              placeholder="Ex: SaaS B2B de gestão financeira"
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Perspectiva *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERSPECTIVAS.map(p => (
                <button key={p.valor} type="button" onClick={() => setPerspectiva(p.valor)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                    perspectiva === p.valor ? 'border-accent bg-accent/5 text-accent' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}>
                  <p className="font-medium">{p.label}</p>
                  <p className="opacity-70 mt-0.5 text-[10px]">{p.descricao}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Preocupações <span className="text-slate-400 font-normal">(opcional)</span></label>
            <textarea value={preocupacoes} onChange={e => setPreocupacoes(e.target.value)} rows={2}
              placeholder="Ex: cliente tem dúvidas sobre exclusividade"
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nível de esforço</label>
            <select value={effort} onChange={e => setEffort(e.target.value as NivelEsforco)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20">
              {NIVEIS.map(n => <option key={n.valor} value={n.valor}>{n.label} — {n.descricao}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Contrato principal *</label>
          <div {...mainDropzone.getRootProps()} className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer">
            <input {...mainDropzone.getInputProps()} />
            {mainFile ? (
              <div className="flex items-center justify-center gap-2 text-sm text-navy-800">
                <FileText className="w-4 h-4 text-purple-600" /> {mainFile.name}
                <button type="button" onClick={e => { e.stopPropagation(); setMainFile(null) }} className="ml-2 text-slate-400 hover:text-red-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">PDF, DOCX ou TXT</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Documentos acessórios <span className="text-slate-400 font-normal">(opcional)</span></label>
          <div {...accessoryDropzone.getRootProps()} className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer">
            <input {...accessoryDropzone.getInputProps()} />
            <p className="text-xs text-slate-500">Adicione contratos relacionados, aditivos, anexos…</p>
          </div>
          {accessoryFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {accessoryFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5">
                  <span className="text-slate-600">{f.name}</span>
                  <button type="button" onClick={() => setAccessoryFiles(prev => prev.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={!mainFile || !title.trim() || !negocio.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
          Iniciar Análise Híbrida
        </button>
      </form>
    </div>
  )
}
