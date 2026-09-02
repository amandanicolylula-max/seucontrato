import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Briefcase, X, Trash2, Pencil, FileText, Users, ChevronDown } from 'lucide-react'
import { Client, Profile } from '@/types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Multi-select de responsáveis ────────────────────────────────────────────

function UserMultiSelect({
  profiles,
  selected,
  onChange,
}: {
  profiles: Profile[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const selectedNames = profiles
    .filter(p => selected.includes(p.id))
    .map(p => p.full_name.split(' ')[0])
    .join(', ')

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white text-left"
      >
        <span className={selected.length === 0 ? 'text-slate-400' : 'text-slate-700'}>
          {selected.length === 0 ? 'Selecione os responsáveis…' : selectedNames}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {profiles.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">Nenhum usuário ativo</p>
          ) : (
            profiles.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="accent-brand"
                />
                <span className="text-sm text-slate-700">{p.full_name}</span>
                <span className="text-xs text-slate-400 ml-auto">{p.role}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [filtered, setFiltered] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', address: '', notes: '' })
  const [responsibleIds, setResponsibleIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: clientsData }, { data: profilesData }] = await Promise.all([
      supabase
        .from('clients')
        .select('*, client_users(profile_id, profiles(id, full_name, role, email, is_active, avatar_url, created_at, updated_at))')
        .order('name'),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
    ])

    // Normaliza os dados: converte client_users para responsible_users
    const normalized = (clientsData || []).map(c => ({
      ...c,
      responsible_users: (c.client_users || [])
        .map((cu: { profiles: Profile | null }) => cu.profiles)
        .filter(Boolean) as Profile[],
    }))

    setClients(normalized)
    setFiltered(normalized)
    setProfiles(profilesData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!search) { setFiltered(clients); return }
    setFiltered(clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    ))
  }, [search, clients])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      let clientId = editingClient?.id

      if (editingClient) {
        const { error } = await supabase.from('clients').update(form).eq('id', editingClient.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('clients').insert(form).select('id').single()
        if (error) throw error
        clientId = data.id
      }

      // Sincroniza responsáveis: delete + insert para garantir estado correto
      await supabase.from('client_users').delete().eq('client_id', clientId!)
      if (responsibleIds.length > 0) {
        const { error: insertError } = await supabase.from('client_users').insert(
          responsibleIds.map(profile_id => ({ client_id: clientId!, profile_id }))
        )
        if (insertError) throw insertError
      }

      toast.success(editingClient ? 'Cliente atualizado!' : 'Cliente cadastrado!')
      closeModal()
      load()
    } catch {
      toast.error('Erro ao salvar cliente')
    } finally {
      setSaving(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingClient(null)
    setForm({ name: '', document: '', email: '', phone: '', address: '', notes: '' })
    setResponsibleIds([])
  }

  const openEdit = (c: Client) => {
    setEditingClient(c)
    setForm({ name: c.name, document: c.document || '', email: c.email || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' })
    setResponsibleIds((c.responsible_users || []).map(u => u.id))
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir cliente')
    else { toast.success('Cliente excluído!'); load() }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">{clients.length} cliente(s) cadastrado(s)</p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setForm({ name: '', document: '', email: '', phone: '', address: '', notes: '' }); setResponsibleIds([]); setShowModal(true) }}
          className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar clientes..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                {['Nome', 'Documento', 'E-mail', 'Telefone', 'Responsáveis', 'Cadastrado em', 'Contratos', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-navy-800">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.document || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{c.phone || '—'}</td>
                  <td className="px-6 py-4">
                    {c.responsible_users && c.responsible_users.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.responsible_users.map(u => (
                          <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
                            <Users className="w-3 h-3" />
                            {u.full_name.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{format(new Date(c.created_at), 'dd/MM/yyyy')}</td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/painel/contratos?cliente=${encodeURIComponent(c.name)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-dark transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" /> Ver contratos
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-brand transition-colors p-1" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-navy-800 text-lg">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {[
                { key: 'name', label: 'Nome *', required: true, placeholder: 'Nome completo ou razão social' },
                { key: 'document', label: 'CPF / CNPJ', placeholder: '000.000.000-00' },
                { key: 'email', label: 'E-mail', type: 'email', placeholder: 'email@exemplo.com' },
                { key: 'phone', label: 'Telefone', placeholder: '(84) 99999-9999' },
                { key: 'address', label: 'Endereço', placeholder: 'Rua, número, cidade' },
              ].map(({ key, label, required, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                  <input
                    type={type || 'text'}
                    required={required}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Responsáveis</label>
                <UserMultiSelect
                  profiles={profiles}
                  selected={responsibleIds}
                  onChange={setResponsibleIds}
                />
                <p className="mt-1.5 text-xs text-slate-400">Esses usuários receberão os alertas deste cliente por e-mail.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações</label>
                <textarea
                  rows={3}
                  placeholder="Informações adicionais sobre o cliente..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-light disabled:opacity-60">
                  {saving ? 'Salvando...' : editingClient ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
