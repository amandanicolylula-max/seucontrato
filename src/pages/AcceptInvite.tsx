import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface InviteInfo {
  email: string
  workspace_nome: string
  inviter_name: string
  expires_at: string
  has_account: boolean
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/validate-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setInfo(data)
        setLoading(false)
      })
      .catch(() => { setError('Erro ao validar convite'); setLoading(false) })
  }, [token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!info) return

    setAccepting(true)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    // Se tem conta, precisa estar logado; tenta enviar o token da sessão atual (se houver)
    if (info.has_account) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) headers['Authorization'] = `Bearer ${session.access_token}`
    }

    const r = await fetch('/api/accept-invite', {
      method: 'POST',
      headers,
      body: JSON.stringify({ token, password, full_name: fullName }),
    })
    const data = await r.json()
    setAccepting(false)

    if (r.ok) {
      // Se criou nova conta, fazer login automaticamente
      if (data.user_created) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        })
        if (loginErr) {
          toast.error('Conta criada! Faça login manualmente.')
          navigate('/login')
          return
        }
      }
      toast.success('Bem-vindo à equipe!')
      navigate('/app')
    } else if (data.need_login) {
      toast.error('Faça login com ' + data.email + ' para aceitar o convite')
      navigate(`/login?redirect=/invite/${token}`)
    } else {
      toast.error(data.error || 'Erro ao aceitar convite')
    }
  }

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-white/20 border-t-accent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Convite inválido</p>
              <p className="text-white/60 text-sm mt-1">{error}</p>
            </div>
            <Link to="/login" className="auth-btn text-center inline-block px-8 no-underline">Ir para o login</Link>
          </div>
        </div>
        <p className="auth-footer">Seu Contrato &copy; {new Date().getFullYear()} &middot; CorpLaw Advogados</p>
      </div>
    )
  }

  if (!info) return null

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-light">SEU</span>
          <span className="auth-logo-accent">CONTRATO</span>
        </div>
        <p className="auth-tagline">Gestão Contratual Inteligente</p>

        <div className="flex items-center gap-3 mb-4 mt-2">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-white text-lg font-semibold leading-tight">Você foi convidado</h1>
            <p className="text-white/60 text-xs mt-0.5">{info.inviter_name} convidou você pra "{info.workspace_nome}"</p>
          </div>
        </div>

        {info.has_account ? (
          <div className="mt-6">
            <p className="text-white/70 text-sm mb-4">
              Você já tem uma conta com <strong>{info.email}</strong>. Faça login para aceitar o convite.
            </p>
            <button onClick={handleAccept} disabled={accepting} className="auth-btn">
              {accepting ? 'Processando...' : 'Aceitar e continuar'}
            </button>
            <p className="text-center text-xs text-white/40 mt-3">
              Não está logado? <Link to={`/login?redirect=/invite/${token}`} className="text-accent hover:text-accent-light">Fazer login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleAccept}>
            <div className="auth-field">
              <label className="auth-label">E-mail (do convite)</label>
              <input className="auth-input" type="email" value={info.email} disabled style={{ opacity: 0.7 }} />
            </div>

            <div className="auth-field">
              <label className="auth-label">Seu nome completo *</label>
              <input className="auth-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Nome completo" />
            </div>

            <div className="auth-field">
              <label className="auth-label">Crie uma senha *</label>
              <div className="auth-input-wrap">
                <input className="auth-input" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6} style={{ paddingRight: 42 }} />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-btn" style={{ marginTop: 8 }} disabled={accepting}>
              {accepting ? 'Criando conta...' : 'Aceitar convite e criar conta'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-white/30 mt-6">
          Convite expira em {new Date(info.expires_at).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <p className="auth-footer">Seu Contrato &copy; {new Date().getFullYear()} &middot; CorpLaw Advogados</p>
    </div>
  )
}
