import { CreditBalance } from '@/types'
import { totalDisponivel, totalMensalDisponivel, proximaExpiracao } from '@/lib/credits'
import { CreditCard, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  balance: CreditBalance | null | undefined
  variant?: 'default' | 'compact'
  className?: string
}

export function CreditBalanceCard({ balance, variant = 'default', className = '' }: Props) {
  const total = totalDisponivel(balance)
  const mensal = totalMensalDisponivel(balance)
  const avulso = balance?.saldo_avulso ?? 0
  const proxExp = proximaExpiracao(balance)

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg ${className}`}>
        <Zap className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-accent">{total.toLocaleString('pt-BR')} créditos</span>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-br from-accent to-accent-dark text-white rounded-2xl p-6 shadow-md ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
          <CreditCard className="w-5 h-5" />
        </div>
        <p className="text-xs uppercase tracking-wider opacity-70">Saldo Total</p>
      </div>
      <p className="text-4xl font-bold tracking-tight">{total.toLocaleString('pt-BR')}</p>
      <p className="text-sm opacity-75 mt-1">créditos disponíveis</p>

      <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-white/20">
        <div>
          <p className="text-xs opacity-60 uppercase tracking-wider">Mensais</p>
          <p className="text-lg font-semibold">{mensal.toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-xs opacity-60 uppercase tracking-wider">Avulsos</p>
          <p className="text-lg font-semibold">{avulso.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {proxExp && (
        <p className="text-xs opacity-60 mt-4">
          Próxima expiração: {format(proxExp, "dd 'de' MMMM", { locale: ptBR })}
        </p>
      )}
    </div>
  )
}
