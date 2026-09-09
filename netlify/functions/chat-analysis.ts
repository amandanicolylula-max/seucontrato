// Chat lateral da Análise Corplaw (Módulo B)
// Portado de corplaw-analise/src/app/api/chat/route.ts, adaptado para Netlify
// + autorização + persistência multi-tenant.
//
// Duas modalidades:
// - pergunta: retorna texto livre (sem structured output)
// - alteração: retorna JSON com { resposta, analise_atualizada } e persiste
//   em contract_analyses.edited_sections
//
// Autorização: o mesmo padrão do fluxo de edição — estagiário só chateia em
// análise sua em rascunho_estagiario; supervisor no aguardando_revisao;
// advogado/sócio na sua própria rascunho. Sócio pode chatear em qualquer uma.

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { ANALISE_JSON_SCHEMA } from '../../src/lib/corplaw/analiseSchema.js'
import { CONFIG_PADRAO, classificarTarefaChat, normalizarNivel } from '../../src/lib/corplaw/esforco.js'
import type { AnaliseDocumento, MensagemChat } from '../../src/lib/corplaw/types.js'
import type { Config } from '@netlify/functions'

const MODELO = 'claude-opus-5'

// Schema pra alterações: força { resposta, analise_atualizada } válido
const ALTERACAO_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    resposta: { type: 'string', description: 'Mensagem curta confirmando o que foi alterado' },
    analise_atualizada: ANALISE_JSON_SCHEMA,
  },
  required: ['resposta', 'analise_atualizada'],
  additionalProperties: false,
}

function analiseValida(obj: unknown): obj is AnaliseDocumento {
  if (!obj || typeof obj !== 'object') return false
  const a = obj as Record<string, unknown>
  return (
    Array.isArray(a.riscos) &&
    Array.isArray(a.pontos_positivos) &&
    Array.isArray(a.recomendacoes_prioritarias) &&
    Array.isArray(a.partes) &&
    typeof a.resumo_operacao === 'string' &&
    typeof a.avaliacao_geral === 'number'
  )
}

const SYSTEM_CHAT = (analise: AnaliseDocumento, titulo: string) => `Você é um assistente jurídico analisando o documento "${titulo}".

Análise atual em JSON:
${JSON.stringify(analise)}

Você tem dois modos de resposta:

1. RESPOSTA SIMPLES: quando o usuário faz perguntas ou pede explicações, responda em texto claro e direto em português.

2. ALTERAÇÃO DA ANÁLISE: quando o usuário pede para alterar, modificar, adicionar, remover, corrigir ou ajustar qualquer parte da análise, retorne APENAS um JSON com esta estrutura:
{"resposta":"mensagem curta confirmando o que foi alterado","analise_atualizada":{...análise completa atualizada...}}

Regras para alterações:
- Retorne a análise COMPLETA com as modificações aplicadas (não apenas o trecho alterado)
- A estrutura do JSON da análise deve ser mantida exatamente igual
- Seja fiel ao que o usuário pediu — não altere partes que não foram solicitadas
- Para respostas simples, retorne apenas texto (sem JSON)`

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return json({ error: 'Token ausente' }, 401)

    const supabaseUrl = Netlify.env.get('SUPABASE_URL') || Netlify.env.get('VITE_SUPABASE_URL')
    const serviceRoleKey = Netlify.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Netlify.env.get('SUPABASE_ANON_KEY') || Netlify.env.get('VITE_SUPABASE_ANON_KEY')
    const apiKey = Netlify.env.get('ANTHROPIC_API_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Config incompleta' }, 500)
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY ausente' }, 500)

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return json({ error: 'Não autenticado' }, 401)

    const body = await req.json() as {
      analysis_id: string
      mensagens: MensagemChat[]
      esforco?: Record<string, unknown>
    }
    if (!body.analysis_id || !body.mensagens?.length) return json({ error: 'Payload inválido' }, 400)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Busca análise + perfil do user
    const [{ data: analysis }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('contract_analyses').select('*').eq('id', body.analysis_id).single(),
      supabaseAdmin.from('profiles').select('role').eq('id', user.id).single(),
    ])
    if (!analysis) return json({ error: 'Análise não encontrada' }, 404)
    if (analysis.analysis_module !== 'corplaw') return json({ error: 'Chat só suportado no módulo Corplaw' }, 400)
    if (!profile) return json({ error: 'Perfil não encontrado' }, 404)

    // Autorização (mesmo padrão do detalhe)
    const isSocio = profile.role === 'socio'
    const isAuthor = analysis.created_by === user.id
    const isReviewer = analysis.reviewer_id === user.id
    const isAssistente = profile.role === 'assistente'
    let allowed = false
    switch (analysis.status) {
      case 'rascunho_estagiario': allowed = isAuthor && isAssistente; break
      case 'aguardando_revisao':  allowed = isReviewer || isSocio; break
      case 'rascunho':            allowed = isAuthor || isSocio; break
      default: allowed = isSocio  // sócio pode ler/perguntar em qualquer status (não altera se finalizado)
    }
    if (!allowed) return json({ error: 'Sem permissão pra usar o chat nesta análise no status atual' }, 403)

    const ultima = body.mensagens[body.mensagens.length - 1].content
    const tarefa = classificarTarefaChat(ultima)
    const esforco = normalizarNivel(body.esforco?.[tarefa], CONFIG_PADRAO[tarefa])
    const ehAlteracao = tarefa === 'chat_alteracao'

    // Análise atual (edited_sections tem prioridade sobre ai_sections)
    const analiseAtual = (analysis.edited_sections || analysis.ai_sections) as AnaliseDocumento
    if (!analiseAtual) return json({ error: 'Análise sem dados pra chat' }, 400)

    // Chama Anthropic
    const client = new Anthropic({ apiKey })
    const mensagens = body.mensagens.map(m => ({ role: m.role, content: m.content })) as Anthropic.MessageParam[]

    const outputConfig: Record<string, unknown> = { effort: esforco }
    if (ehAlteracao) {
      outputConfig.format = { type: 'json_schema', schema: ALTERACAO_JSON_SCHEMA }
    }

    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      output_config: outputConfig,
      system: [
        {
          type: 'text',
          text: SYSTEM_CHAT(analiseAtual, analysis.title),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: mensagens,
    } as Anthropic.MessageCreateParams)

    const resposta = await stream.finalMessage()

    if (resposta.stop_reason === 'refusal') {
      throw new Error('API recusou responder' + (resposta.stop_details?.explanation ? `: ${resposta.stop_details.explanation}` : ''))
    }

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()

    if (ehAlteracao) {
      try {
        const parsed = JSON.parse(texto)
        if (analiseValida(parsed.analise_atualizada)) {
          // Salva no banco (edited_sections)
          await supabaseAdmin
            .from('contract_analyses')
            .update({ edited_sections: parsed.analise_atualizada, updated_at: new Date().toISOString() })
            .eq('id', body.analysis_id)

          return json({
            resposta: parsed.resposta || 'Análise atualizada.',
            analise_atualizada: parsed.analise_atualizada,
            tarefa: 'alteracao',
          }, 200)
        }
      } catch { /* fallthrough */ }
      return json({
        resposta: 'Não consegui aplicar a alteração com segurança agora. Pode reformular o pedido? (análise foi mantida)',
        tarefa: 'alteracao_falhou',
      }, 200)
    }

    return json({ resposta: texto, tarefa: 'pergunta' }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export const config: Config = { path: '/api/chat-analysis' }
