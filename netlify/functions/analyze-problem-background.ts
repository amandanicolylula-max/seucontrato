import { createClient } from "@supabase/supabase-js"

const PROBLEM_ANALYSIS_PROMPT = (
  description: string,
  category: string,
  contractType?: string,
  clientContext?: string
) => `Você é um advogado especialista em direito contratual brasileiro. Um escritório de advocacia registrou o seguinte problema que um cliente vivenciou em um contexto contratual.

PROBLEMA REGISTRADO:
Descrição: ${description}
Categoria: ${category}
${contractType ? `Tipo de contrato: ${contractType}` : ""}
${clientContext ? `Contexto adicional: ${clientContext}` : ""}

Com base nesse relato, analise:
1. Quais cláusulas estavam ausentes ou mal redigidas que permitiram ou agravaram este problema?
2. Para cada cláusula identificada, sugira um texto concreto e adequado ao direito brasileiro.
3. Quais recomendações gerais este escritório deve seguir em contratos futuros${contractType ? ` do tipo "${contractType}"` : ""} para evitar problemas similares?

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem markdown, sem blocos de código):
{
  "missing_clauses": [
    {
      "clause_type": "nome objetivo da cláusula (ex: 'Cláusula Penal por Inadimplemento')",
      "description": "por que essa cláusula teria prevenido ou mitigado o problema",
      "suggested_text": "texto sugerido para a cláusula, adequado ao direito brasileiro, entre 2-6 linhas"
    }
  ],
  "ai_recommendations": "parágrafo único com recomendações gerais para contratos futuros deste tipo, citando os pontos mais críticos identificados"
}`

export const handler = async (event: { body: string; headers: Record<string, string> }) => {
  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const apiKey = process.env.ANTHROPIC_API_KEY!

  let problemId: string | undefined

  try {
    const body = JSON.parse(event.body || "{}")
    problemId = body.problemId
    const description: string = body.description
    const category: string = body.category
    const contractType: string | undefined = body.contractType
    const clientContext: string | undefined = body.clientContext

    if (!problemId) throw new Error("problemId obrigatório")
    if (!description) throw new Error("description obrigatório")
    if (!category) throw new Error("category obrigatório")

    const prompt = PROBLEM_ANALYSIS_PROMPT(description, category, contractType, clientContext)

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
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }],
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

    // ── Parse do JSON ──────────────────────────────────────────────────────
    let parsed: { missing_clauses?: unknown[]; ai_recommendations?: string } = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
      else throw new Error("JSON não encontrado na resposta")
    }

    // ── Salva no banco ─────────────────────────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceKey)
    await supabase
      .from("contract_problems")
      .update({
        missing_clauses: parsed.missing_clauses || [],
        ai_recommendations: parsed.ai_recommendations || null,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq("id", problemId)

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    }

  } catch (err) {
    console.error("analyze-problem error:", err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    }
  }
}
