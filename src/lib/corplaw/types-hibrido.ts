import type { AnaliseDocumento } from './types'

/** Análise híbrida = base do Corplaw + camadas de personalização do advogado. */
export interface AnaliseHibrida extends AnaliseDocumento {
  /** Seções livres adicionadas pelo advogado depois da análise da IA (ex.: notas
   *  contextuais, observações do escritório, considerações específicas do cliente). */
  secoes_livres?: SecaoLivre[]
  /** Bloco de anotações livres do advogado em markdown. */
  anotacoes_advogado?: string
}

export interface SecaoLivre {
  id: string
  titulo: string
  conteudo: string   // markdown/plain text (TipTap salva texto puro com quebras de linha)
  created_by?: string
  created_at: string
}
