import { NavLink, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, FileScan, Users, UserCircle, LogOut, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'

interface ClientSidebarProps {
  open: boolean
  onClose: () => void
}

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Início', end: true },
  { to: '/app/contratos', icon: FileText, label: 'Meus Contratos' },
  { to: '/app/analises', icon: FileScan, label: 'Análises' },
  { to: '/app/equipe', icon: Users, label: 'Equipe' },
]

function SideNavItem({ to, icon: Icon, label, end, onClick }: { to: string; icon: LucideIcon; label: string; end?: boolean; onClick: () => void }) {
  return (
    <NavLink to={to} end={end} onClick={onClick}>
      {({ isActive }) => (
        <div className={clsx(
          'flex items-center gap-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-accent/10 text-accent border-l-[3px] border-accent pl-2.5 pr-3'
            : 'text-slate-600 hover:bg-slate-100 hover:text-navy-800 px-3'
        )}>
          <Icon className={clsx('w-4 h-4 flex-shrink-0', isActive && 'text-accent')} />
          {label}
        </div>
      )}
    </NavLink>
  )
}

export function ClientSidebar({ open, onClose }: ClientSidebarProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    navigate('/login', { replace: true })
    await signOut()
  }

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col z-30',
        'transform transition-transform duration-300 md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent/10 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-display text-navy-800 text-lg leading-none font-bold">Seu Contrato</p>
            <p className="text-slate-400 text-[10px] mt-0.5 tracking-wide">by CorpLaw Advogados</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Menu</p>
        {navItems.map(item => (
          <SideNavItem key={item.to} {...item} onClick={onClose} />
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-100">
        <Link
          to="/app/perfil"
          onClick={onClose}
          className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-slate-50 rounded-xl transition-all px-2 py-1.5"
        >
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-semibold">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-navy-800 text-sm font-medium truncate">{profile?.full_name}</p>
            <p className="text-slate-400 text-xs truncate">Empresário</p>
          </div>
        </Link>
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 text-sm transition-all">
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
