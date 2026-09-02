import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function RoleRedirect() {
  const { isClient } = useAuth()
  if (isClient) return <Navigate to="/app" replace />
  return <Navigate to="/painel" replace />
}
