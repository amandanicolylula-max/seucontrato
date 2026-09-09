import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Client } from '@/types'
import { Upload, X, Loader2, FileText, Search, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const ANALYSIS_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutos

export default function ContractAnalysisNew() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [showClientList, setShowClientList] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  const { profile } = useAuth()
  const navigate = useNavigate()

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setTitle(accepted[0].name.replace(/\.pdf$/i, ''))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20 MB
  })

  const loadClients = async (q: string) => {
    if (!q) { setClients([]); return }
    const { data } = await supabase.from('clients').select('*').ilike('name', `%${q}%`).limit(6)
    setClients(data || [])
    setShowClientList(true)
  }

  const waitForAnalysis = (analysisId: string) => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)

    // Realtime subscription
    const channel = supabase
      .channel(`analysis-${analysisId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contract_analyses', filter: `id=eq.${analysisId}` },
        (payload) => {
          const status = (payload.new as { status: string }).status
          if (status === 'rascunho' || status === 'rascunho_estagiario' || status === 'finalizado') {
            cleanup()
            navigate(`/painel/analise/${analysisId}`)
          } else if (status === 'falhou') {
            cleanup()
            setProcessing(false)
            toast.error('A análise falhou. Verifique o PDF e tente novamente.')
          }
        }
      )
      .subscribe()
    channelRef.current = channel

    // Timeout de segurança
    timeoutRef.current = setTimeout(() => {
      cleanup()
      setTimedOut(true)
      setProcessing(false)
    }, ANALYSIS_TIMEOUT_MS)
  }

  const cleanup = () => {
    channelRef.current?.unsubscribe()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { toast.error('Selecione um PDF para analisar'); return }
    if (!title.trim()) { toast.error('Informe um título para a análise'); return }

    setProcessing(true)
    setTimedOut(false)

    try {
      // 1. Criar registro de análise
      const { data: analysis, error: insertError } = await supabase
        .from('contract_analyses')
        .insert({
          title: title.trim(),
          client_id: selectedClientId || null,
          context: context.trim() || null,
          status: 'processando',
          created_by: profile?.id,
        })
        .select()
        .single()

      if (insertError || !analysis) throw new Error(insertError?.message || 'Erro ao criar análise')

      // 2. Upload do PDF para o Storage
      const filePath = `${analysis.id}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('analyses')
        .upload(filePath, file, { contentType: 'application/pdf', upsert: true })

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`)

      // 3. Chamar a Netlify Function em background
      await fetch('/api/analyze-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysis.id,
          filePath,
          context: context.trim() || undefined,
        }),
      })

      // 4. Aguardar resultado via Realtime
      waitForAnalysis(analysis.id)

    } catch (err) {
      setProcessing(false)
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    }
  }

  if (processing || timedOut) {
    return (
      <div className="max-w-lg mx-auto py-24 flex flex-col items-center text-center gap-6">
        {timedOut ? (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">Processamento demorou mais que o esperado</p>
              <p className="text-slate-500 text-sm mt-2">
                A análise ainda pode estar em progresso. Verifique a lista de análises em alguns instantes.
              </p>
            </div>
            <button
              onClick={() => navigate('/painel/analise')}
              className="bg-brand text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-light transition-all"
            >
              Ver Lista de Análises
            </button>
          </>
        ) : (
          <>
            <div className="relative">
              <div className="w-20 h-20 bg-brand/10 rounded-2xl flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-brand animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">Gerando Parecer Jurídico…</p>
              <p className="text-slate-500 text-sm mt-1">
                A IA está analisando o contrato. Isso pode levar até 60 segundos.
              </p>
              <p className="text-slate-400 text-xs mt-3">{elapsed}s decorridos</p>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Nova Análise Contratual</h1>
        <p className="text-slate-500 text-sm mt-1">
          Envie o PDF do contrato e a IA gerará um parecer jurídico completo
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-brand bg-brand/5'
              : file
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-slate-200 hover:border-brand/40 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFile(null); setTitle('') }}
                className="ml-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {isDragActive ? 'Solte o PDF aqui' : 'Arraste o PDF ou clique para selecionar'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Apenas arquivos PDF, máximo 20 MB</p>
              </div>
            </div>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Título da análise</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Análise do Contrato de Prestação de Serviços – Empresa X"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>

        {/* Cliente */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Cliente <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); loadClients(e.target.value) }}
              onFocus={() => clientSearch && setShowClientList(true)}
              onBlur={() => setTimeout(() => setShowClientList(false), 150)}
              placeholder="Buscar cliente…"
              className="w-full pl-9 pr-4 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
          {showClientList && clients.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {clients.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    setSelectedClientId(c.id)
                    setClientSearch(c.name)
                    setShowClientList(false)
                  }}
                >
                  {c.name}
                  {c.document && <span className="text-slate-400 ml-2 text-xs">{c.document}</span>}
                </button>
              ))}
            </div>
          )}
          {selectedClientId && (
            <button
              type="button"
              className="mt-1 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              onClick={() => { setSelectedClientId(null); setClientSearch('') }}
            >
              <X className="w-3 h-3" /> Remover cliente
            </button>
          )}
        </div>

        {/* Contexto */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Contexto adicional <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            rows={3}
            placeholder="Ex: Nosso cliente é o locatário. Verificar riscos para locação comercial de longo prazo com opção de renovação automática."
            className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
          />
          <p className="text-xs text-slate-400 mt-1">
            Informe o papel do cliente, objetivos da análise ou pontos de atenção específicos.
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/painel/analise')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!file || !title.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            Gerar Parecer com IA
          </button>
        </div>
      </form>
    </div>
  )
}
