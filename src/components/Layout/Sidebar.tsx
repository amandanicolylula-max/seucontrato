import { NavLink, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Users as UsersIcon, Briefcase, Bell, ClipboardList, UserCog, LogOut, Scale, FileScan, ShieldAlert, CalendarDays, Building2, DollarSign, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  open: boolean
  onClose: () => void
  onOpen: () => void
}

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
  show?: boolean
}

function SideNavItem({ to, icon: Icon, label, end, onClick }: NavItem & { onClick: () => void }) {
  return (
    <NavLink to={to} end={end} onClick={onClick}>
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

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    navigate('/login', { replace: true })
    await signOut()
  }

  const sections: NavSection[] = [
    {
      label: 'Principal',
      items: [
        { to: '/painel', icon: LayoutDashboard, label: 'Dashboard', end: true },
      ],
    },
    {
      label: 'Operação',
      items: [
        { to: '/painel/contratos', icon: FileText, label: 'Contratos' },
        { to: '/painel/clientes', icon: Briefcase, label: 'Clientes (registros)' },
        { to: '/painel/analise', icon: FileScan, label: 'Análises' },
        { to: '/painel/analise-corplaw', icon: FileScan, label: 'Análise Corplaw [BETA]' },
        { to: '/painel/analise-hibrida', icon: FileScan, label: 'Análise Híbrida [BETA]' },
        { to: '/painel/banco-de-problemas', icon: ShieldAlert, label: 'Banco de Problemas' },
        { to: '/painel/oportunidades', icon: Scale, label: 'Oportunidades' },
        { to: '/painel/alertas', icon: Bell, label: 'Alertas' },
        { to: '/painel/agenda', icon: CalendarDays, label: 'Agenda' },
      ],
    },
    {
      label: 'Administração',
      items: [
        ...(isAdmin ? [{ to: '/painel/equipe-interna', icon: UserCog, label: 'Equipe Interna' }] : []),
        { to: '/painel/clientes-plataforma', icon: Building2, label: 'Clientes da Plataforma' },
      ],
    },
    {
      label: 'Sistema',
      show: isAdmin,
      items: [
        { to: '/painel/auditoria', icon: ClipboardList, label: 'Auditoria' },
      ],
    },
  ]

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 w-64 bg-brand flex flex-col z-30 shadow-xl',
        'transform transition-transform duration-300 md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-display text-white text-lg leading-none font-bold">Seu Contrato</p>
            <p className="text-accent/70 text-[10px] mt-0.5 tracking-wide">Painel CorpLaw</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        {sections.filter(s => s.show !== false && s.items.length > 0).map(section => (
          <div key={section.label} className="mb-4">
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-2">{section.label}</p>
            {section.items.map(item => <SideNavItem key={item.to} {...item} onClick={onClose} />)}
          </div>
        ))}
      </nav>

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
            <p className="text-white/40 text-xs truncate capitalize">
              {profile?.role === 'socio' ? 'Sócio' : profile?.role === 'advogado' ? 'Advogado' : profile?.role === 'assistente' ? 'Estagiário' : profile?.role}
            </p>
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
