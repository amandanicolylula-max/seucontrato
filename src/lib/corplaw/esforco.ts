// Nível de esforço (`output_config.effort` da API Anthropic) configurado por
// tarefa. Portado de corplaw-analise-app, adaptado para Vite (import.meta.env).

export type NivelEsforco = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Tarefa = 'analise' | 'chat_pergunta' | 'chat_alteracao'
export type ConfigEsforco = Record<Tarefa, NivelEsforco>

export const NIVEIS: { valor: NivelEsforco; label: string; descricao: string }[] = [
  { valor: 'low',    label: 'Baixo',      descricao: 'Rápido e direto. Menos cruzamentos.' },
  { valor: 'medium', label: 'Médio',      descricao: 'Equilíbrio entre profundidade e tempo.' },
  { valor: 'high',   label: 'Alto',       descricao: 'Padrão do escritório. Análise completa.' },
  { valor: 'xhigh',  label: 'Muito alto', descricao: 'Mais rigor. Bem mais lento.' },
  { valor: 'max',    label: 'Máximo',     descricao: 'Profundidade máxima, sem economia.' },
]

export const TAREFAS: { valor: Tarefa; label: string; descricao: string }[] = [
  { valor: 'analise',         label: 'Análise do contrato', descricao: 'Leitura inicial gera o relatório completo.' },
  { valor: 'chat_pergunta',   label: 'Pergunta no chat',    descricao: 'Dúvidas sobre a análise, sem alterar.' },
  { valor: 'chat_alteracao',  label: 'Alteração via chat',  descricao: 'Quando o chat reescreve a análise.' },
]

const NIVEIS_VALIDOS = new Set<string>(NIVEIS.map(n => n.valor))

export function normalizarNivel(valor: unknown, padrao: NivelEsforco): NivelEsforco {
  return typeof valor === 'string' && NIVEIS_VALIDOS.has(valor) ? (valor as NivelEsforco) : padrao
}

// No Vite, env vars vêm de import.meta.env com prefixo VITE_
const envVars: Record<string, string | undefined> = typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env
  ? (import.meta as { env: Record<string, string | undefined> }).env
  : {}

export const CONFIG_PADRAO: ConfigEsforco = {
  analise:         normalizarNivel(envVars.VITE_ESFORCO_ANALISE,         'high'),
  chat_pergunta:   normalizarNivel(envVars.VITE_ESFORCO_CHAT_PERGUNTA,   'medium'),
  chat_alteracao:  normalizarNivel(envVars.VITE_ESFORCO_CHAT_ALTERACAO,  'medium'),
}

export const SEGUNDOS_ESTIMADOS: Record<Tarefa, Record<NivelEsforco, number>> = {
  analise:        { low: 60, medium: 80, high: 120, xhigh: 180, max: 260 },
  chat_pergunta:  { low: 8,  medium: 12, high: 15,  xhigh: 25,  max: 35 },
  chat_alteracao: { low: 45, medium: 60, high: 80,  xhigh: 120, max: 170 },
}

export function estimativaSegundos(tarefa: Tarefa, nivel: NivelEsforco): number {
  return SEGUNDOS_ESTIMADOS[tarefa][nivel]
}

export function segundosParaTexto(segundos: number): string {
  if (segundos < 60) return `~${segundos}s`
  return `~${Math.round(segundos / 60)} min`
}

const PADRAO_ALTERACAO =
  /altere|mude|modifique|atualize|adicione|remova|inclua|corrija|ajuste|troque|melhore/

export function pedeAlteracao(mensagem: string): boolean {
  return PADRAO_ALTERACAO.test(mensagem.toLowerCase())
}

export function classificarTarefaChat(mensagem: string): 'chat_pergunta' | 'chat_alteracao' {
  return pedeAlteracao(mensagem) ? 'chat_alteracao' : 'chat_pergunta'
}

// ── Persistência local (por navegador) ──────────────────────────────────
export const CHAVE_STORAGE = 'seucontrato:esforco'

export function carregarConfig(): ConfigEsforco {
  if (typeof window === 'undefined') return CONFIG_PADRAO
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE)
    if (!bruto) return CONFIG_PADRAO
    const salvo = JSON.parse(bruto) as Partial<ConfigEsforco>
    return {
      analise:        normalizarNivel(salvo.analise,        CONFIG_PADRAO.analise),
      chat_pergunta:  normalizarNivel(salvo.chat_pergunta,  CONFIG_PADRAO.chat_pergunta),
      chat_alteracao: normalizarNivel(salvo.chat_alteracao, CONFIG_PADRAO.chat_alteracao),
    }
  } catch {
    return CONFIG_PADRAO
  }
}

export function salvarConfig(config: ConfigEsforco): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(config))
  } catch {
    // localStorage bloqueado — segue com padrão
  }
}
