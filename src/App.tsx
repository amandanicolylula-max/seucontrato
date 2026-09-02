import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/Layout/AppLayout'
import Login from '@/pages/Login'
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
import { Toaster } from 'react-hot-toast'

// Spinner com feedback progressivo: após 4s exibe mensagem de espera,
// após 10s sugere recarregar a página.
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
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Login />
}

// AppRoutes bloqueia TODO o roteamento enquanto a sessão está carregando,
// evitando que ProtectedRoute faça redirect prematuro para /login.
function AppRoutes() {
  const { loading } = useAuth()
  if (loading) return <Spinner />
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contratos" element={<Contracts />} />
        <Route path="/contratos/novo" element={<ContractUpload />} />
        <Route path="/contratos/:id" element={<ContractDetail />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/oportunidades" element={<Opportunities />} />
        <Route path="/alertas" element={<Alerts />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/auditoria" element={<AuditLog />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="/analise" element={<ContractAnalysisList />} />
        <Route path="/analise/nova" element={<ContractAnalysisNew />} />
        <Route path="/analise/:id" element={<ContractAnalysisDetail />} />
        <Route path="/banco-de-problemas" element={<BancoProblemas />} />
        <Route path="/usuarios" element={<AdminRoute><Users /></AdminRoute>} />
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
