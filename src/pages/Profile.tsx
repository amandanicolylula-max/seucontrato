import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { User, Lock, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Profile() {
  const { profile } = useAuth()
  const [name, setName] = useState(profile?.full_name || '')
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const roleLabel: Record<string, string> = {
    socio: 'Sócio',
    administrador: 'Administrador',
    advogado: 'Advogado',
    assistente: 'Assistente',
  }

  const handleSaveName = async () => {
    if (!name.trim()) { toast.error('Nome não pode estar vazio'); return }
    if (!profile?.id) return
    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile.id)
    if (error) toast.error('Erro ao atualizar nome')
    else toast.success('Nome atualizado com sucesso!')
    setSavingName(false)
  }

  const handleSavePassword = async () => {
    if (!newPassword) { toast.error('Digite a nova senha'); return }
    if (newPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error('Erro ao atualizar senha: ' + error.message)
    else {
      toast.success('Senha atualizada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl text-navy-900">Meu Perfil</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie suas informações pessoais e segurança</p>
      </div>

      {/* Informações Pessoais */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-brand" />
          </div>
          <h2 className="font-semibold text-navy-800">Informações Pessoais</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold">
            {name.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-medium text-navy-800">{profile?.full_name}</p>
            <p className="text-sm text-slate-500">{profile?.email}</p>
            <span className="inline-block mt-1 text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-medium">
              {roleLabel[profile?.role || ''] || profile?.role}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome completo</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="Seu nome completo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
            <input
              value={profile?.email || ''}
              disabled
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">O e-mail não pode ser alterado aqui.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cargo</label>
            <input
              value={roleLabel[profile?.role || ''] || profile?.role || ''}
              disabled
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">O cargo é gerenciado pelo administrador.</p>
          </div>
          <button
            onClick={handleSaveName}
            disabled={savingName}
            className="flex items-center gap-2 bg-brand hover:bg-brand-light text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar nome
          </button>
        </div>
      </div>

      {/* Segurança */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="font-semibold text-navy-800">Segurança</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="Repita a nova senha"
            />
          </div>
          <button
            onClick={handleSavePassword}
            disabled={savingPassword}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Atualizar senha
          </button>
        </div>
      </div>
    </div>
  )
}
