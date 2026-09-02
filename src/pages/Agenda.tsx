import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, X, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

interface AgendaEvent {
  id: string
  date: string // 'YYYY-MM-DD'
  title: string
  type: 'vencimento' | 'renovacao' | 'obrigacao' | 'marco'
  contractTitle: string
  contractId: string
  clientName?: string
  isResolved?: boolean
}

const TYPE_CONFIG = {
  vencimento: {
    label: 'Vencimento',
    dot: 'bg-red-500',
    chip: 'bg-red-50 text-red-700 border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  renovacao: {
    label: 'Renovação',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
  obrigacao: {
    label: 'Obrigação',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
  },
  marco: {
    label: 'Marco',
    dot: 'bg-purple-500',
    chip: 'bg-purple-50 text-purple-700 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
} as const

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Agenda() {
  const { profile, isAdmin } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    loadEvents()
  }, [profile?.id])

  async function loadEvents() {
    setLoading(true)
    try {
      let contractIds: string[] = []
      const contractMap = new Map<string, { title: string; clientName?: string }>()

      if (isAdmin) {
        const { data: allContracts } = await supabase
          .from('contracts')
          .select('id, title, clients(name)')
        for (const c of allContracts || []) {
          contractMap.set(c.id, { title: c.title, clientName: (c.clients as any)?.name })
        }
        contractIds = [...contractMap.keys()]
      } else {
        const { data: clientUsers } = await supabase
          .from('client_users')
          .select('client_id')
          .eq('profile_id', profile!.id)

        const clientIds = (clientUsers || []).map((cu: any) => cu.client_id)
        if (clientIds.length === 0) {
          setEvents([])
          setLoading(false)
          return
        }

        const { data: userContracts } = await supabase
          .from('contracts')
          .select('id, title, clients(name)')
          .in('client_id', clientIds)

        for (const c of userContracts || []) {
          contractMap.set(c.id, { title: c.title, clientName: (c.clients as any)?.name })
        }
        contractIds = [...contractMap.keys()]
      }

      if (contractIds.length === 0) {
        setEvents([])
        setLoading(false)
        return
      }

      const [alertsRes, milestonesRes, obligationsRes] = await Promise.all([
        supabase
          .from('contract_alerts')
          .select('id, alert_date, alert_type, message, is_sent, contract_id')
          .in('contract_id', contractIds),
        supabase
          .from('contract_milestones')
          .select('id, milestone_date, title, contract_id')
          .in('contract_id', contractIds),
        supabase
          .from('contract_obligations')
          .select('id, due_date, description, status, contract_id')
          .not('due_date', 'is', null)
          .in('contract_id', contractIds),
      ])

      const all: AgendaEvent[] = []

      for (const a of alertsRes.data || []) {
        const c = contractMap.get(a.contract_id)
        if (!c) continue
        const alertType = (a.alert_type in TYPE_CONFIG ? a.alert_type : 'vencimento') as AgendaEvent['type']
        all.push({
          id: `alert-${a.id}`,
          date: a.alert_date,
          title: a.message || TYPE_CONFIG[alertType].label,
          type: alertType,
          contractTitle: c.title,
          contractId: a.contract_id,
          clientName: c.clientName,
          isResolved: a.is_sent,
        })
      }

      for (const m of milestonesRes.data || []) {
        const c = contractMap.get(m.contract_id)
        if (!c) continue
        all.push({
          id: `milestone-${m.id}`,
          date: m.milestone_date,
          title: m.title,
          type: 'marco',
          contractTitle: c.title,
          contractId: m.contract_id,
          clientName: c.clientName,
        })
      }

      for (const o of obligationsRes.data || []) {
        if (!o.due_date) continue
        const c = contractMap.get(o.contract_id)
        if (!c) continue
        all.push({
          id: `obligation-${o.id}`,
          date: o.due_date,
          title: o.description,
          type: 'obrigacao',
          contractTitle: c.title,
          contractId: o.contract_id,
          clientName: c.clientName,
          isResolved: o.status === 'concluido',
        })
      }

      setEvents(all)
    } catch (err) {
      console.error('Agenda load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return map
  }, [events])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    return eventsByDate.get(format(selectedDay, 'yyyy-MM-dd')) || []
  }, [selectedDay, eventsByDate])

  const monthEvents = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    return events.filter(e => e.date.startsWith(monthStr))
  }, [events, currentMonth])

  const handleDayClick = (day: Date) => {
    setSelectedDay(prev => (prev && isSameDay(prev, day) ? null : day))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Agenda</h1>
          <p className="text-slate-500 text-sm mt-1">Prazos e eventos dos seus contratos</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Eventos no mês', value: monthEvents.length, color: 'bg-brand' },
            { label: 'Pendentes', value: monthEvents.filter(e => !e.isResolved).length, color: 'bg-amber-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`${color} text-white rounded-xl px-4 py-2.5 text-center min-w-[110px]`}>
              <p className="text-2xl font-bold leading-none">{value}</p>
              <p className="text-xs opacity-80 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 flex-wrap">
        {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, (typeof TYPE_CONFIG)[keyof typeof TYPE_CONFIG]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2 text-sm text-slate-600">
            <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', cfg.dot)} />
            {cfg.label}
          </div>
        ))}
      </div>

      <div className="flex gap-5 items-start">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-navy-800 capitalize text-lg">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hoje
              </button>
              <button
                onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Week headers */}
          <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-100">
            {WEEK_DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {calendarDays.map((day, idx) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayEvents = eventsByDate.get(key) || []
                const inMonth = isSameMonth(day, currentMonth)
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                const isCurrent = isToday(day)
                const types = [...new Set(dayEvents.map(e => e.type))]
                const pending = dayEvents.filter(e => !e.isResolved).length

                return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={clsx(
                      'relative min-h-[90px] p-2 text-left transition-colors focus:outline-none',
                      inMonth ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/60',
                      isSelected && 'ring-2 ring-inset ring-brand/40 bg-brand/5',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={clsx(
                        'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium',
                        isCurrent
                          ? 'bg-brand text-white font-bold'
                          : inMonth
                            ? isSelected ? 'text-brand font-semibold' : 'text-slate-700'
                            : 'text-slate-300',
                      )}>
                        {format(day, 'd')}
                      </span>
                      {pending > 0 && (
                        <span className="text-xs font-bold text-slate-400">{pending}</span>
                      )}
                    </div>

                    {types.length > 0 && (
                      <div className="flex gap-1 mb-1">
                        {types.slice(0, 4).map(t => (
                          <span key={t} className={clsx('w-2 h-2 rounded-full', TYPE_CONFIG[t].dot)} />
                        ))}
                      </div>
                    )}

                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map(e => (
                        <div
                          key={e.id}
                          className={clsx(
                            'text-xs px-1.5 py-0.5 rounded truncate border',
                            e.isResolved
                              ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                              : TYPE_CONFIG[e.type].chip,
                          )}
                        >
                          {e.contractTitle}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-xs text-slate-400 pl-1">+{dayEvents.length - 2}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Side panel */}
        {selectedDay && (
          <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden sticky top-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-semibold text-navy-800 capitalize leading-snug">
                  {format(selectedDay, "EEEE", { locale: ptBR })}
                </p>
                <p className="text-sm text-slate-500 capitalize">
                  {format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
                </p>
                {isToday(selectedDay) && (
                  <span className="text-xs text-brand font-semibold">Hoje</span>
                )}
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[520px]">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                  <Calendar className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Nenhum evento neste dia</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {selectedDayEvents.map(e => (
                    <div key={e.id} className={clsx('p-4', e.isResolved && 'opacity-55')}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', TYPE_CONFIG[e.type].badge)}>
                          {TYPE_CONFIG[e.type].label}
                        </span>
                        {e.isResolved && (
                          <span className="text-xs text-emerald-600 font-medium">✓ Resolvido</span>
                        )}
                      </div>
                      <Link
                        to={`/painel/contratos/${e.contractId}`}
                        className="text-sm font-semibold text-navy-800 hover:text-brand block leading-snug transition-colors"
                      >
                        {e.contractTitle}
                      </Link>
                      {e.clientName && (
                        <p className="text-xs text-slate-500 mt-0.5">{e.clientName}</p>
                      )}
                      {e.title && e.title !== e.contractTitle && (
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{e.title}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedDayEvents.filter(e => !e.isResolved).length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-amber-50/60">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {selectedDayEvents.filter(e => !e.isResolved).length} evento(s) pendente(s)
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}