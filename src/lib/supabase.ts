import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Fetch customizado com timeout de 30s: evita que queries fiquem
// pendentes indefinidamente quando o Supabase está lento ou offline.
const fetchWithTimeout = (url: RequestInfo | URL, options?: RequestInit) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
  auth: {
    // Persiste sessão no localStorage (padrão) e detecta mudanças
    // em outras abas automaticamente.
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true, // renova o token antes de expirar (evita SIGNED_OUT ao voltar de aba)
  },
})
