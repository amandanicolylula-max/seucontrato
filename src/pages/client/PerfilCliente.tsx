import { useAuth } from '@/hooks/useAuth'
import { Building2, Mail, User } from 'lucide-react'

export default function PerfilCliente() {
  const { profile } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-navy-900">Meu Perfil</h1>
        <p className="text-slate-500 text-sm mt-1">Seus dados e informações do workspace.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-navy-800 mb-4">Dados Pessoais</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Nome</p>
                <p className="text-sm text-navy-800 font-medium">{profile?.full_name || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">E-mail</p>
                <p className="text-sm text-navy-800">{profile?.email || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-navy-800 mb-4">Workspace</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Empresa</p>
                <p className="text-sm text-slate-500 italic">Será configurado em breve</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
