import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabase'
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { Client } from '@/types'

type Step = 'upload' | 'details' | 'extracting' | 'validating'

// Tempo máximo de espera pela extração em background (3 minutos)
const EXTRACTION_TIMEOUT_MS = 3 * 60 * 1000

export default function ContractUpload() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [contractType, setContractType] = useState('')
  const [clientName, setClientName] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [showClientList, setShowClientList] = useState(false)
  const [extraction, setExtraction] = useState<Record<string, unknown> | null>(null)
  const [contractId, setContractId] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Refs para limpar subscriptions e timers ao desmontar
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Limpa tudo ao desmontar o componente
  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const loadClients = async (q: string) => {
    if (!q) { setClients([]); return }
    const { data } = await supabase.from('clients').select('*').ilike('name', `%${q}%`).limit(5)
    setClients(data || [])
    setShowClientList(true)
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) { setFile(accepted[0]); setTitle(accepted[0].name.replace('.pdf', '')) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1
  })

  // Inicia a contagem de tempo e escuta Realtime para quando extração terminar
  const waitForExtraction = (cId: string) => {
    setElapsedSeconds(0)

    // Timer de elapsed time (UX)
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1)
    }, 1000)

    // Canal Supabase Realtime — escuta mudanças na linha do contrato
    const channel = supabase
      .channel(`extraction-${cId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contracts', filter: `id=eq.${cId}` },
        async (payload) => {
          const status = (payload.new as { extraction_status: string }).extraction_status
          if (status === 'concluido') {
            await handleExtractionComplete(cId)
          } else if (status === 'falhou') {
            handleExtractionFailed('A extração falhou. Tente novamente.')
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    // Fallback: polling a cada 5s caso o Realtime não notifique
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('contracts')
        .select('extraction_status')
        .eq('id', cId)
        .single()

      if (data?.extraction_status === 'concluido') {
        clearInterval(pollInterval)
        await handleExtractionComplete(cId)
      } else if (data?.extraction_status === 'falhou') {
        clearInterval(pollInterval)
        handleExtractionFailed('A extração falhou. Tente novamente.')
      }
    }, 5000)

    // Timeout global — se demorar mais de 3 minutos, mostra erro
    timeoutRef.current = setTimeout(() => {
      clearInterval(pollInterval)
      handleExtractionFailed('Tempo limite excedido. O PDF pode ser muito grande. Tente novamente.')
    }, EXTRACTION_TIMEOUT_MS)
  }

  const handleExtractionComplete = async (cId: string) => {
    // Para timers
    if (timerRef.current) clearInterval(timerRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    channelRef.current?.unsubscribe()

    // Busca os dados extraídos do Supabase
    const { data: metadata, error } = await supabase
      .from('contract_metadata')
      .select('raw_extraction')
      .eq('contract_id', cId)
      .single()

    if (error || !metadata?.raw_extraction) {
      toast.error('Extração concluída mas não foi possível carregar os dados.')
      navigate(`/contratos/${cId}`)
      return
    }

    setExtraction(metadata.raw_extraction as Record<string, unknown>)
    setStep('validating')
  }

  const handleExtractionFailed = (msg: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    channelRef.current?.unsubscribe()
    toast.error(`Falha na extração: ${msg}`)
    setStep('details')
  }

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setStep('extracting')

    try {
      // 1. Cria ou encontra o cliente
      let clientId: string | null = null
      if (clientName) {
        const { data: existing } = await supabase.from('clients').select('id').ilike('name', clientName).single()
        if (existing) {
          clientId = existing.id
        } else {
          const { data: newClient } = await supabase.from('clients').insert({ name: clientName, created_by: profile?.id }).select('id').single()
          clientId = newClient?.id
        }
      }

      // 2. Faz upload do PDF para o Supabase Storage
      const sanitizedName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
      const fileName = `${Date.now()}_${sanitizedName}`
      const { error: uploadError } = await supabase.storage.from('contracts').upload(fileName, file)
      if (uploadError) throw new Error(`Erro ao fazer upload: ${uploadError.message}`)

      // 3. Cria o registro do contrato com status 'processando'
      const { data: contract, error: insertError } = await supabase.from('contracts').insert({
        title,
        contract_type: contractType || null,
        client_id: clientId,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        status: 'ativo',
        extraction_status: 'processando',
        created_by: profile?.id,
      }).select('id').single()

      if (insertError || !contract) throw new Error('Erro ao criar contrato')
      setContractId(contract.id)

      // Registra o upload no log de auditoria
      await supabase.from('audit_log').insert({
        user_id: profile?.id,
        action: 'upload',
        entity_type: 'contrato',
        entity_id: contract.id,
        new_data: { title, contract_type: contractType || null, file_name: file.name, file_size: file.size },
      })

      // 4. Inicia escuta do Realtime ANTES de chamar a função (evita race condition)
      waitForExtraction(contract.id)

      // 5. Chama a Background Function — retorna 202 imediatamente
      const { data: { session } } = await supabase.auth.getSession()
      const bgResponse = await fetch('/api/extract-contract-bg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ contractId: contract.id }),
      })

      if (bgResponse.status !== 202) {
        throw new Error(`Erro ao iniciar extração (HTTP ${bgResponse.status})`)
      }

      // A partir daqui a UI aguarda o Realtime/polling notificar a conclusão

    } catch (err) {
      console.error('Upload error:', err)
      if (timerRef.current) clearInterval(timerRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      channelRef.current?.unsubscribe()

      if (contractId) {
        await supabase.from('contracts').update({ extraction_status: 'falhou' }).eq('id', contractId)
      }
      toast.error(err instanceof Error ? err.message : 'Erro desconhecido')
      setStep('details')
    }
  }

  const handleValidate = async () => {
    if (!contractId) return
    await supabase.from('contract_metadata')
      .update({ validated_by: profile?.id, validated_at: new Date().toISOString() })
      .eq('contract_id', contractId)
    toast.success('Contrato validado e salvo!')
    navigate(`/contratos/${contractId}`)
  }

  const handleCancel = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    channelRef.current?.unsubscribe()

    if (contractId) {
      await Promise.allSettled([
        supabase.from('contract_alerts').delete().eq('contract_id', contractId),
        supabase.from('contract_obligations').delete().eq('contract_id', contractId),
        supabase.from('contract_opportunities').delete().eq('contract_id', contractId),
        supabase.from('contract_metadata').delete().eq('contract_id', contractId),
      ])
      await supabase.from('contracts').delete().eq('id', contractId)
    }
    navigate('/contratos')
  }

  // Formata segundos para exibição
  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Novo Contrato</h1>
        <p className="text-slate-500 text-sm mt-1">Upload inteligente com extração automática via IA</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {['Upload', 'Detalhes', 'Extração IA', 'Validação'].map((s, i) => {
          const stepMap: Step[] = ['upload', 'details', 'extracting', 'validating']
          const current = stepMap.indexOf(step)
          const active = i <= current
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${active ? 'bg-brand text-white' : 'bg-slate-200 text-slate-400'}`}>{i + 1}</div>
              <span className={`text-xs font-medium ${active ? 'text-brand' : 'text-slate-400'}`}>{s}</span>
              {i < 3 && <div className={`flex-1 h-0.5 ${active && i < current ? 'bg-brand' : 'bg-slate-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-brand/40 hover:bg-slate-50'}`}>
            <input {...getInputProps()} />
            <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-brand' : 'text-slate-300'}`} />
            {file ? (
              <div><p className="text-sm font-semibold text-navy-800">{file.name}</p><p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(0)} KB</p></div>
            ) : (
              <div><p className="text-sm font-semibold text-slate-600">Arraste o PDF aqui</p><p className="text-xs text-slate-400 mt-1">ou clique para selecionar</p></div>
            )}
          </div>
          {file && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Arquivo selecionado</div>
              <div className="flex gap-2">
                <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                <button onClick={() => setStep('details')} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-light transition-all">Continuar →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detalhes */}
      {step === 'details' && (
        <form onSubmit={handleSubmitDetails} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-5">
          <h2 className="font-semibold text-navy-800">Informações do Contrato</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Título *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de Contrato</label>
            <select value={contractType} onChange={e => setContractType(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
              <option value="">Selecione...</option>
              {[
                'Comodato',
                'Compra e Venda',
                'Confidencialidade / NDA',
                'Consultoria',
                'Distribuição',
                'Fornecimento',
                'Franquia',
                'Honorários Advocatícios',
                'Licença de Uso',
                'Locação',
                'Mandato / Procuração',
                'Mútuo (Empréstimo)',
                'Obra e Construção',
                'Parceria / Colaboração',
                'Prestação de Serviços',
                'Promessa de Compra e Venda',
                'Societário',
                'Trabalho / CLT',
                'Outro',
              ].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente</label>
            <input
              value={clientName}
              onChange={e => { setClientName(e.target.value); loadClients(e.target.value) }}
              onBlur={() => setTimeout(() => setShowClientList(false), 200)}
              placeholder="Digite ou selecione um cliente..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            {showClientList && clients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {clients.map(c => (
                  <button key={c.id} type="button" onMouseDown={() => { setClientName(c.name); setShowClientList(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                    {c.name}
                    {c.document && <span className="text-xs text-slate-400 ml-2">{c.document}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep('upload')} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">← Voltar</button>
            <button type="submit" className="flex-1 bg-brand text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-light">Extrair com IA →</button>
          </div>
        </form>
      )}

      {/* Extraindo */}
      {step === 'extracting' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
          <h2 className="font-semibold text-navy-800 text-lg">Analisando contrato...</h2>
          <p className="text-slate-500 text-sm mt-2">O Claude está extraindo metadados, obrigações e oportunidades</p>
          {elapsedSeconds > 0 && (
            <p className="text-slate-400 text-xs mt-3 font-mono">{formatElapsed(elapsedSeconds)}</p>
          )}
          <p className="text-slate-400 text-xs mt-1">Processamento em background — pode levar até 1 minuto</p>
          <button
            onClick={handleCancel}
            className="mt-6 text-slate-400 hover:text-red-500 text-xs underline underline-offset-2 transition-colors"
          >
            Cancelar e descartar
          </button>
        </div>
      )}

      {/* Validação */}
      {step === 'validating' && extraction && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <h2 className="font-semibold text-navy-800">Extração concluída</h2>
              <p className="text-sm text-slate-500">Revise os dados e confirme para salvar ou cancele para descartar</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              ['Contratante', extraction.contracting_party as string],
              ['Contratada', extraction.contracted_party as string],
              ['Objeto', extraction.object_description as string],
              ['Vigência', `${extraction.start_date || '?'} até ${extraction.end_date || '?'}`],
              ['Valor Total', extraction.total_value ? `R$ ${Number(extraction.total_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'],
              ['Foro', extraction.jurisdiction as string || '—'],
              ['Renovação Automática', extraction.auto_renewal ? 'Sim' : 'Não'],
              ['Cláusula de Sigilo', extraction.has_confidentiality_clause ? 'Sim' : 'Não'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex gap-3 p-3 rounded-xl bg-slate-50">
                <span className="text-xs font-semibold text-slate-500 w-32 flex-shrink-0">{label}</span>
                <span className="text-sm text-navy-800">{value || '—'}</span>
              </div>
            ))}
          </div>
          {(extraction.opportunities as unknown[])?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-navy-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Oportunidades identificadas ({(extraction.opportunities as unknown[]).length})
              </p>
              <div className="space-y-2">
                {(extraction.opportunities as { type: string; description: string }[]).map((op, i) => (
                  <div key={i} className="p-3 rounded-xl border border-amber-100 bg-amber-50">
                    <p className="text-sm font-medium text-amber-800">{op.type}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{op.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={handleCancel} className="flex-1 border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50">
              ✕ Cancelar e Descartar
            </button>
            <button onClick={handleValidate} className="flex-1 bg-brand text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-light flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Confirmar e Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
