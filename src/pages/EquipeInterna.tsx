import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserCog, UserPlus, X, Shield, ShieldOff } from 'lucide-react'
import { Profile, InternalRole } from '@/types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { SupervisorPicker } from '@/components/workspace/SupervisorPicker'

const INTERNAL_ROLES: InternalRole[] = ['socio', 'advogado', 'assistente']

const roleLabels: Record<InternalRole, string> = {
  socio: 'Sócio',
  advogado: 'Advogado',
  assistente: 'Estagiário',
}

export default function EquipeInterna() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<{
    full_name: string
    email: string
    password: string
    role: InternalRole
    supervisor_id: string | null
  }>({ full_name: '', email: '', password: '', role: 'advogado', supervisor_id: null })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, supervisor:supervisor_id(id, full_name, role)')
      .in('role', INTERNAL_ROLES)
      .order('full_name')
    setUsers((data as Profile[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_active: !current }).eq('id', id)
    if (error) toast.error('Erro ao atualizar')
    else { toast.success(current ? 'Usuário desativado' : 'Usuário reativado'); load() }
  }

  const changeRole = async (u: Profile, newRole: InternalRole) => {
    if (newRole === 'assistente' && !u.supervisor_id) {
      toast.error('Estagiário precisa ter supervisor. Edite pelo modal.')
      return
    }
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
    if (error) toast.error('Erro ao atualizar perfil: ' + error.message)
    else { toast.success('Perfil atualizado'); load() }
  }

  const changeSupervisor = async (userId: string, supervisor_id: string | null) => {
    const { error } = await supabase.from('profiles').update({ supervisor_id }).eq('id', userId)
    if (error) toast.error('Erro ao atualizar supervisor: ' + error.message)
    else { toast.success('Supervisor atualizado'); load() }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.role === 'assistente' && !form.supervisor_id) {
      toast.error('Estagiário precisa ter supervisor definido')
      return
    }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          supervisor_id: form.supervisor_id,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        toast.error(result.error || 'Erro ao criar usuário')
      } else {
        toast.success('Usuário criado com sucesso!')
        setShowModal(false)
        setForm({ full_name: '', email: '', password: '', role: 'advogado', supervisor_id: null })
        load()
      }
    } catch {
      toast.error('Erro de conexão ao criar usuário')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Equipe Interna</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} usuário(s) internos — sócios, advogados e estagiários</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm">
          <UserPlus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" /></div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum usuário interno</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>{['Usuário', 'E-mail', 'Perfil', 'Supervisor', 'Status', 'Desde', 'Ações'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-sm font-semibold">{u.full_name.charAt(0)}</div>
                      <span className="text-sm font-medium text-navy-800">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <select value={u.role} onChange={e => changeRole(u, e.target.value as InternalRole)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand/30 text-slate-600 bg-white">
                      {INTERNAL_ROLES.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === 'assistente' ? (
                      <div className="min-w-[180px]">
                        <SupervisorPickerInline value={u.supervisor_id || null} onChange={v => changeSupervisor(u.id, v)} />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{format(new Date(u.created_at), 'dd/MM/yyyy')}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'}`}>
                      {u.is_active ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-navy-800 text-lg">Novo Usuário Interno</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              {[
                { key: 'full_name', label: 'Nome completo *', required: true, placeholder: 'Nome do usuário' },
                { key: 'email', label: 'E-mail *', required: true, type: 'email', placeholder: 'email@corplawadvogados.com.br' },
                { key: 'password', label: 'Senha inicial *', required: true, type: 'password', placeholder: 'Mínimo 6 caracteres' },
              ].map(({ key, label, required, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                  <input type={type || 'text'} required={required} placeholder={placeholder}
                    value={form[key as 'full_name' | 'email' | 'password']}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Perfil de Acesso *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as InternalRole, supervisor_id: null }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
                  {INTERNAL_ROLES.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                </select>
              </div>
              {form.role === 'assistente' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Supervisor * <span className="text-slate-400 text-xs font-normal">(estagiário precisa de um líder direto)</span></label>
                  <SupervisorPicker value={form.supervisor_id} onChange={id => setForm(f => ({ ...f, supervisor_id: id }))} required />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-light disabled:opacity-60">
                  {saving ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Variante inline compacta para a tabela
function SupervisorPickerInline({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return <SupervisorPicker value={value} onChange={onChange} className="text-xs py-1.5" />
}
