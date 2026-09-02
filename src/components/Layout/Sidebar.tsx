import { NavLink, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Briefcase, Bell, ClipboardList, UserCog, LogOut, Scale, FileScan, ShieldAlert, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  open: boolean
  onClose: () => void
  onOpen: () => void
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contratos', icon: FileText, label: 'Contratos' },
  { to: '/clientes', icon: Briefcase, label: 'Clientes' },
  { to: '/oportunidades', icon: Scale, label: 'Oportunidades' },
  { to: '/alertas', icon: Bell, label: 'Alertas' },
  { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/auditoria', icon: ClipboardList, label: 'Auditoria' },
]

const analysisItems = [
  { to: '/analise', icon: FileScan, label: 'Análise Contratual' },
  { to: '/banco-de-problemas', icon: ShieldAlert, label: 'Banco de Problemas' },
]

const adminItems = [
  { to: '/usuarios', icon: UserCog, label: 'Usuários' },
]

export function Sidebar({ open, onClose, onOpen }: SidebarProps) {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    // Navega ANTES do signOut terminar para evitar flash de tela protegida.
    // O onAuthStateChange vai disparar SIGNED_OUT e limpar o estado.
    navigate('/login', { replace: true })
    await signOut()
  }

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 w-64 bg-brand flex flex-col z-30 shadow-xl',
        // Mobile: desliza para dentro/fora com transform
        'transform transition-transform duration-300 md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-display text-white text-lg leading-none font-bold">Seu Contrato</p>
            <p className="text-accent/70 text-xs mt-0.5">Gestão Contratual</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Menu</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150',
              isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}

        <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-2 mt-6">Parecer & Diagnóstico</p>
        {analysisItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150',
              isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-2 mt-6">Administração</p>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={onClose}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150',
                  isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                )}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <Link
          to="/perfil"
          onClick={onClose}
          className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-white/10 rounded-xl transition-all px-2 py-1.5"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-semibold">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile?.full_name}</p>
            <p className="text-white/40 text-xs truncate capitalize">{profile?.role}</p>
          </div>
        </Link>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-sm transition-all">
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
