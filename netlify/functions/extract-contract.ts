import { createClient } from "@supabase/supabase-js"
import type { Config } from "@netlify/functions"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
}

// Normaliza datas para YYYY-MM-DD — contratos brasileiros costumam usar DD/MM/YYYY
function normalizeDate(value: unknown): string | null {
  if (!value || typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "null") return null

  // Já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`

  return null
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(String(value).replace(",", "."))
  return isNaN(n) ? null : n
}

function normalizeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1"
  return false
}

function normalizeRisk(value: unknown): string {
  const v = String(value || "").toLowerCase()
  if (v.includes("alto") || v.includes("high")) return "alto"
  if (v.includes("baixo") || v.includes("low")) return "baixo"
  return "medio"
}

export default async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    // Autenticação
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: CORS_HEADERS
      })
    }

    const supabaseUrl = Netlify.env.get("SUPABASE_URL") || Netlify.env.get("VITE_SUPABASE_URL")
    const anonKey = Netlify.env.get("SUPABASE_ANON_KEY") || Netlify.env.get("VITE_SUPABASE_ANON_KEY")

    if (supabaseUrl && anonKey) {
      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Token inválido", details: authError?.message }), {
          status: 401, headers: CORS_HEADERS
        })
      }
    }

    const body = await req.json()
    const { pdfBase64 } = body

    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 required" }), {
        status: 400, headers: CORS_HEADERS
      })
    }

    const apiKey = Netlify.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: "ANTHROPIC_API_KEY not configured",
        hint: "Configure a variável ANTHROPIC_API_KEY nas environment variables do Netlify"
      }), {
        status: 500, headers: CORS_HEADERS
      })
    }

    // AbortController com 50s — o limite do Netlify Functions é 60s
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 50000)

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64
              }
            },
            {
              type: "text",
              text: `Você é um especialista em direito contratual brasileiro a serviço do escritório Braga & Dantas Advogados. Analise o contrato PDF e retorne EXCLUSIVAMENTE um objeto JSON válido — sem markdown, sem blocos de código, sem texto antes ou depois.

REGRAS OBRIGATÓRIAS:
- Datas: SEMPRE em formato YYYY-MM-DD (ex: "15 de março de 2024" → "2024-03-15", "15/03/2024" → "2024-03-15")
- Valores monetários: APENAS o número sem R$, pontos ou vírgula de milhar (ex: "R$ 1.500,00" → 1500.00)
- CNPJ/CPF: mantenha a formatação original (ex: "12.345.678/0001-99")
- Campo ausente no contrato: retorne null — NUNCA invente informações
- Booleanos: true ou false com base no que está EXPLÍCITO no contrato

SOBRE NOSSO CLIENTE:
O escritório Braga & Dantas representa uma das partes. Assuma que nosso cliente é a parte CONTRATANTE, salvo se o contexto indicar claramente o contrário. Todas as análises de risco e oportunidade devem considerar o impacto sobre nosso cliente.

Retorne este JSON:
{
  "contracting_party": "nome completo da parte CONTRATANTE",
  "contracting_party_document": "CNPJ ou CPF do contratante",
  "contracting_party_type": "PF ou PJ",
  "contracting_party_nationality": "brasileira/estrangeira/etc ou null",
  "contracting_party_marital_status": "solteiro/casado/divorciado/viúvo/etc ou null (apenas PF)",
  "contracting_party_profession": "profissão declarada ou null (apenas PF)",
  "contracted_party": "nome completo da parte CONTRATADA",
  "contracted_party_document": "CNPJ ou CPF da contratada",
  "contracted_party_type": "PF ou PJ",
  "contracted_party_nationality": "ou null",
  "contracted_party_marital_status": "ou null para PJ",
  "contracted_party_profession": "ou null para PJ",
  "object_description": "descrição objetiva do que está sendo contratado em 2-4 frases",
  "start_date": "YYYY-MM-DD ou null",
  "end_date": "YYYY-MM-DD ou null",
  "total_duration": "texto descritivo (ex: '12 meses', '1 ano', 'indeterminado') ou null",
  "auto_renewal": true ou false,
  "renewal_notice_days": número inteiro de dias ou null,
  "total_value": número decimal sem formatação ou null,
  "installment_value": número decimal ou null,
  "installment_count": número inteiro ou null,
  "payment_method": "transferência bancária/boleto/PIX/cheque/outro ou null",
  "payment_due_day": número inteiro representando o dia do mês (ex: 5) ou null,
  "readjustment_index": "IPCA/IGP-M/INPC/outro ou null",
  "readjustment_periodicity": "anual/semestral/mensal/outro ou null",
  "readjustment_base_date": "YYYY-MM-DD ou null",
  "termination_clause": "resumo das condições para rescisão ou null",
  "termination_notice_days": número inteiro de dias de aviso prévio ou null,
  "termination_penalty_percentage": percentual numérico da multa rescisória (ex: 20 para 20%) ou null,
  "penalty_clause": "resumo da multa por inadimplemento ou null",
  "late_payment_penalty_percentage": percentual de multa por atraso (ex: 2 para 2%) ou null,
  "interest_rate_monthly": taxa de juros mensal em percentual (ex: 1 para 1% a.m.) ou null,
  "has_monetary_correction": true ou false,
  "monetary_correction_index": "IPCA/IGP-M/outro ou null",
  "has_confidentiality_clause": true ou false,
  "has_liability_limitation": true ou false,
  "has_exclusivity_clause": true ou false,
  "exclusivity_beneficiary": "CONTRATANTE/CONTRATADA/AMBAS ou null se não há exclusividade",
  "jurisdiction": "cidade e estado do foro (ex: 'Natal/RN') ou null",
  "obligations": [
    {
      "party": "CONTRATANTE ou CONTRATADA",
      "description": "descrição clara e objetiva da obrigação",
      "due_date": "YYYY-MM-DD ou null",
      "is_recurring": true se periódica, false se pontual,
      "recurrence_pattern": "mensal/trimestral/semestral/anual ou null"
    }
  ],
  "opportunities": [
    {
      "category": "vulnerabilidade",
      "type": "nome conciso (ex: 'Sem cláusula de reajuste')",
      "description": "explicação do risco e impacto concreto para o cliente",
      "risk_level": "alto/medio/baixo",
      "risk_dimensions": ["financeiro", "estratégico", "operacional"]
    },
    {
      "category": "servico",
      "type": "nome do serviço jurídico (ex: 'Consultoria trabalhista preventiva')",
      "description": "por que essa situação no contrato indica necessidade desse serviço",
      "risk_level": "alto/medio/baixo"
    }
  ],
  "key_dates": [
    {
      "type": "vencimento/renovação/reajuste/carência/entrega/pagamento/notificação",
      "date": "YYYY-MM-DD",
      "description": "o que acontece nesta data"
    }
  ]
}

═══ OBRIGAÇÕES ═══
Extraia TODAS as obrigações de ambas as partes, especialmente:
- Pagamentos: valor, frequência, dia do vencimento
- Entregas com prazo definido
- Relatórios e prestações de conta periódicas
- Manutenção de seguros, garantias ou certidões
- Prazos de notificação para qualquer finalidade

═══ OPORTUNIDADES — SEÇÃO MAIS IMPORTANTE ═══
Esta seção define o valor do sistema. Analise com rigor e identifique tudo que representa risco para o cliente ou oportunidade de serviço para o escritório. Não se limite aos exemplos abaixo — use seu conhecimento jurídico para identificar qualquer situação relevante.

── VULNERABILIDADES (category: "vulnerabilidade") ──
Raciocine: "Qual o pior cenário para o cliente se esta cláusula for mal aplicada ou estiver ausente?"
Exemplos orientativos:
• Sem reajuste em contrato > 1 ano → risco financeiro alto
• Multa rescisória > 30% do valor restante → risco financeiro alto
• Sem limitação de responsabilidade → risco financeiro alto
• Objeto vago sem métricas de qualidade ou entrega → risco operacional alto
• Obrigações sem prazo definido → risco operacional médio
• Renovação automática sem aviso prévio adequado → risco estratégico médio
• Exclusividade unilateral sem contrapartida → risco estratégico médio
• Foro em cidade distante da sede do cliente → risco operacional baixo
• Sem previsão de força maior → risco financeiro médio
• Contrato sensível sem confidencialidade → risco estratégico alto
• Partes sem qualificação completa → risco de validade médio
• Garantias insuficientes para o valor → risco financeiro alto
• Vigência indefinida → risco estratégico médio
• Sem indexação em contrato > 12 meses → risco financeiro alto
• Penalidade por inadimplemento sem teto definido → risco financeiro alto

── OPORTUNIDADES DE SERVIÇO (category: "servico") ──
Raciocine: "O que esse contrato revela sobre necessidades jurídicas do cliente ainda não atendidas?"
Exemplos orientativos:
• Indícios de vínculo empregatício em prestação de serviços → consultoria trabalhista preventiva
• Relação societária sem acordo de sócios → elaboração/revisão de acordo societário
• PI, software, marca ou criação sem cessão → proteção de propriedade intelectual
• Locação sem laudo de vistoria → assessoria imobiliária
• Alto valor sem garantia real → estruturação de garantias
• Contrato vencendo em < 90 dias → renegociação/renovação
• Contrato com > 3 anos sem revisão → atualização legislativa
• Relação recorrente não formalizada → formalização da relação
• Elementos de M&A ou cessão de quotas → assessoria societária
• Dados pessoais sem adequação à LGPD → consultoria LGPD
• Contrato com órgão público → assessoria em contratos públicos
• Distribuição sem território definido → proteção territorial
• Mútuo sem taxa de juros explícita → prevenção de anatocismo
• Garantia real sem registro → regularização de garantia
• Múltiplos contratos com mesmo fornecedor → consolidação em master agreement
• Saída societária sem cláusula de não-competição → proteção competitiva

── CRITÉRIO DE RISCO ──
"alto": impacto financeiro > 20% do contrato, exposição ilimitada, risco trabalhista/previdenciário, risco de nulidade
"medio": impacto financeiro moderado, restrição operacional ou estratégica relevante, risco de litígio controlável
"baixo": inconveniência processual, foro desfavorável, ausência de cláusula de conveniência

═══ KEY_DATES ═══
Extraia TODAS as datas futuras relevantes: início/fim do contrato, vencimentos de pagamento, prazo-limite para aviso de não-renovação, data de reajuste, carências e qualquer outro prazo crítico.`
            }
          ]
        }]
      })
    })

    clearTimeout(abortTimer)

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text()
      return new Response(JSON.stringify({
        error: `Erro na API Anthropic: ${anthropicResponse.status}`,
        details: errorBody.substring(0, 500)
      }), { status: 500, headers: CORS_HEADERS })
    }

    const result = await anthropicResponse.json()
    const rawText = result.content?.[0]?.text || ""

    if (!rawText) {
      return new Response(JSON.stringify({
        error: "Resposta vazia da API Anthropic",
        usage: result.usage
      }), { status: 500, headers: CORS_HEADERS })
    }

    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // Tenta extrair JSON de resposta com markdown ou texto extra
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch {
          return new Response(JSON.stringify({
            error: "Não foi possível interpretar a resposta como JSON",
            raw: rawText.substring(0, 1000)
          }), { status: 500, headers: CORS_HEADERS })
        }
      } else {
        return new Response(JSON.stringify({
          error: "Nenhum JSON encontrado na resposta",
          raw: rawText.substring(0, 1000)
        }), { status: 500, headers: CORS_HEADERS })
      }
    }

    // Normalização de tipos — garante formatos corretos antes de retornar
    const normalized = {
      ...parsed,
      // Datas principais
      start_date: normalizeDate(parsed.start_date),
      end_date: normalizeDate(parsed.end_date),
      readjustment_base_date: normalizeDate(parsed.readjustment_base_date),
      // Valores e contagens
      total_value: normalizeNumber(parsed.total_value),
      installment_value: normalizeNumber(parsed.installment_value),
      installment_count: normalizeNumber(parsed.installment_count),
      renewal_notice_days: normalizeNumber(parsed.renewal_notice_days),
      payment_due_day: normalizeNumber(parsed.payment_due_day),
      termination_notice_days: normalizeNumber(parsed.termination_notice_days),
      termination_penalty_percentage: normalizeNumber(parsed.termination_penalty_percentage),
      late_payment_penalty_percentage: normalizeNumber(parsed.late_payment_penalty_percentage),
      interest_rate_monthly: normalizeNumber(parsed.interest_rate_monthly),
      // Booleanos
      auto_renewal: normalizeBool(parsed.auto_renewal),
      has_confidentiality_clause: normalizeBool(parsed.has_confidentiality_clause),
      has_liability_limitation: normalizeBool(parsed.has_liability_limitation),
      has_monetary_correction: normalizeBool(parsed.has_monetary_correction),
      has_exclusivity_clause: normalizeBool(parsed.has_exclusivity_clause),
      // Arrays
      obligations: Array.isArray(parsed.obligations)
        ? (parsed.obligations as Record<string, unknown>[]).map(o => ({
            ...o,
            due_date: normalizeDate(o.due_date),
          }))
        : [],
      opportunities: Array.isArray(parsed.opportunities)
        ? (parsed.opportunities as Record<string, unknown>[]).map(o => ({
            ...o,
            risk_level: normalizeRisk(o.risk_level),
          }))
        : [],
      key_dates: Array.isArray(parsed.key_dates)
        ? (parsed.key_dates as Record<string, unknown>[]).map(k => ({
            ...k,
            date: normalizeDate(k.date),
          })).filter(k => k.date !== null)
        : [],
    }

    return new Response(JSON.stringify({ success: true, data: normalized }), {
      headers: CORS_HEADERS
    })

  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError"
    return new Response(JSON.stringify({
      error: isAbort
        ? "Tempo limite excedido ao processar o PDF. Tente um arquivo menor ou aguarde e tente novamente."
        : "Erro interno na função",
      details: isAbort ? undefined : String(err)
    }), { status: isAbort ? 504 : 500, headers: CORS_HEADERS })
  }
}

export const config: Config = {
  path: "/api/extract-contract"
}
