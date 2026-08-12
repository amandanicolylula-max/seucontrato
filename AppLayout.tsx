import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { Toaster } from 'react-hot-toast'

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
  </div>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  if (loading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Login />
}

function AppRoutes() {
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
        <Route path="/auditoria" element={<AuditLog />} />
        <Route path="/usuarios" element={<AdminRoute><Users /></AdminRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'DM Sans, sans-serif', fontSize: '14px' } }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
