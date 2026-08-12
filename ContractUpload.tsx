import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  profile: null, loading: true, isAuthenticated: false, isAdmin: false,
  signOut: async () => {}, refreshAuth: async () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const loadSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(data || null)
        setIsAuthenticated(true)
      } else {
        setProfile(null)
        setIsAuthenticated(false)
      }
    } catch {
      setProfile(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await loadSession()
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        setIsAuthenticated(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setIsAuthenticated(false)
  }

  const refreshAuth = async () => {
    setLoading(true)
    await loadSession()
  }

  const isAdmin = profile?.role === 'socio' || profile?.role === 'administrador'

  return (
    <AuthContext.Provider value={{ profile, loading, isAuthenticated, isAdmin, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
