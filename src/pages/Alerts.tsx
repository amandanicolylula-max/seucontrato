import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Bell, Clock, CheckCircle2, Mail } from 'lucide-react'
import { ContractAlert } from '@/types'
import { format, isAfter, isBefore, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'

type StatusFilter = 'todos' | 'pendentes' | 'proximos' | 'resolvidos'
type TypeFilter = 'todos' | 'vencimento' | 'renovacao' | 'obrigacao'
type DeadlineFilter = 'todos' | 'vencido' | '7dias' | '15dias' | '30dias'

// Map urgency diff to a left-border colour class (for unresolved alerts)
const urgencyBorderColor = (diff: number): string => {
  if (diff < 0) return 'border-l-red-500'
  if (diff <= 7) return 'border-l-red-500'
  if (diff <= 30) return 'border-l-amber-400'
  return 'border-l-slate-300'
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<ContractAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pendentes')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos')
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('todos')

  useEffect(() => {
    supabase
      .from('contract_alerts')
      .select('*, contracts(title, client_id, clients(name, email)), contract_milestones(title)')
      .order('alert_date')
      .then(({ data }) => { setAlerts(data || []); setLoading(false) })
  }, [])

  const today = new Date()
  const in30 = addDays(today, 30)

  const filtered = alerts.filter(a => {
    const d = new Date(a.alert_date)

    // Status filter
    if (filter === 'pendentes' && a.is_sent) return false
    if (filter === 'proximos' && (a.is_sent || !isAfter(d, today) || !isBefore(d, in30))) return false
    if (filter === 'resolvidos' && !a.is_sent) return false

    // Type filter
    if (typeFilter !== 'todos' && a.alert_type !== typeFilter) return false

    // Deadline filter
    if (deadlineFilter !== 'todos') {
      const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (deadlineFilter === 'vencido' && diff >= 0) return false
      if (deadlineFilter === '7dias' && (diff < 0 || diff > 7)) return false
      if (deadlineFilter === '15dias' && (diff < 0 || diff > 15)) return false
      if (deadlineFilter === '30dias' && (diff < 0 || diff > 30)) return false
    }

    return true
  })

  const urgency = (date: string) => {
    const d = new Date(date)
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { color: 'border-red-200 bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Vencido', diff }
    if (diff <= 7) return { color: 'border-red-200 bg-red-50', badge: 'bg-red-100 text-red-700', label: `${diff}d`, diff }
    if (diff <= 30) return { color: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100 text-amber-700', label: `${diff}d`, diff }
    return { color: 'border-slate-200 bg-white', badge: 'bg-slate-100 text-slate-600', label: `${diff}d`, diff }
  }

  const typeLabel: Record<string, string> = {
    vencimento: 'Vencimento',
    renovacao: 'Renovação',
    obrigacao: 'Obrigação',
  }

  const handleMarkResolved = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_sent: true } : a))
    await supabase.from('contract_alerts').update({ is_sent: true }).eq('id', id)
  }

  const handleUndoResolved = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_sent: false } : a))
    await supabase.from('contract_alerts').update({ is_sent: false }).eq('id', id)
  }

  const buildGmailUrl = (alert: ContractAlert): string => {
    const contracts = alert.contracts as (typeof alert.contracts & { clients?: { name?: string; email?: string } }) | undefined
    const clientName = contracts?.clients?.name ?? 'Cliente'
    const clientEmail = contracts?.clients?.email ?? ''
    const contractTitle = contracts?.title ?? 'contrato'
    const alertDate = format(new Date(alert.alert_date + 'T12:00:00'), 'dd/MM/yyyy')
    const alertTypeMap: Record<string, string> = {
      vencimento: 'Vencimento do Contrato',
      renovacao: 'Renovação Contratual',
      obrigacao: 'Obrigação Contratual',
    }
    const tipoEvento = alertTypeMap[alert.alert_type] || 'Prazo Contratual'
    const antecedencia = alert.days_before ? `\n▸ Aviso com: ${alert.days_before} dias de antecedência` : ''
    const marco = alert.contract_milestones?.title ? `\n▸ Marco contratual: ${alert.contract_milestones.title}` : ''
    const subject = `Braga e Dantas | Aviso de Prazo — ${contractTitle}`
    const body = `Prezado(a) ${clientName},

Espero que esteja bem. Entramos em contato para informar sobre um prazo contratual que requer sua atenção.

▸ Contrato: ${contractTitle}
▸ Tipo de prazo: ${tipoEvento}${marco}
▸ Data do vencimento: ${alertDate}${antecedencia}

Solicitamos, respeitosamente, que V.Sa. tome as providências necessárias antes da data indicada, a fim de evitar eventuais consequências contratuais.

Caso tenha dúvidas ou necessite de orientação jurídica, nossa equipe está à disposição.

Atenciosamente,
Braga e Dantas Advogados`
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Alertas</h1>
        <p className="text-slate-500 text-sm mt-1">Prazos e vencimentos monitorados automaticamente</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de Alertas', value: alerts.length, color: 'bg-brand' },
          {
            label: 'Próximos 30 dias',
            value: alerts.filter(a => {
              const d = new Date(a.alert_date)
              return !a.is_sent && isAfter(d, today) && isBefore(d, in30)
            }).length,
            color: 'bg-amber-500',
          },
          {
            label: 'Vencidos',
            value: alerts.filter(a => isBefore(new Date(a.alert_date), today) && !a.is_sent).length,
            color: 'bg-red-500',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${color} text-white rounded-2xl p-5 shadow-sm`}>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm opacity-80 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Status filter row */}
      <div className="flex gap-2 flex-wrap">
        {([['todos', 'Todos'], ['pendentes', 'Pendentes'], ['proximos', 'Próximos 30 dias'], ['resolvidos', 'Resolvidos']] as [StatusFilter, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              filter === v ? 'bg-brand text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand/40',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Type filter row */}
      <div className="flex gap-2 flex-wrap">
        {([['todos', 'Todos'], ['vencimento', 'Vencimento'], ['renovacao', 'Renovação'], ['obrigacao', 'Obrigação']] as [TypeFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition-all',
              typeFilter === v ? 'bg-slate-700 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400')}>
            {l}
          </button>
        ))}
      </div>

      {/* Deadline filter row */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Prazo:</span>
        {([['todos', 'Todos'], ['vencido', 'Vencido'], ['7dias', 'Até 7 dias'], ['15dias', 'Até 15 dias'], ['30dias', 'Até 30 dias']] as [DeadlineFilter, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setDeadlineFilter(v)}
            className={clsx('px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
              deadlineFilter === v
                ? v === 'vencido' ? 'bg-red-500 text-white border-red-500'
                  : v === '7dias' ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nenhum alerta encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => {
            const u = urgency(alert.alert_date)
            const borderColor = alert.is_sent ? '' : urgencyBorderColor(u.diff)
            return (
              <div
                key={alert.id}
                className={clsx(
                  'rounded-2xl border border-l-4 p-5 flex items-center gap-4 transition-all',
                  u.color,
                  alert.is_sent ? 'opacity-60' : borderColor,
                )}
              >
                <div
                  className={clsx(
                    'flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center',
                    u.badge.split(' ')[0],
                  )}
                >
                  <span className={clsx('text-xs font-bold', u.badge.split(' ')[1])}>{u.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      {typeLabel[alert.alert_type] || alert.alert_type}
                    </span>
                    {alert.contract_milestones?.title && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                        {alert.contract_milestones.title}
                      </span>
                    )}
                    {alert.is_sent && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> Resolvido
                      </span>
                    )}
                  </div>
                  {alert.contracts && (
                    <Link
                      to={`/contratos/${alert.contract_id}`}
                      className="text-sm font-semibold text-navy-800 hover:text-brand block mt-0.5 truncate"
                    >
                      {(alert.contracts as { title: string }).title}
                    </Link>
                  )}
                  {alert.message && <p className="text-sm text-slate-600 mt-0.5">{alert.message}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-700">
                    {format(new Date(alert.alert_date + 'T12:00:00'), 'd MMM yyyy', { locale: ptBR })}
                  </p>
                  {alert.days_before && (
                    <p className="text-xs text-slate-400">{alert.days_before} dias antes</p>
                  )}
                  <div className="flex items-center gap-2">
                    {!alert.is_sent && u.diff >= 0 && u.diff <= 7 && (
                      <a
                        href={buildGmailUrl(alert)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Redigir email para o cliente"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-200"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                    {!alert.is_sent ? (
                      <button
                        onClick={() => handleMarkResolved(alert.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Marcar como resolvido
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUndoResolved(alert.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        Desfazer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
