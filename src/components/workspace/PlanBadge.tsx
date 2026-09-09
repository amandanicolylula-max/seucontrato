import { PlanTipo } from '@/types'
import clsx from 'clsx'

const CONFIG: Record<PlanTipo, { label: string; classes: string }> = {
  individual: { label: 'Individual', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  enterprise: { label: 'Enterprise', classes: 'bg-accent/10 text-accent border-accent/30' },
}

export function PlanBadge({ tipo, className = '' }: { tipo: PlanTipo; className?: string }) {
  const cfg = CONFIG[tipo] || { label: tipo, classes: 'bg-slate-100 text-slate-700' }
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border', cfg.classes, className)}>
      {cfg.label}
    </span>
  )
}
