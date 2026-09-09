import { AnalysisStatus } from '@/types'
import clsx from 'clsx'

const CONFIG: Record<AnalysisStatus, { label: string; classes: string }> = {
  processando:         { label: 'IA processando',      classes: 'bg-blue-100 text-blue-700' },
  rascunho_estagiario: { label: 'Rascunho estagiário', classes: 'bg-purple-100 text-purple-700' },
  aguardando_revisao:  { label: 'Aguardando revisão',  classes: 'bg-amber-100 text-amber-700' },
  rascunho:            { label: 'Rascunho',            classes: 'bg-slate-100 text-slate-700' },
  finalizado:          { label: 'Finalizado',          classes: 'bg-emerald-100 text-emerald-700' },
  falhou:              { label: 'Falhou',              classes: 'bg-red-100 text-red-700' },
}

export function AnalysisStatusBadge({ status, className = '' }: { status: AnalysisStatus; className?: string }) {
  const cfg = CONFIG[status] || { label: status, classes: 'bg-slate-100 text-slate-700' }
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium', cfg.classes, className)}>
      {cfg.label}
    </span>
  )
}
