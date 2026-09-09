// Módulo C — análise Híbrida
// Reusa a mesma engine do Corplaw (Opus 5 + structured outputs), mas
// inicializa também os campos híbridos: secoes_livres = [], anotacoes_advogado = ''
//
// Recebe { analysisId, mainFilePath, accessoryPaths?, briefing, effort }

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import { ANALISE_JSON_SCHEMA } from '../../src/lib/corplaw/analiseSchema.js'
import { normalizarNivel, CONFIG_PADRAO } from '../../src/lib/corplaw/esforco.js'
import type { Perspectiva } from '../../src/lib/corplaw/types.js'

const MODELO = 'claude-opus-5'

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

function buildPrompt(negocio: string, perspectiva: Perspectiva, preocupacoes: string): string {
  return `Você é um Analista de Contratos especializado em contratos cíveis e empresariais brasileiros.
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
- "origem": de onde o risco vem, de forma clara.
- "descricao": explicação didática do problema em si.
- "cruzamento": como o risco é agravado (ou criado) pela combinação com outras cláusulas — obrigatório analisar isso.
- "cenario": em que situação prática do dia a dia esse risco se concretiza (o gatilho concreto).
- "impacto_potencial": o que acontece na prática, com estimativa em R$ quando der.
- "recomendacao": como mitigar ou prevenir, de forma concreta e acionável.

Vá além do que está escrito: avalie lacunas, omissões, ambiguidades. Ordene riscos do mais grave ao menos grave. Máximo 5 recomendações prioritárias.`
}

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
      await supabase.from('contract_analyses').update({ status: 'falhou', updated_at: new Date().toISOString() }).eq('id', analysisId)
      return { statusCode: 500, body: 'ANTHROPIC_API_KEY ausente' }
    }

    const { data: analysisRow } = await supabase
      .from('contract_analyses').select('created_by').eq('id', analysisId).single()

    let initialStatus = 'rascunho'
    let reviewerId: string | null = null
    if (analysisRow?.created_by) {
      const { data: author } = await supabase
        .from('profiles').select('role, supervisor_id').eq('id', analysisRow.created_by).single()
      if (author?.role === 'assistente') {
        initialStatus = 'rascunho_estagiario'
        reviewerId = author.supervisor_id
      }
    }

    const contentBlocks: Anthropic.ContentBlockParam[] = []
    contentBlocks.push(...(await prepareContentFromStorage(supabase, mainFilePath, false)))
    for (const p of accessoryPaths) {
      contentBlocks.push(...(await prepareContentFromStorage(supabase, p, true)))
    }
    contentBlocks.push({ type: 'text', text: buildPrompt(negocio, perspectiva, preocupacoes) })

    const client = new Anthropic({ apiKey })
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      output_config: { effort, format: { type: 'json_schema', schema: ANALISE_JSON_SCHEMA } },
      messages: [{ role: 'user', content: contentBlocks }],
    } as Anthropic.MessageCreateParams)

    const resposta = await stream.finalMessage()

    if (resposta.stop_reason === 'refusal') {
      throw new Error('API recusou por segurança' + (resposta.stop_details?.explanation ? `: ${resposta.stop_details.explanation}` : ''))
    }

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()

    if (!texto) throw new Error('Resposta vazia da IA')

    const analiseBase = JSON.parse(texto)
    // Estende com campos híbridos vazios (preenchidos depois pelo advogado)
    const analiseHibrida = {
      ...analiseBase,
      secoes_livres: [],
      anotacoes_advogado: '',
    }

    const gravidadeMax = analiseBase.riscos?.reduce((max: string, r: { gravidade: string }) => {
      const rank: Record<string, number> = { CRÍTICO: 4, ALTO: 3, MÉDIO: 2, BAIXO: 1 }
      return (rank[r.gravidade] || 0) > (rank[max] || 0) ? r.gravidade : max
    }, 'BAIXO') || 'BAIXO'
    const riskLevel = gravidadeMax === 'CRÍTICO' || gravidadeMax === 'ALTO' ? 'alto' : gravidadeMax === 'MÉDIO' ? 'medio' : 'baixo'

    await supabase.from('contract_analyses').update({
      ai_sections: analiseHibrida,
      edited_sections: analiseHibrida,
      status: initialStatus,
      risk_level: riskLevel,
      reviewer_id: reviewerId,
      updated_at: new Date().toISOString(),
    }).eq('id', analysisId)

    const allPaths = [mainFilePath, ...accessoryPaths]
    await supabase.storage.from('analyses').remove(allPaths).catch(() => {})

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('analyze-hibrida error:', err)
    if (analysisId) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey)
        await supabase.from('contract_analyses').update({ status: 'falhou', updated_at: new Date().toISOString() }).eq('id', analysisId)
      } catch { /* ignore */ }
    }
    return { statusCode: 500, body: String(err) }
  }
}

async function prepareContentFromStorage(
  supabase: ReturnType<typeof createClient>,
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
    partes.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
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
