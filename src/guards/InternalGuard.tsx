import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function InternalGuard({ children }: { children: React.ReactNode }) {
  const { isInternal } = useAuth()
  if (!isInternal) return <Navigate to="/app" replace />
  return <>{children}</>
}
