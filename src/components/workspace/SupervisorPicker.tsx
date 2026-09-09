import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

interface Props {
  value: string | null
  onChange: (id: string | null) => void
  required?: boolean
  disabled?: boolean
  className?: string
}

export function SupervisorPicker({ value, onChange, required, disabled, className = '' }: Props) {
  const [supervisors, setSupervisors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['socio', 'advogado'])
        .eq('is_active', true)
        .order('full_name')
      if (!cancelled) {
        setSupervisors((data as Profile[]) || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      required={required}
      disabled={disabled || loading}
      className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white ${className}`}
    >
      <option value="">
        {loading ? 'Carregando supervisores...' : 'Selecione um supervisor'}
      </option>
      {supervisors.map(s => (
        <option key={s.id} value={s.id}>
          {s.full_name} ({s.role === 'socio' ? 'Sócio' : 'Advogado'})
        </option>
      ))}
    </select>
  )
}
