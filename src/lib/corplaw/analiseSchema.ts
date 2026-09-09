// JSON Schema da análise, usado com structured outputs da API Anthropic
// (`output_config.format`). Mantém o formato de saída idêntico ao tipo
// `AnaliseDocumento` de `src/lib/types.ts` — se um mudar, o outro precisa mudar.

const risco: Record<string, unknown> = {
  type: "object",
  properties: {
    codigo: { type: "string", description: "R1, R2, R3..." },
    titulo: { type: "string" },
    gravidade: { type: "string", enum: ["CRÍTICO", "ALTO", "MÉDIO", "BAIXO"] },
    probabilidade: { type: "string", enum: ["Baixa", "Média", "Alta", "Muito Alta"] },
    impacto: { type: "string", enum: ["Baixo", "Médio", "Alto", "Muito Alto"] },
    tipo: { type: "string", enum: ["Redação", "Mercado", "Proteção do negócio", "Operacional"] },
    clausulas: { type: "array", items: { type: "string" } },
    origem: {
      type: "string",
      description:
        "De onde vem o risco, de forma didática: do próprio contrato (qual cláusula), de prática do mercado, da AUSÊNCIA de uma cláusula que deveria existir, ou do CRUZAMENTO entre cláusulas.",
    },
    descricao: { type: "string", description: "Explicação didática do problema, acessível a quem não é advogado" },
    cruzamento: { type: "string", description: "Análise de cruzamento com outras cláusulas" },
    cenario: {
      type: "string",
      description: "Em que situações práticas do dia a dia esse risco se concretiza (o gatilho concreto).",
    },
    impacto_potencial: { type: "string" },
    exposicao_brl: { type: ["integer", "null"], description: "Exposição estimada em reais, sem centavos" },
    recomendacao: { type: "string", description: "Como mitigar ou prevenir o risco, de forma prática e concreta" },
  },
  required: [
    "codigo",
    "titulo",
    "gravidade",
    "probabilidade",
    "impacto",
    "tipo",
    "clausulas",
    "origem",
    "descricao",
    "cruzamento",
    "cenario",
    "impacto_potencial",
    "exposicao_brl",
    "recomendacao",
  ],
  additionalProperties: false,
};

const recomendacao: Record<string, unknown> = {
  type: "object",
  properties: {
    acao: { type: "string" },
    urgencia: { type: "integer", description: "1 = mais urgente" },
    impacto_se_ignorado: { type: "string" },
  },
  required: ["acao", "urgencia", "impacto_se_ignorado"],
  additionalProperties: false,
};

export const ANALISE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    tipo_documento: { type: "string" },
    partes: { type: "array", items: { type: "string" } },
    objeto: { type: "string" },
    valor_total: { type: ["string", "null"] },
    vigencia: { type: ["string", "null"] },
    estrutura_pagamento: { type: ["string", "null"] },
    resumo_operacao: { type: "string", description: "Parágrafo curto em linguagem simples" },
    contexto_negocio: { type: "string", description: "Avaliação do alinhamento com o negócio do cliente" },
    pontos_positivos: { type: "array", items: { type: "string" } },
    riscos: {
      type: "array",
      items: risco,
      description: "Ordenados do mais grave ao menos grave",
    },
    exposicao_total_brl: { type: ["integer", "null"] },
    recomendacoes_prioritarias: {
      type: "array",
      items: recomendacao,
      description: "Máximo 5, em ordem crescente de urgência",
    },
    avaliacao_geral: { type: "integer", description: "1 a 5 estrelas" },
    avaliacao_texto: { type: "string" },
    prazo_relevante: { type: ["string", "null"] },
  },
  required: [
    "tipo_documento",
    "partes",
    "objeto",
    "valor_total",
    "vigencia",
    "estrutura_pagamento",
    "resumo_operacao",
    "contexto_negocio",
    "pontos_positivos",
    "riscos",
    "exposicao_total_brl",
    "recomendacoes_prioritarias",
    "avaliacao_geral",
    "avaliacao_texto",
    "prazo_relevante",
  ],
  additionalProperties: false,
};
