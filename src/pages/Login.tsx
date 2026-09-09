import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { refreshAuth } = useAuth()
  const redirectTo = params.get('redirect')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Credenciais inválidas. Verifique e tente novamente.')
      setLoading(false)
    } else {
      await refreshAuth()
      // Se veio de um convite, redireciona pra lá; senão pra raiz (RoleRedirect decide)
      navigate(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/', { replace: true })
    }
  }

  const handleForgot = () => {
    toast('Entre em contato com o administrador do sistema.', { icon: '\u{1F512}' })
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-light">SEU</span>
          <span className="auth-logo-accent">CONTRATO</span>
        </div>
        <p className="auth-tagline">Gestão Contratual Inteligente</p>

        {/* Heading */}
        <h1 className="auth-title">Bem-vindo.</h1>
        <p className="auth-subtitle">Entre com suas credenciais para acessar o painel.</p>

        <form onSubmit={handleLogin} noValidate>
          {/* E-mail */}
          <div className="auth-field">
            <label htmlFor="login-email" className="auth-label">E-mail</label>
            <input
              id="login-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>

          {/* Senha */}
          <div className="auth-field">
            <label htmlFor="login-password" className="auth-label">Senha</label>
            <div className="auth-input-wrap">
              <input
                id="login-password"
                className="auth-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff size={15} strokeWidth={1.75} />
                  : <Eye size={15} strokeWidth={1.75} />
                }
              </button>
            </div>
          </div>

          {/* Forgot */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 0 28px 0' }}>
            <button type="button" className="auth-forgot" onClick={handleForgot}>
              Esqueceu a senha?
            </button>
          </div>

          {/* CTA */}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="auth-link">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </div>
      </div>

      {/* Footer */}
      <p className="auth-footer">Seu Contrato &copy; {new Date().getFullYear()} &middot; CorpLaw Advogados</p>
    </div>
  )
}
