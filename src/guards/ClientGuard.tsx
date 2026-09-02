import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ClientGuard({ children }: { children: React.ReactNode }) {
  const { isClient } = useAuth()
  if (!isClient) return <Navigate to="/painel" replace />
  return <>{children}</>
}
