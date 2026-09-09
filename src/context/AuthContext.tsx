import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

interface AuthContextType {
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isInternal: boolean
  isClient: boolean
  isWorkspaceOwner: boolean
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const INTERNAL_ROLES = ['socio', 'advogado', 'assistente']
const CLIENT_ROLES = ['cliente_owner', 'cliente_member']

const AuthContext = createContext<AuthContextType>({
  profile: null, loading: true, isAuthenticated: false, isAdmin: false,
  isInternal: false, isClient: false, isWorkspaceOwner: false,
  signOut: async () => {}, refreshAuth: async () => {}
})

// ─── Idle timeout ────────────────────────────────────────────────────────────
const ACTIVITY_KEY = 'bd_contratos_last_activity'
const IDLE_MS = 60 * 60 * 1000 // 1 hora

let _throttle = 0
const recordActivity = () => {
  const now = Date.now()
  if (now - _throttle > 10_000) {
    localStorage.setItem(ACTIVITY_KEY, String(now))
    _throttle = now
  }
}

const isIdle = (): boolean => {
  const last = Number(localStorage.getItem(ACTIVITY_KEY) || 0)
  // Se last === 0, o usuário nunca interagiu nesta sessão → não considerar idle
  return last > 0 && Date.now() - last > IDLE_MS
}
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    let mounted = true

    // Busca o perfil com timeout de 8s (evita hang em token expirado/rede lenta)
    const fetchProfile = async (userId: string): Promise<Profile | null> => {
      const result = await Promise.race([
        Promise.resolve(
          supabase.from('profiles').select('*').eq('id', userId).single()
        ).then(({ data }) => data as Profile | null)
          .catch(() => null),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
      ])
      return result
    }

    // Fallback: se o onAuthStateChange não disparar em 12s (sessão corrompida,
    // rede offline ou browser BFCache), desbloqueia o app.
    const initTimeout = setTimeout(() => {
      if (mounted) {
        setProfile(null)
        setIsAuthenticated(false)
        setLoading(false)
      }
    }, 12_000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      clearTimeout(initTimeout)
      if (!mounted) return

      try {
        if (session?.user) {
          // Atualiza ACTIVITY_KEY imediatamente (síncrono), antes do fetchProfile async.
          // Isso evita que isIdle() use um timestamp antigo (de sessão anterior) e
          // dispare logout ao voltar para a aba enquanto o perfil ainda está carregando.
          localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
          _throttle = Date.now()
          const data = await fetchProfile(session.user.id)
          if (!mounted) return
          setProfile(data)
          setIsAuthenticated(!!data)
        } else {
          setProfile(null)
          setIsAuthenticated(false)
        }
      } catch {
        setProfile(null)
        setIsAuthenticated(false)
      } finally {
        if (mounted) setLoading(false)
      }
    })

    // ── Rastreamento de atividade do usuário no site ──────────────────────────
    document.addEventListener('click', recordActivity)
    document.addEventListener('keydown', recordActivity)
    document.addEventListener('scroll', recordActivity, { passive: true })

    // Verifica idle a cada 60s enquanto a aba está ativa
    const idleInterval = setInterval(() => {
      if (isIdle()) supabase.auth.signOut()
    }, 60_000)

    // Quando o usuário retorna à aba:
    // 1. Se passou 1h+ sem interagir → desloga
    // 2. Caso contrário → chama getSession() para renovar token (evita SIGNED_OUT
    //    por throttling de timers em background)
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (isIdle()) {
        supabase.auth.signOut()
        return
      }
      // refreshSession renova o token sem disparar SIGNED_OUT primeiro,
      // evitando o flash de redirect para /login ao voltar à aba.
      supabase.auth.refreshSession()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // ─────────────────────────────────────────────────────────────────────────

    return () => {
      mounted = false
      clearTimeout(initTimeout)
      clearInterval(idleInterval)
      subscription.unsubscribe()
      document.removeEventListener('click', recordActivity)
      document.removeEventListener('keydown', recordActivity)
      document.removeEventListener('scroll', recordActivity)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const signOut = async () => {
    localStorage.removeItem(ACTIVITY_KEY)
    await supabase.auth.signOut()
  }

  const refreshAuth = async () => {
    setLoading(true)
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

  const isAdmin = useMemo(
    () => profile?.role === 'socio',
    [profile?.role]
  )

  const isInternal = useMemo(
    () => !!profile?.role && INTERNAL_ROLES.includes(profile.role),
    [profile?.role]
  )

  const isClient = useMemo(
    () => !!profile?.role && CLIENT_ROLES.includes(profile.role),
    [profile?.role]
  )

  const isWorkspaceOwner = useMemo(
    () => profile?.role === 'cliente_owner',
    [profile?.role]
  )

  return (
    <AuthContext.Provider value={{ profile, loading, isAuthenticated, isAdmin, isInternal, isClient, isWorkspaceOwner, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
