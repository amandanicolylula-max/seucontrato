import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/Layout/AppLayout'
import { ClientLayout } from '@/components/Layout/ClientLayout'
import { InternalGuard } from '@/guards/InternalGuard'
import { ClientGuard } from '@/guards/ClientGuard'
import { RoleRedirect } from '@/guards/RoleRedirect'
import Login from '@/pages/Login'
import CadastroCliente from '@/pages/CadastroCliente'
import Dashboard from '@/pages/Dashboard'
import Contracts from '@/pages/Contracts'
import ContractUpload from '@/pages/ContractUpload'
import ContractDetail from '@/pages/ContractDetail'
import Clients from '@/pages/Clients'
import Opportunities from '@/pages/Opportunities'
import Alerts from '@/pages/Alerts'
import AuditLog from '@/pages/AuditLog'
import Users from '@/pages/Users'
import Profile from '@/pages/Profile'
import ContractAnalysisList from '@/pages/ContractAnalysisList'
import ContractAnalysisNew from '@/pages/ContractAnalysisNew'
import ContractAnalysisDetail from '@/pages/ContractAnalysisDetail'
import BancoProblemas from '@/pages/BancoProblemas'
import Agenda from '@/pages/Agenda'
import ClientHome from '@/pages/client/ClientHome'
import MeusContratos from '@/pages/client/MeusContratos'
import MinhasAnalises from '@/pages/client/MinhasAnalises'
import PerfilCliente from '@/pages/client/PerfilCliente'
import EquipeCliente from '@/pages/client/EquipeCliente'
import { Toaster } from 'react-hot-toast'

function Spinner() {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      {elapsed >= 4 && elapsed < 10 && (
        <p className="text-sm text-slate-400 animate-pulse">Carregando...</p>
      )}
      {elapsed >= 10 && (
        <div className="text-center space-y-2">
          <p className="text-sm text-slate-500">Isso está demorando mais que o esperado.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-brand underline underline-offset-2 hover:text-brand-light"
          >
            Clique aqui para recarregar
          </button>
        </div>
      )}
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/painel" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <Login />
}

function CadastroRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <CadastroCliente />
}

function AppRoutes() {
  const { loading } = useAuth()
  if (loading) return <Spinner />
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/cadastro" element={<CadastroRoute />} />
      <Route path="/" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

      {/* Corpo jurídico (interno) */}
      <Route element={<ProtectedRoute><InternalGuard><AppLayout /></InternalGuard></ProtectedRoute>}>
        <Route path="/painel" element={<Dashboard />} />
        <Route path="/painel/contratos" element={<Contracts />} />
        <Route path="/painel/contratos/novo" element={<ContractUpload />} />
        <Route path="/painel/contratos/:id" element={<ContractDetail />} />
        <Route path="/painel/clientes" element={<Clients />} />
        <Route path="/painel/oportunidades" element={<Opportunities />} />
        <Route path="/painel/alertas" element={<Alerts />} />
        <Route path="/painel/agenda" element={<Agenda />} />
        <Route path="/painel/auditoria" element={<AuditLog />} />
        <Route path="/painel/perfil" element={<Profile />} />
        <Route path="/painel/analise" element={<ContractAnalysisList />} />
        <Route path="/painel/analise/nova" element={<ContractAnalysisNew />} />
        <Route path="/painel/analise/:id" element={<ContractAnalysisDetail />} />
        <Route path="/painel/banco-de-problemas" element={<BancoProblemas />} />
        <Route path="/painel/usuarios" element={<AdminRoute><Users /></AdminRoute>} />
      </Route>

      {/* Portal do cliente */}
      <Route element={<ProtectedRoute><ClientGuard><ClientLayout /></ClientGuard></ProtectedRoute>}>
        <Route path="/app" element={<ClientHome />} />
        <Route path="/app/contratos" element={<MeusContratos />} />
        <Route path="/app/analises" element={<MinhasAnalises />} />
        <Route path="/app/equipe" element={<EquipeCliente />} />
        <Route path="/app/perfil" element={<PerfilCliente />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'Montserrat, sans-serif', fontSize: '14px' } }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
