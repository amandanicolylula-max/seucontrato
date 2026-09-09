import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plan, Workspace } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { PlanBadge } from '@/components/workspace/PlanBadge'
import { Check, Zap } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function PlanoCliente() {
  const { profile } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    if (!profile?.workspace_id) return
    Promise.all([
      supabase.from('workspaces').select('*, plans(*)').eq('id', profile.workspace_id).single(),
      supabase.from('plans').select('*').order('preco_mensal'),
    ]).then(([{ data: ws }, { data: pl }]) => {
      setWorkspace(ws as Workspace | null)
      setPlans((pl as Plan[]) || [])
      setLoading(false)
    })
  }, [profile?.workspace_id])

  const handleChangePlan = async (newPlanTipo: string) => {
    if (!confirm(`Confirmar mudança para o plano ${newPlanTipo === 'individual' ? 'Individual' : 'Enterprise'}?`)) return
    setChanging(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ workspace_id: workspace?.id, new_plan_tipo: newPlanTipo })
    })
    setChanging(false)
    if (r.ok) {
      toast.success('Plano alterado com sucesso!')
      window.location.reload()
    } else {
      const err = await r.json()
      toast.error(err.error || 'Erro ao alterar plano')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>

  const currentPlan = workspace?.plans

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Plano</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie a assinatura da sua conta.</p>
      </div>

      {currentPlan && (
        <div className="bg-gradient-to-br from-navy-900 to-navy-800 text-white rounded-2xl p-8 shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs uppercase tracking-wider opacity-70">Seu plano atual</p>
            <PlanBadge tipo={currentPlan.tipo} className="bg-white/15 text-white border-white/20" />
          </div>
          <h2 className="text-3xl font-bold mb-1">{currentPlan.nome}</h2>
          <p className="text-4xl font-bold text-accent mt-4">R$ {currentPlan.preco_mensal.toFixed(2).replace('.', ',')}<span className="text-lg text-white/60 font-normal">/mês</span></p>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-accent" /> {currentPlan.limite_colaboradores} colaborador{currentPlan.limite_colaboradores > 1 ? 'es' : ''}</div>
            <div className="flex items-center gap-2 text-sm"><Zap className="w-4 h-4 text-accent" /> {currentPlan.creditos_mensais} créditos/mês</div>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-navy-800 mb-4">Alterar plano</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map(p => {
            const isCurrent = p.id === currentPlan?.id
            return (
              <div key={p.id} className={clsx(
                'bg-white rounded-2xl p-6 border-2 transition-all',
                isCurrent ? 'border-accent shadow-md' : 'border-slate-100 hover:border-slate-200'
              )}>
                <div className="flex items-center justify-between mb-3">
                  <PlanBadge tipo={p.tipo} />
                  {isCurrent && <span className="text-xs text-accent font-semibold">Plano atual</span>}
                </div>
                <h3 className="text-xl font-bold text-navy-900">{p.nome}</h3>
                <p className="text-3xl font-bold text-navy-800 mt-3">R$ {p.preco_mensal.toFixed(2).replace('.', ',')}<span className="text-sm text-slate-400 font-normal">/mês</span></p>
                <ul className="space-y-2 mt-5 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> {p.limite_colaboradores} colaborador{p.limite_colaboradores > 1 ? 'es' : ''}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> {p.creditos_mensais} créditos mensais</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" /> Créditos acumulam até 3 meses</li>
                </ul>
                {!isCurrent && (
                  <button
                    onClick={() => handleChangePlan(p.tipo)}
                    disabled={changing}
                    className="mt-5 w-full bg-accent text-white py-2.5 rounded-xl text-sm font-medium hover:bg-accent-dark transition-all disabled:opacity-60"
                  >
                    {changing ? 'Alterando...' : (currentPlan && p.preco_mensal > currentPlan.preco_mensal ? 'Fazer upgrade' : 'Fazer downgrade')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
