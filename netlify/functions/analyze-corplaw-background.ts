// Módulo Corplaw — análise única do sistema (após consolidação legacy+hibrido).
// Fluxo em 2 etapas:
//   (1) Haiku detecta {tipo_contrato, contraparte} do PDF principal (barato, ~$0.001)
//   (2) Query em contract_problems por similaridade ampla → candidatos
//   (3) Opus 5 recebe os candidatos junto do prompt e faz análise crítica caso a caso
//       (não incorpora cegamente — só cita quando GENUINAMENTE aplicável)
//
// Background function do Netlify: até 15 min. Recebe { analysisId, mainFilePath,
// accessoryPaths?, briefing, effort }. Escreve resultado em contract_analyses
// (ai_sections + edited_sections + detected_context).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import { ANALISE_JSON_SCHEMA } from '../../src/lib/corplaw/analiseSchema.js'
import { normalizarNivel, CONFIG_PADRAO } from '../../src/lib/corplaw/esforco.js'
import type { Perspectiva } from '../../src/lib/corplaw/types.js'

const MODELO = 'claude-opus-5'
const MODELO_DETECCAO = 'claude-haiku-4-5-20251001'

// ─── Detecção prévia (Haiku) ────────────────────────────────────────────────

interface DetectedContext {
  tipo_contrato: string | null
  contraparte: string | null
}

const DETECT_SCHEMA = {
  type: 'object',
  properties: {
    tipo_contrato: {
      type: ['string', 'null'],
      description: 'Tipo genérico do contrato (ex.: Prestação de Serviços, Fornecimento, Locação, Compra e Venda, Distribuição, NDA). null se não conseguir identificar.',
    },
    contraparte: {
      type: ['string', 'null'],
      description: 'Nome da contraparte principal (a parte com quem o cliente está contratando). null se não conseguir identificar.',
    },
  },
  required: ['tipo_contrato', 'contraparte'],
  additionalProperties: false,
}

async function detectContractContext(
  client: Anthropic,
  contentBlocks: Anthropic.ContentBlockParam[]
): Promise<DetectedContext> {
  try {
    const resposta = await client.messages.create({
      model: MODELO_DETECCAO,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          ...contentBlocks,
          {
            type: 'text',
            text: 'Leia o documento e identifique: (1) tipo genérico do contrato; (2) nome da contraparte principal. Retorne SOMENTE JSON: {"tipo_contrato": "...", "contraparte": "..."}. Use null quando não conseguir identificar com segurança.',
          },
        ],
      }],
    })

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    // Extrai o JSON (Haiku às vezes envolve em markdown)
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) return { tipo_contrato: null, contraparte: null }
    const parsed = JSON.parse(match[0])
    return {
      tipo_contrato: typeof parsed.tipo_contrato === 'string' ? parsed.tipo_contrato : null,
      contraparte: typeof parsed.contraparte === 'string' ? parsed.contraparte : null,
    }
  } catch (e) {
    console.warn('detectContractContext falhou (segue sem enriquecimento):', (e as Error).message)
    return { tipo_contrato: null, contraparte: null }
  }
}

// ─── Busca candidatos no Banco de Problemas ─────────────────────────────────

interface ProblemCandidate {
  contract_type: string | null
  counterparty_name: string | null
  event_date: string | null
  description: string
  financial_impact: number | null
  ai_recommendations: string | null
  missing_clauses: unknown
}

async function fetchProblemCandidates(
  supabase: SupabaseClient,
  workspaceId: string | null,
  ctx: DetectedContext
): Promise<ProblemCandidate[]> {
  if (!ctx.tipo_contrato && !ctx.contraparte) return []

  const orFilters: string[] = []
  if (ctx.tipo_contrato) orFilters.push(`contract_type.ilike.%${ctx.tipo_contrato}%`)
  if (ctx.contraparte) orFilters.push(`counterparty_name.ilike.%${ctx.contraparte}%`)

  let query = supabase
    .from('contract_problems')
    .select('contract_type, counterparty_name, event_date, description, financial_impact, ai_recommendations, missing_clauses')
    .order('event_date', { ascending: false, nullsFirst: false })
    .limit(20)

  if (orFilters.length > 0) query = query.or(orFilters.join(','))
  if (workspaceId) query = query.or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)

  const { data, error } = await query
  if (error) {
    console.warn('fetchProblemCandidates erro:', error.message)
    return []
  }
  return (data || []) as ProblemCandidate[]
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const PERSPECTIVA_LABEL: Record<Perspectiva, string> = {
  escrito_pelo_cliente:
    'O contrato foi ESCRITO PELO CLIENTE e ainda não foi assinado — foco em blindar o documento antes de enviar: fechar brechas, corrigir redação ambígua e incluir proteções que faltam.',
  recebido_de_terceiro:
    'O contrato foi RECEBIDO DE TERCEIRO e o cliente vai decidir se assina — foco em identificar armadilhas e pontos desfavoráveis, indicar o que pedir para mudar e o que é aceitável deixar como está.',
  viabilidade:
    'É uma ANÁLISE DE VIABILIDADE (contrato ainda não fechado) — foco em avaliar se faz sentido entrar nessa operação, se as condições são sustentáveis para o negócio e se há amarras que limitam o crescimento.',
  vigente_prevencao:
    'O contrato JÁ ESTÁ ASSINADO E VIGENTE para o cliente — não dá mais para renegociar antes de assinar. O foco muda: (1) mapear os riscos aos quais a empresa JÁ está exposta hoje; (2) para cada risco, priorizar MEDIDAS ADMINISTRATIVAS DE PREVENÇÃO que o cliente pode adotar por conta própria, sem depender da outra parte (ex.: controles internos, rotinas, documentação, avisos formais, calendário de prazos); (3) quando um risco NÃO tiver solução administrativa possível, dizer isso claramente e recomendar buscar um ADITIVO contratual (ou orientação jurídica) — indicando qual ponto o aditivo precisaria corrigir. Deixe explícito, em cada recomendação, se ela é uma medida administrativa interna ou se exige aditivo/renegociação.',
}

function formatCandidatos(candidates: ProblemCandidate[], ctx: DetectedContext): string {
  const linhas = candidates.map((c, i) => {
    const meta = [c.contract_type, c.counterparty_name, c.event_date].filter(Boolean).join(' / ')
    const impacto = c.financial_impact ? ` — impacto: R$ ${Number(c.financial_impact).toLocaleString('pt-BR')}` : ''
    const rec = c.ai_recommendations ? `\n     Recomendação registrada: ${c.ai_recommendations}` : ''
    const clausulas = Array.isArray(c.missing_clauses) && c.missing_clauses.length > 0
      ? `\n     Cláusulas ausentes: ${(c.missing_clauses as string[]).join('; ')}`
      : ''
    return `  ${i + 1}. [${meta}]${impacto}\n     ${c.description}${rec}${clausulas}`
  }).join('\n')

  const filtro = [
    ctx.tipo_contrato ? `tipo="${ctx.tipo_contrato}"` : null,
    ctx.contraparte ? `contraparte="${ctx.contraparte}"` : null,
  ].filter(Boolean).join(' OU ')

  return `

CONHECIMENTO HISTÓRICO DO ESCRITÓRIO — PROBLEMAS POTENCIALMENTE RELEVANTES

Os problemas abaixo foram registrados anteriormente pelo escritório em contratos com alguma similaridade (${filtro}). NÃO os incorpore automaticamente — o recorte por tipo/contraparte é amplo e pode não se aplicar ao caso específico.

Sua tarefa: para CADA candidato abaixo, faça análise crítica de relevância pra ESTE contrato específico. Compare cláusulas, contexto de negócio, exposição financeira e circunstâncias. Cite apenas os que forem GENUINAMENTE aplicáveis — e, quando citar, faça-o no campo "cruzamento" ou "origem" do risco relacionado, mencionando explicitamente algo como "o escritório já enfrentou situação análoga: [descrição breve] — aqui o mesmo risco existe porque [razão específica deste contrato]". Se um problema histórico NÃO se aplica ao caso presente (ex.: cláusula diferente, contexto distinto, cenário improvável neste negócio), IGNORE-O sem mencionar. Não force a relevância pra parecer que aproveitou o histórico.

CANDIDATOS:
${linhas}
`
}

function buildPrompt(
  negocio: string,
  perspectiva: Perspectiva,
  preocupacoes: string,
  candidates: ProblemCandidate[],
  ctx: DetectedContext
): string {
  const base = `Você é um Analista de Contratos especializado em contratos cíveis e empresariais brasileiros.
Apoie o cliente traduzindo linguagem jurídica em informações práticas. Você não é advogado e não presta assessoria jurídica formal.

CONTEXTO DO CLIENTE:
- Negócio: ${negocio}
- Perspectiva desta análise: ${PERSPECTIVA_LABEL[perspectiva]}
${preocupacoes ? `- Preocupações já identificadas pelo cliente: ${preocupacoes}` : ''}

PRINCÍPIOS DE COMUNICAÇÃO:
- Linguagem simples e direta, acessível a quem NÃO é advogado. Evite juridiquês; quando precisar de um termo técnico, explique-o.
- Seja quantitativo: estime exposição financeira em R$ sempre que possível, usando valores e prazos do próprio contrato.
- Não liste riscos genéricos: cada risco deve ser específico deste contrato e deste negócio.

OS RISCOS SÃO O CORAÇÃO DA ANÁLISE. Trate-os com destaque e de forma DIDÁTICA. Para CADA risco, preencha:
- "origem": de onde o risco vem, de forma clara — do próprio contrato (qual cláusula), de prática do mercado/setor, da AUSÊNCIA de uma cláusula que deveria existir, ou do CRUZAMENTO entre duas ou mais cláusulas.
- "descricao": explicação didática do problema em si.
- "cruzamento": como o risco é agravado (ou criado) pela combinação com outras cláusulas — obrigatório analisar isso, não se limite a cláusulas isoladas.
- "cenario": em que situação prática do dia a dia esse risco se concretiza (o gatilho concreto).
- "impacto_potencial": o que acontece na prática se o risco se materializar, com estimativa em R$ quando der.
- "recomendacao": como mitigar ou prevenir, de forma concreta e acionável.

Vá além do que está escrito: avalie lacunas, omissões, ambiguidades e o que o contrato deixa de prever. Se houver poucos riscos óbvios, investigue os riscos por OMISSÃO (cláusulas importantes que faltam).

Ordene os riscos do mais grave ao menos grave. Máximo 5 recomendações prioritárias, em ordem crescente de urgência (1 = mais urgente). exposicao_brl é número inteiro em reais ou null.`

  return candidates.length > 0 ? base + formatCandidatos(candidates, ctx) : base
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const handler = async (event: { body: string }) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!supabaseUrl || !serviceKey) return { statusCode: 500, body: 'Config incompleta' }

  let analysisId: string | undefined

  try {
    const body = JSON.parse(event.body || '{}')
    analysisId = body.analysisId
    const mainFilePath: string = body.mainFilePath
    const accessoryPaths: string[] = body.accessoryPaths || []
    const negocio: string = body.briefing?.negocio || 'Não informado'
    const perspectiva: Perspectiva = (body.briefing?.perspectiva || 'recebido_de_terceiro') as Perspectiva
    const preocupacoes: string = body.briefing?.preocupacoes || ''
    const effort = normalizarNivel(body.effort, CONFIG_PADRAO.analise)

    if (!analysisId) throw new Error('analysisId obrigatório')
    if (!mainFilePath) throw new Error('mainFilePath obrigatório')

    const supabase = createClient(supabaseUrl, serviceKey)

    if (!apiKey) {
      await supabase
        .from('contract_analyses')
        .update({ status: 'falhou', updated_at: new Date().toISOString() })
        .eq('id', analysisId)
      return { statusCode: 500, body: 'ANTHROPIC_API_KEY ausente' }
    }

    // Determina o autor (para status inicial) e workspace_id
    const { data: analysisRow } = await supabase
      .from('contract_analyses')
      .select('created_by, workspace_id')
      .eq('id', analysisId)
      .single()

    const workspaceId: string | null = analysisRow?.workspace_id || null

    let initialStatus = 'rascunho'
    let reviewerId: string | null = null
    if (analysisRow?.created_by) {
      const { data: author } = await supabase
        .from('profiles')
        .select('role, supervisor_id')
        .eq('id', analysisRow.created_by)
        .single()
      if (author?.role === 'assistente') {
        initialStatus = 'rascunho_estagiario'
        reviewerId = author.supervisor_id
      }
    }

    // ── Download files from storage ────────────────────────────────────
    const mainBlocks = await prepareContentFromStorage(supabase, mainFilePath, false)
    const accessoryBlocks: Anthropic.ContentBlockParam[] = []
    for (const p of accessoryPaths) {
      accessoryBlocks.push(...(await prepareContentFromStorage(supabase, p, true)))
    }

    const client = new Anthropic({ apiKey })

    // ── Etapa 1: Detecção prévia (Haiku) ───────────────────────────────
    const ctx = await detectContractContext(client, mainBlocks)

    // ── Etapa 2: Busca candidatos no Banco de Problemas ────────────────
    const candidates = await fetchProblemCandidates(supabase, workspaceId, ctx)

    // ── Etapa 3: Análise principal (Opus 5) ────────────────────────────
    const contentBlocks: Anthropic.ContentBlockParam[] = [
      ...mainBlocks,
      ...accessoryBlocks,
      { type: 'text', text: buildPrompt(negocio, perspectiva, preocupacoes, candidates, ctx) },
    ]

    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort,
        format: { type: 'json_schema', schema: ANALISE_JSON_SCHEMA },
      },
      messages: [{ role: 'user', content: contentBlocks }],
    } as Anthropic.MessageCreateParams)

    const resposta = await stream.finalMessage()

    if (resposta.stop_reason === 'refusal') {
      throw new Error(
        'API recusou por segurança' +
          (resposta.stop_details?.explanation ? `: ${resposta.stop_details.explanation}` : '')
      )
    }

    if (resposta.stop_reason === 'max_tokens') {
      throw new Error(
        `Resposta cortada no limite de tokens (${resposta.usage?.output_tokens || '?'} tokens gerados). ` +
        `Reduza o effort (max→high) ou tente novamente.`
      )
    }

    const textoResposta = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    if (!textoResposta) throw new Error('Resposta vazia da IA')

    let analise
    try {
      analise = JSON.parse(textoResposta)
    } catch (e) {
      throw new Error(
        `Falha ao parsear JSON (${textoResposta.length} chars, stop_reason=${resposta.stop_reason}). ` +
        `Trecho final: "${textoResposta.slice(-200)}". Erro: ${(e as Error).message}`
      )
    }

    const gravidadeMax = analise.riscos?.reduce((max: string, r: { gravidade: string }) => {
      const rank: Record<string, number> = { CRÍTICO: 4, ALTO: 3, MÉDIO: 2, BAIXO: 1 }
      return (rank[r.gravidade] || 0) > (rank[max] || 0) ? r.gravidade : max
    }, 'BAIXO') || 'BAIXO'
    const riskLevel = gravidadeMax === 'CRÍTICO' || gravidadeMax === 'ALTO' ? 'alto' : gravidadeMax === 'MÉDIO' ? 'medio' : 'baixo'

    await supabase
      .from('contract_analyses')
      .update({
        ai_sections: analise,
        edited_sections: analise,
        detected_context: {
          tipo_contrato: ctx.tipo_contrato,
          contraparte: ctx.contraparte,
          candidatos_encontrados: candidates.length,
        },
        status: initialStatus,
        risk_level: riskLevel,
        reviewer_id: reviewerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId)

    // Cleanup PDFs temporários
    const allPaths = [mainFilePath, ...accessoryPaths]
    await supabase.storage.from('analyses').remove(allPaths).catch(() => {})

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    const errMsg = err instanceof Error ? (err.stack || err.message) : String(err)
    console.error('analyze-corplaw error:', errMsg)
    if (analysisId) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey)
        await supabase
          .from('contract_analyses')
          .update({
            status: 'falhou',
            ai_sections: { __debug_error: errMsg.slice(0, 4000) },
            updated_at: new Date().toISOString(),
          })
          .eq('id', analysisId)
      } catch { /* ignore */ }
    }
    return { statusCode: 500, body: String(err) }
  }
}

// ─── Prepare content from Supabase Storage ──────────────────────────────────

async function prepareContentFromStorage(
  supabase: SupabaseClient,
  filePath: string,
  isAccessory: boolean
): Promise<Anthropic.ContentBlockParam[]> {
  const { data: fileBlob, error } = await supabase.storage.from('analyses').download(filePath)
  if (error || !fileBlob) throw new Error(`Falha ao baixar ${filePath}: ${error?.message}`)

  const buffer = await fileBlob.arrayBuffer()
  const name = filePath.toLowerCase()
  const prefixo = isAccessory ? `\n\n[Documento acessório: ${filePath}]\n` : ''

  if (name.endsWith('.pdf')) {
    const base64 = Buffer.from(buffer).toString('base64')
    const partes: Anthropic.ContentBlockParam[] = []
    if (isAccessory) partes.push({ type: 'text', text: prefixo })
    partes.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    })
    return partes
  }

  if (name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    if (!result.value.trim()) throw new Error(`Sem texto em ${filePath}`)
    return [{ type: 'text', text: prefixo + result.value }]
  }

  if (name.endsWith('.txt')) {
    const texto = new TextDecoder().decode(buffer)
    if (!texto.trim()) throw new Error(`Arquivo ${filePath} vazio`)
    return [{ type: 'text', text: prefixo + texto }]
  }

  throw new Error(`Formato não suportado: ${filePath}`)
}
