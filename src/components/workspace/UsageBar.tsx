import clsx from 'clsx'

interface Props {
  usado: number
  limite: number | null
  showLabel?: boolean
  className?: string
}

export function UsageBar({ usado, limite, showLabel = true, className = '' }: Props) {
  if (limite === null) {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        {showLabel && <span className="text-xs text-slate-500">Sem limite</span>}
        <span className="text-xs font-medium text-slate-700">{usado.toLocaleString('pt-BR')} usados</span>
      </div>
    )
  }

  const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0
  const cor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-accent'

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-600 font-medium">{usado} / {limite}</span>
          <span className="text-slate-400">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={clsx('h-full transition-all', cor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
