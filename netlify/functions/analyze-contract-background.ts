import { createClient } from "@supabase/supabase-js"

// ─── Contexto histórico ───────────────────────────────────────────────────────

function buildHistoricalContext(
  counterpartyProblems: Record<string, unknown>[],
  typeProblems: Record<string, unknown>[]
): string {
  const lines: string[] = []

  if (counterpartyProblems.length > 0) {
    lines.push("⚠️ ATENÇÃO — HISTÓRICO DE PROBLEMAS COM ESTA CONTRAPARTE:")
    lines.push("O escritório já registrou os seguintes problemas envolvendo esta mesma contraparte:")
    counterpartyProblems.forEach((p, i) => {
      const date = p.event_date ? ` (${p.event_date})` : ""
      const impact = p.financial_impact
        ? ` — impacto financeiro: R$ ${Number(p.financial_impact).toLocaleString("pt-BR")}`
        : ""
      lines.push(`${i + 1}. ${p.description}${date}${impact}`)
      if (p.ai_recommendations) lines.push(`   Recomendação registrada: ${p.ai_recommendations}`)
    })
    lines.push(
      "Inclua OBRIGATORIAMENTE na seção 'Riscos e Vulnerabilidades' um alerta destacado sobre este histórico.\n"
    )
  }

  if (typeProblems.length > 0) {
    lines.push("📋 PROBLEMAS RECORRENTES NESTE TIPO DE CONTRATO (banco de casos do escritório):")
    typeProblems.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.description}`)
      if (Array.isArray(p.missing_clauses) && p.missing_clauses.length > 0) {
        const clauses = (p.missing_clauses as Record<string, unknown>[])
          .map((c) => c.clause_type)
          .filter(Boolean)
          .join(", ")
        if (clauses) lines.push(`   Cláusulas identificadas como ausentes: ${clauses}`)
      }
    })
    lines.push("Incorpore esses padrões nas seções 'Riscos' e 'Recomendações'.\n")
  }

  return lines.length > 0
    ? "HISTÓRICO DE PROBLEMAS DO ESCRITÓRIO RELEVANTES PARA ESTE CONTRATO:\n" + lines.join("\n")
    : ""
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(userContext?: string, historicalProblems?: string): string {
  return `Você é um advogado especialista em direito contratual brasileiro a serviço do escritório Braga & Dantas Advogados. Produza um parecer jurídico profissional e detalhado em português brasileiro.

${userContext ? `CONTEXTO FORNECIDO PELO USUÁRIO:\n${userContext}\n` : ""}
${historicalProblems ? `${historicalProblems}\n` : ""}
INSTRUÇÕES:
- Analise o contrato PDF em anexo com rigor técnico-jurídico
- Use linguagem formal e profissional adequada a pareceres jurídicos
- Seja específico: cite cláusulas, artigos e valores quando relevante
- Use numeração nos pontos de análise (1., 2., 3.)
- Campo ausente ou incerto: diga "não identificado no instrumento"

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem markdown, sem blocos de código, sem texto antes ou depois):
{
  "titulo": "Parecer Contratual — [tipo de contrato identificado]",
  "objeto": "descrição objetiva do objeto contratual em 1-2 frases",
  "partes": {
    "contratante": "nome completo da parte contratante ou 'não identificado'",
    "contratada": "nome completo da parte contratada ou 'não identificado'"
  },
  "secoes": [
    {
      "id": "analise",
      "titulo": "Análise das Cláusulas Principais",
      "conteudo": "análise detalhada das cláusulas mais relevantes, numerada"
    },
    {
      "id": "riscos",
      "titulo": "Riscos e Vulnerabilidades Identificados",
      "conteudo": "lista numerada de riscos com impacto e gravidade"
    },
    {
      "id": "ausencias",
      "titulo": "Cláusulas Ausentes ou Inadequadas",
      "conteudo": "lista numerada de cláusulas ausentes ou mal redigidas"
    },
    {
      "id": "recomendacoes",
      "titulo": "Recomendações",
      "conteudo": "lista numerada de ações concretas recomendadas"
    },
    {
      "id": "conclusao",
      "titulo": "Conclusão",
      "conteudo": "síntese objetiva com avaliação geral do instrumento (2-4 parágrafos)"
    }
  ],
  "nivel_risco_geral": "alto ou medio ou baixo",
  "resumo_executivo": "2-3 frases resumindo o parecer"
}`
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler = async (event: { body: string; headers: Record<string, string> }) => {
  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const apiKey = process.env.ANTHROPIC_API_KEY!

  let analysisId: string | undefined

  try {
    const body = JSON.parse(event.body || "{}")
    analysisId = body.analysisId
    const filePath: string = body.filePath
    const context: string | undefined = body.context
    const counterpartyHint: string | undefined = body.counterpartyHint
    const contractTypeHint: string | undefined = body.contractTypeHint

    if (!analysisId) throw new Error("analysisId obrigatório")
    if (!filePath) throw new Error("filePath obrigatório")

    const supabase = createClient(supabaseUrl, serviceKey)

    // ── Baixa o PDF do Supabase Storage ───────────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("analyses")
      .download(filePath)

    if (downloadError || !fileData) {
      throw new Error(`Falha ao baixar PDF: ${downloadError?.message}`)
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    // ── Busca problemas históricos relevantes ──────────────────────────────
    let counterpartyProblems: Record<string, unknown>[] = []
    let typeProblems: Record<string, unknown>[] = []

    if (counterpartyHint) {
      const { data } = await supabase
        .from("contract_problems")
        .select("description, event_date, financial_impact, ai_recommendations, missing_clauses")
        .ilike("counterparty_name", `%${counterpartyHint}%`)
        .order("created_at", { ascending: false })
        .limit(5)
      counterpartyProblems = (data || []) as Record<string, unknown>[]
    }

    if (contractTypeHint) {
      const { data } = await supabase
        .from("contract_problems")
        .select("description, missing_clauses, ai_recommendations")
        .ilike("contract_type", `%${contractTypeHint}%`)
        .order("created_at", { ascending: false })
        .limit(8)
      typeProblems = (data || []) as Record<string, unknown>[]
    }

    const historicalCtx = buildHistoricalContext(counterpartyProblems, typeProblems)
    const prompt = buildPrompt(context, historicalCtx)

    // ── Chama a API da Anthropic ───────────────────────────────────────────
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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text()
      throw new Error(`Anthropic ${anthropicResponse.status}: ${errBody.substring(0, 300)}`)
    }

    const result = await anthropicResponse.json()
    const rawText: string = result.content?.[0]?.text || ""
    if (!rawText) throw new Error("Resposta vazia da Anthropic")

    // ── Parse do JSON ──────────────────────────────────────────────────────
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error("JSON não encontrado na resposta da Anthropic")
    }

    const riskRaw = String(parsed.nivel_risco_geral || "medio").toLowerCase()
    const riskLevel = riskRaw.includes("alto") ? "alto"
      : riskRaw.includes("baixo") ? "baixo" : "medio"

    // ── Salva resultado no banco ───────────────────────────────────────────
    await supabase
      .from("contract_analyses")
      .update({
        ai_sections: parsed,
        edited_sections: parsed,
        status: "rascunho",
        risk_level: riskLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    // ── Remove PDF temporário do Storage ──────────────────────────────────
    await supabase.storage.from("analyses").remove([filePath])

  } catch (err) {
    console.error("analyze-contract error:", err)
    if (analysisId) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        await supabase
          .from("contract_analyses")
          .update({ status: "falhou", updated_at: new Date().toISOString() })
          .eq("id", analysisId)
      } catch (e) {
        console.error("Falha ao marcar análise como falhou:", e)
      }
    }
  }
}
