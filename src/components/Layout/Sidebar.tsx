import { NavLink, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Briefcase, Bell, ClipboardList, UserCog, LogOut, Scale, FileScan, ShieldAlert, CalendarDays, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  open: boolean
  onClose: () => void
  onOpen: () => void
}

const navItems = [
  { to: '/painel', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/painel/contratos', icon: FileText, label: 'Contratos' },
  { to: '/painel/clientes', icon: Briefcase, label: 'Clientes' },
  { to: '/painel/oportunidades', icon: Scale, label: 'Oportunidades' },
  { to: '/painel/alertas', icon: Bell, label: 'Alertas' },
  { to: '/painel/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/painel/auditoria', icon: ClipboardList, label: 'Auditoria' },
]

const analysisItems = [
  { to: '/painel/analise', icon: FileScan, label: 'Análise Contratual' },
  { to: '/painel/banco-de-problemas', icon: ShieldAlert, label: 'Banco de Problemas' },
]

const adminItems = [
  { to: '/painel/usuarios', icon: UserCog, label: 'Usuários' },
]

function SideNavItem({ to, icon: Icon, label, onClick }: { to: string; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <NavLink key={to} to={to} onClick={onClick}>
      {({ isActive }) => (
        <div className={clsx(
          'flex items-center gap-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-accent/10 text-white border-l-[3px] border-accent pl-2.5 pr-3'
            : 'text-white/60 hover:bg-white/10 hover:text-white px-3'
        )}>
          <Icon className={clsx('w-4 h-4 flex-shrink-0', isActive && 'text-accent')} />
          {label}
        </div>
      )}
    </NavLink>
  )
}

export function Sidebar({ open, onClose, onOpen }: SidebarProps) {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    navigate('/login', { replace: true })
    await signOut()
  }

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 w-64 bg-brand flex flex-col z-30 shadow-xl',
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
        {navItems.map(item => (
          <SideNavItem key={item.to} {...item} onClick={onClose} />
        ))}

        <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-2 mt-6">Parecer & Diagnóstico</p>
        {analysisItems.map(item => (
          <SideNavItem key={item.to} {...item} onClick={onClose} />
        ))}

        {isAdmin && (
          <>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-2 mt-6">Administração</p>
            {adminItems.map(item => (
              <SideNavItem key={item.to} {...item} onClick={onClose} />
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <Link
          to="/painel/perfil"
          onClick={onClose}
          className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-white/10 rounded-xl transition-all px-2 py-1.5"
        >
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold">
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
