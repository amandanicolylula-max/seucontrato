const statusMap: Record<string, { label: string; className: string }> = {
  // Contract status
  ativo: { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  em_renovacao: { label: 'Em Renovação', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  encerrado: { label: 'Encerrado', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  arquivado: { label: 'Arquivado', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  // Extraction status
  pendente: { label: 'Pendente', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  processando: { label: 'Processando', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  concluido: { label: 'Concluído', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  falhou: { label: 'Falhou', className: 'bg-red-100 text-red-700 border-red-200' },
  // Opportunity status
  identificada: { label: 'Identificada', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  em_abordagem: { label: 'Em Abordagem', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  convertida: { label: 'Convertida', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  descartada: { label: 'Descartada', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  // Risk levels
  alto: { label: 'Alto', className: 'bg-red-100 text-red-700 border-red-200' },
  medio: { label: 'Médio', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  baixo: { label: 'Baixo', className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export interface BadgeProps {
  value: string | null | undefined
  className?: string
}

export function Badge({ value, className }: BadgeProps) {
  if (!value) return null
  const mapped = statusMap[value] || { label: value, className: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${mapped.className} ${className || ''}`}>
      {mapped.label}
    </span>
  )
}
