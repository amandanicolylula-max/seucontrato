import { CreditBalance, CreditTransactionTipo } from '@/types'

export function totalDisponivel(balance: CreditBalance | null | undefined): number {
  if (!balance) return 0
  const now = Date.now()
  const mensal = balance.saldo_mensal_ciclo
    .filter(c => new Date(c.expira_em).getTime() > now)
    .reduce((sum, c) => sum + c.creditos, 0)
  return mensal + balance.saldo_avulso
}

export function totalMensalDisponivel(balance: CreditBalance | null | undefined): number {
  if (!balance) return 0
  const now = Date.now()
  return balance.saldo_mensal_ciclo
    .filter(c => new Date(c.expira_em).getTime() > now)
    .reduce((sum, c) => sum + c.creditos, 0)
}

export function proximaExpiracao(balance: CreditBalance | null | undefined): Date | null {
  if (!balance || balance.saldo_mensal_ciclo.length === 0) return null
  const now = Date.now()
  const proximas = balance.saldo_mensal_ciclo
    .filter(c => new Date(c.expira_em).getTime() > now)
    .map(c => new Date(c.expira_em).getTime())
    .sort((a, b) => a - b)
  return proximas[0] ? new Date(proximas[0]) : null
}

const TIPO_LABELS: Record<CreditTransactionTipo, { label: string; cor: string }> = {
  compra:        { label: 'Compra',        cor: 'bg-emerald-100 text-emerald-700' },
  consumo:       { label: 'Consumo',       cor: 'bg-slate-100 text-slate-600' },
  estorno:       { label: 'Estorno',       cor: 'bg-blue-100 text-blue-700' },
  renovacao:     { label: 'Renovação',     cor: 'bg-accent/10 text-accent' },
  bonus_corplaw: { label: 'Cortesia',      cor: 'bg-amber-100 text-amber-700' },
  expiracao:     { label: 'Expiração',     cor: 'bg-red-50 text-red-600' },
}

export function tipoTransacao(tipo: CreditTransactionTipo) {
  return TIPO_LABELS[tipo] || { label: tipo, cor: 'bg-slate-100 text-slate-600' }
}

export function formatCreditos(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toLocaleString('pt-BR')}`
}

// Custos padrão
export const CUSTO_ANALISE_CONTRATUAL = 50
export const CUSTO_CONTRATO_MENSAL = 10
