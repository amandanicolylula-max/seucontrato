import { createClient } from "@supabase/supabase-js"

// ─── Normalização de tipos ────────────────────────────────────────────────────

function normalizeDate(value: unknown): string | null {
  if (!value || typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "null") return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
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

// ─── Prompt ───────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Você é um especialista em direito contratual brasileiro a serviço do escritório Braga & Dantas Advogados. Analise o contrato PDF e retorne EXCLUSIVAMENTE um objeto JSON válido — sem markdown, sem blocos de código, sem texto antes ou depois.

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
  "total_value": número decimal sem formatação ou null (use null se o valor for descritivo/variável),
  "total_value_description": "descrição textual do valor quando não for um número fixo (ex: '2 salários mínimos vigentes', 'valor a definir entre as partes', 'conforme proposta anexa') ou null se total_value for numérico",
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

// ─── Handler (Netlify Background Function v1) ────────────────────────────────

export const handler = async (event: { body: string; headers: Record<string, string> }) => {
  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const apiKey = process.env.ANTHROPIC_API_KEY!

  let contractId: string | undefined

  try {
    const body = JSON.parse(event.body || "{}")
    contractId = body.contractId

    if (!contractId) throw new Error("contractId obrigatório")

    const supabase = createClient(supabaseUrl, serviceKey)

    // Busca o contrato para obter file_path e client_id
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("file_path, file_name, client_id")
      .eq("id", contractId)
      .single()

    if (contractError || !contract) throw new Error("Contrato não encontrado")

    // Baixa o PDF do Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("contracts")
      .download(contract.file_path)

    if (downloadError || !fileData) throw new Error(`Falha ao baixar PDF: ${downloadError?.message}`)

    // Converte para base64
    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    // Chama a API da Anthropic
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    })

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text()
      throw new Error(`Anthropic ${anthropicResponse.status}: ${errBody.substring(0, 300)}`)
    }

    const result = await anthropicResponse.json()
    const rawText: string = result.content?.[0]?.text || ""

    if (!rawText) throw new Error("Resposta vazia da Anthropic")

    // Parse do JSON retornado
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error("JSON não encontrado na resposta")
    }

    // Normalização
    const normalized = {
      ...parsed,
      start_date: normalizeDate(parsed.start_date),
      end_date: normalizeDate(parsed.end_date),
      readjustment_base_date: normalizeDate(parsed.readjustment_base_date),
      total_value: normalizeNumber(parsed.total_value),
      installment_value: normalizeNumber(parsed.installment_value),
      installment_count: normalizeNumber(parsed.installment_count),
      renewal_notice_days: normalizeNumber(parsed.renewal_notice_days),
      payment_due_day: normalizeNumber(parsed.payment_due_day),
      termination_notice_days: normalizeNumber(parsed.termination_notice_days),
      termination_penalty_percentage: normalizeNumber(parsed.termination_penalty_percentage),
      late_payment_penalty_percentage: normalizeNumber(parsed.late_payment_penalty_percentage),
      interest_rate_monthly: normalizeNumber(parsed.interest_rate_monthly),
      auto_renewal: normalizeBool(parsed.auto_renewal),
      has_confidentiality_clause: normalizeBool(parsed.has_confidentiality_clause),
      has_liability_limitation: normalizeBool(parsed.has_liability_limitation),
      has_monetary_correction: normalizeBool(parsed.has_monetary_correction),
      has_exclusivity_clause: normalizeBool(parsed.has_exclusivity_clause),
      obligations: Array.isArray(parsed.obligations)
        ? (parsed.obligations as Record<string, unknown>[]).map(o => ({
            ...o, due_date: normalizeDate(o.due_date),
          }))
        : [],
      opportunities: Array.isArray(parsed.opportunities)
        ? (parsed.opportunities as Record<string, unknown>[]).map(o => ({
            ...o, risk_level: normalizeRisk(o.risk_level),
          }))
        : [],
      key_dates: Array.isArray(parsed.key_dates)
        ? (parsed.key_dates as Record<string, unknown>[]).map(k => ({
            ...k, date: normalizeDate(k.date),
          })).filter(k => k.date !== null)
        : [],
    }

    // ── Salva contract_metadata ──────────────────────────────────────────────
    await supabase.from("contract_metadata").upsert({
      contract_id: contractId,
      contracting_party: normalized.contracting_party || null,
      contracting_party_document: normalized.contracting_party_document || null,
      contracted_party: normalized.contracted_party || null,
      contracted_party_document: normalized.contracted_party_document || null,
      object_description: normalized.object_description || null,
      start_date: normalized.start_date || null,
      end_date: normalized.end_date || null,
      total_duration: normalized.total_duration || null,
      auto_renewal: normalized.auto_renewal ?? false,
      renewal_notice_days: normalized.renewal_notice_days || null,
      total_value: normalized.total_value || null,
      installment_value: normalized.installment_value || null,
      installment_count: normalized.installment_count || null,
      readjustment_index: normalized.readjustment_index || null,
      penalty_clause: normalized.penalty_clause || null,
      termination_clause: normalized.termination_clause || null,
      jurisdiction: normalized.jurisdiction || null,
      has_confidentiality_clause: normalized.has_confidentiality_clause ?? false,
      has_liability_limitation: normalized.has_liability_limitation ?? false,
      raw_extraction: normalized,
    }, { onConflict: "contract_id" })

    // ── Salva obrigações ────────────────────────────────────────────────────
    const obligations = normalized.obligations as Record<string, unknown>[]
    if (obligations.length > 0) {
      await supabase.from("contract_obligations").delete().eq("contract_id", contractId)
      await supabase.from("contract_obligations").insert(
        obligations.map(o => ({
          contract_id: contractId,
          party: o.party || "Não especificado",
          description: o.description || "",
          due_date: o.due_date || null,
          is_recurring: o.is_recurring ?? false,
          recurrence_pattern: o.recurrence_pattern || null,
          status: "pendente",
        }))
      )
    }

    // ── Salva oportunidades ─────────────────────────────────────────────────
    const opportunities = normalized.opportunities as Record<string, unknown>[]
    if (opportunities.length > 0) {
      await supabase.from("contract_opportunities").delete().eq("contract_id", contractId)
      await supabase.from("contract_opportunities").insert(
        opportunities.map(o => {
          const category = String(o.category || "")
          const prefix = category === "vulnerabilidade" ? "Vulnerabilidade: "
            : category === "servico" ? "Serviço B&D: " : ""
          return {
            contract_id: contractId,
            client_id: contract.client_id,
            type: prefix + (String(o.type || "") || "Não categorizado"),
            description: String(o.description || ""),
            risk_level: String(o.risk_level || "medio"),
            status: "identificada",
          }
        })
      )
    }

    // ── Salva alertas ───────────────────────────────────────────────────────
    const keyDates = normalized.key_dates as { type: string; date: string; description: string }[]
    const alerts: Record<string, unknown>[] = []

    for (const kd of keyDates) {
      if (!kd.date) continue
      const d = new Date(kd.date)
      if (d > new Date()) {
        alerts.push({
          contract_id: contractId,
          alert_type: kd.type || "prazo",
          alert_date: kd.date,
          days_before: 0,
          message: kd.description,
        })
      }
      for (const days of [30, 7]) {
        const rem = new Date(kd.date)
        rem.setDate(rem.getDate() - days)
        if (rem > new Date()) {
          alerts.push({
            contract_id: contractId,
            alert_type: kd.type || "prazo",
            alert_date: rem.toISOString().split("T")[0],
            days_before: days,
            message: `${kd.description} — em ${days} dias`,
          })
        }
      }
    }

    if (normalized.end_date && !keyDates.some(kd => kd.type === "vencimento")) {
      for (const days of [90, 60, 30, 15, 7]) {
        const d = new Date(normalized.end_date as string)
        d.setDate(d.getDate() - days)
        if (d > new Date()) {
          alerts.push({
            contract_id: contractId,
            alert_type: "vencimento",
            alert_date: d.toISOString().split("T")[0],
            days_before: days,
            message: `Contrato vence em ${days} dias`,
          })
        }
      }
    }

    if (alerts.length > 0) {
      await supabase.from("contract_alerts").delete().eq("contract_id", contractId)
      await supabase.from("contract_alerts").insert(alerts)
    }

    // ── Atualiza status para concluido ──────────────────────────────────────
    await supabase.from("contracts").update({ extraction_status: "concluido" }).eq("id", contractId)

  } catch (err) {
    console.error("Background extraction error:", err)
    if (contractId) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await supabase
          .from("contracts")
          .update({ extraction_status: "falhou" })
          .eq("id", contractId)
      } catch (updateErr) {
        console.error("Failed to update status to falhou:", updateErr)
      }
    }
  }
}
