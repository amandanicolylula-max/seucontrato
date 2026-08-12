// Converte YYYY-MM-DD para DD/MM/YYYY. Retorna '—' se inválido.
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // Já está no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value
  // Formato ISO YYYY-MM-DD
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return value
}

// Formata número para R$ X.XXX,XX
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value
  if (isNaN(num)) return String(value)
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Converte boolean para Sim/Não
export function formatBool(value: boolean | null | undefined): string {
  if (value === true) return 'Sim'
  if (value === false) return 'Não'
  return '—'
}

// Exibe valor ou '—' se null/undefined/''
export function formatText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

// Formata número simples (parcelas, dias, etc.)
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}
