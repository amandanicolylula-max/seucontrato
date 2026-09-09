export type Gravidade = "CRÍTICO" | "ALTO" | "MÉDIO" | "BAIXO";
export type Probabilidade = "Baixa" | "Média" | "Alta" | "Muito Alta";
export type ImpactoNivel = "Baixo" | "Médio" | "Alto" | "Muito Alto";
export type TipoRisco = "Redação" | "Mercado" | "Proteção do negócio" | "Operacional";
export type Perspectiva =
  | "escrito_pelo_cliente"
  | "recebido_de_terceiro"
  | "viabilidade"
  | "vigente_prevencao";

export interface RiscoDetalhado {
  codigo: string;
  titulo: string;
  gravidade: Gravidade;
  probabilidade: Probabilidade;
  impacto: ImpactoNivel;
  tipo: TipoRisco;
  clausulas: string[];
  /** De onde vem o risco: cláusula do contrato, prática de mercado, ausência de cláusula, cruzamento entre cláusulas. */
  origem: string;
  descricao: string;
  cruzamento: string;
  /** Em que situações práticas o risco se concretiza (o gatilho). */
  cenario: string;
  impacto_potencial: string;
  exposicao_brl: number | null;
  /** Como mitigar / prevenir o risco. */
  recomendacao: string;
}

export interface RecomendacaoPrioritaria {
  acao: string;
  urgencia: number;
  impacto_se_ignorado: string;
}

export interface AnaliseDocumento {
  tipo_documento: string;
  partes: string[];
  objeto: string;
  valor_total: string | null;
  vigencia: string | null;
  estrutura_pagamento: string | null;
  resumo_operacao: string;
  contexto_negocio: string;
  pontos_positivos: string[];
  riscos: RiscoDetalhado[];
  exposicao_total_brl: number | null;
  recomendacoes_prioritarias: RecomendacaoPrioritaria[];
  avaliacao_geral: number;
  avaliacao_texto: string;
  prazo_relevante: string | null;
}

export interface ContextoAnalise {
  negocio: string;
  perspectiva: Perspectiva;
  preocupacoes: string;
}

export interface Analise {
  id: string;
  user_id: string;
  nome_arquivo: string;
  resultado: AnaliseDocumento;
  created_at: string;
}

export interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}
