import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, Sparkles, Loader2, User } from 'lucide-react'
import type { MensagemChat } from '@/lib/corplaw/types'
import { pedeAlteracao, carregarConfig } from '@/lib/corplaw/esforco'
import { Markdown } from './Markdown'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Props {
  analysisId: string
  disabled?: boolean
  disabledReason?: string
  onAnaliseUpdated?: () => void
}

export function ChatLateral({ analysisId, disabled, disabledReason, onAnaliseUpdated }: Props) {
  const [messages, setMessages] = useState<MensagemChat[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const isAlteration = pedeAlteracao(input)

  const send = async () => {
    if (!input.trim() || loading || disabled) return
    const userMsg: MensagemChat = { role: 'user', content: input.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const cfg = carregarConfig()
      const r = await fetch('/api/chat-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          analysis_id: analysisId,
          mensagens: newHistory,
          esforco: { chat_pergunta: cfg.chat_pergunta, chat_alteracao: cfg.chat_alteracao },
        }),
      })
      const data = await r.json()

      if (!r.ok) {
        toast.error(data.error || 'Erro no chat')
        setLoading(false)
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.resposta || '(sem resposta)' }])

      if (data.tarefa === 'alteracao' && data.analise_atualizada) {
        // Análise foi atualizada no banco — dispara refresh no componente pai (via realtime já refresca)
        onAnaliseUpdated?.()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" />
        <p className="font-semibold text-navy-800 text-sm">Chat com a análise</p>
        {disabled && <span className="ml-auto text-xs text-slate-400">{disabledReason || 'read-only'}</span>}
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            Faça perguntas sobre a análise ou peça alterações:<br/>
            <span className="italic">"O que é o R3?"</span><br/>
            <span className="italic">"Altere a avaliação para 4 estrelas"</span><br/>
            <span className="italic">"Adicione um risco sobre indenização"</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={clsx('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
            <div className={clsx('flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
              m.role === 'user' ? 'bg-navy-100 text-navy-700' : 'bg-accent/10 text-accent')}>
              {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </div>
            <div className={clsx('max-w-[80%] rounded-2xl px-3 py-2',
              m.role === 'user' ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-800')}>
              {m.role === 'user' ? <p className="text-sm">{m.content}</p> : <Markdown text={m.content} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-100 rounded-2xl px-3 py-2">
              <p className="text-xs text-slate-500">{isAlteration ? 'Alterando análise…' : 'Pensando…'}</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3">
        {disabled ? (
          <div className="text-xs text-slate-400 text-center py-2">{disabledReason || 'Chat indisponível'}</div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={isAlteration ? '(vai alterar a análise) Descreva a mudança…' : 'Pergunta ou "altere / adicione / mude…"'}
              rows={2}
              className={clsx('flex-1 resize-none border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2',
                isAlteration ? 'border-amber-300 focus:ring-amber-200' : 'border-slate-200 focus:ring-brand/20')}
              disabled={loading}
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-accent hover:bg-accent-dark text-white disabled:opacity-40 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
