import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CreditBalance, CreditTransaction } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { CreditBalanceCard } from '@/components/workspace/CreditBalanceCard'
import { tipoTransacao, formatCreditos } from '@/lib/credits'
import { ShoppingCart } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const PACOTES = [
  { label: 'Starter',    creditos: 100,  preco: 49 },
  { label: 'Business',   creditos: 500,  preco: 199 },
  { label: 'Enterprise', creditos: 1000, preco: 349 },
]

export default function CreditosCliente() {
  const { profile } = useAuth()
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.workspace_id) return
    Promise.all([
      supabase.from('credit_balances').select('*').eq('workspace_id', profile.workspace_id).maybeSingle(),
      supabase.from('credit_transactions').select('*, profiles(full_name)').eq('workspace_id', profile.workspace_id).order('created_at', { ascending: false }).limit(100),
    ]).then(([{ data: bal }, { data: tx }]) => {
      setBalance(bal as CreditBalance | null)
      setTransactions((tx as CreditTransaction[]) || [])
      setLoading(false)
    })
  }, [profile?.workspace_id])

  const handleBuy = () => {
    toast('Compra de créditos em breve. Entre em contato com o CorpLaw para adquirir agora.', { icon: '💳', duration: 5000 })
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Créditos</h1>
        <p className="text-slate-500 text-sm mt-1">Saldo, histórico e compra de créditos avulsos.</p>
      </div>

      <CreditBalanceCard balance={balance} />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingCart className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-navy-800">Comprar créditos avulsos</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">Créditos avulsos não expiram e são consumidos após os créditos mensais.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PACOTES.map(p => (
            <div key={p.label} className="border border-slate-200 rounded-xl p-5 hover:border-accent transition-colors">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{p.label}</p>
              <p className="text-3xl font-bold text-navy-900 mt-2">{p.creditos}</p>
              <p className="text-xs text-slate-500 mt-1">créditos</p>
              <p className="text-lg font-semibold text-accent mt-3">R$ {p.preco},00</p>
              <button onClick={handleBuy} className="w-full mt-4 bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors">
                Comprar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-navy-800">Histórico de transações</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm">Nenhuma transação ainda</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantidade</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Autor</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map(t => {
                const tp = tipoTransacao(t.tipo)
                return (
                  <tr key={t.id}>
                    <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                    <td className="px-6 py-3"><span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium', tp.cor)}>{tp.label}</span></td>
                    <td className={clsx('px-6 py-3 text-sm font-semibold', t.quantidade > 0 ? 'text-emerald-600' : 'text-slate-700')}>{formatCreditos(t.quantidade)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{t.profiles?.full_name || 'Sistema'}</td>
                    <td className="px-6 py-3 text-sm text-slate-500">{t.descricao || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
