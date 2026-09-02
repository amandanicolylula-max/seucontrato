import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const { refreshAuth } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('Credenciais inválidas. Verifique e tente novamente.')
      setLoading(false)
    } else {
      await refreshAuth()
      navigate('/dashboard', { replace: true })
    }
  }

  const handleForgot = () => {
    toast('Entre em contato com o administrador do sistema.', { icon: '\u{1F512}' })
  }

  return (
    <div
      className="login-container"
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#0A0814',
      }}
    >
      {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
      <div
        className="login-left-panel login-panel-animate"
        style={{
          flex: '0 0 58%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <img
          src="/login-bg.jpg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />

        {/* Dark gradient overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(30,26,52,0.3) 0%, rgba(10,8,20,0.85) 100%)',
          }}
        />

        {/* Logo — top-left */}
        <div style={{ position: 'absolute', top: 28, left: 28 }}>
          <span
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 20,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ color: '#ffffff' }}>SEU</span>
            <span style={{ color: '#00A499' }}>CONTRATO</span>
          </span>
        </div>

        {/* Bottom branding copy */}
        <div style={{ position: 'absolute', bottom: 44, left: 44 }}>
          <p
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 10,
              letterSpacing: '0.22em',
              color: '#00A499',
              textTransform: 'uppercase',
              opacity: 0.9,
              margin: '0 0 7px 0',
              fontWeight: 600,
            }}
          >
            Gestão Contratual Inteligente
          </p>
          <p
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 30,
              fontWeight: 700,
              color: '#F0EDE8',
              lineHeight: 1.1,
              margin: '0 0 9px 0',
            }}
          >
            Seu Contrato
          </p>
          <p
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 12,
              color: 'rgba(240,237,232,0.62)',
              letterSpacing: '0.05em',
              margin: 0,
            }}
          >
            Controle contratual. Precisão jurídica.
          </p>
        </div>
      </div>

      {/* ── DIVIDER ────────────────────────────────────────────────── */}
      <div
        className="login-divider-v"
        aria-hidden="true"
        style={{ width: 1, backgroundColor: '#262050', flexShrink: 0 }}
      />

      {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
      <div
        className="login-right-panel"
        style={{
          flex: '0 0 42%',
          background: 'linear-gradient(to right, #0D0B1E 0%, #1E1A34 70%, #262050 100%)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Form centred content */}
        <div style={{ width: '100%', maxWidth: 290, padding: '0 24px', boxSizing: 'border-box' }}>

          {/* Title */}
          <h1
            className="login-item-animate"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 23,
              fontWeight: 700,
              color: '#F0EDE8',
              margin: '0 0 5px 0',
              lineHeight: 1.2,
              animationDelay: '0ms',
            }}
          >
            Acessar painel
          </h1>

          {/* Subtitle */}
          <p
            className="login-item-animate"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 12,
              color: '#9DA8B8',
              margin: '0 0 30px 0',
              animationDelay: '60ms',
            }}
          >
            Entre com suas credenciais
          </p>

          <form onSubmit={handleLogin} noValidate>
            {/* E-mail field */}
            <div
              className="login-item-animate"
              style={{ marginBottom: 16, animationDelay: '140ms' }}
            >
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 10,
                  color: '#8B96A5',
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  marginBottom: 7,
                  fontWeight: 500,
                }}
              >
                E-mail
              </label>
              <input
                id="login-email"
                className="login-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            {/* Password field */}
            <div
              className="login-item-animate"
              style={{ marginBottom: 0, animationDelay: '220ms' }}
            >
              <label
                htmlFor="login-password"
                style={{
                  display: 'block',
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 10,
                  color: '#8B96A5',
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  marginBottom: 7,
                  fontWeight: 500,
                }}
              >
                Senha
              </label>
              <div className="login-input-wrap">
                <input
                  id="login-password"
                  className="login-input"
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
                  className="login-eye-btn"
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

            {/* Forgot password */}
            <div
              className="login-item-animate"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                margin: '10px 0 24px 0',
                animationDelay: '300ms',
              }}
            >
              <button type="button" className="login-forgot" onClick={handleForgot}>
                Esqueceu a senha?
              </button>
            </div>

            {/* CTA */}
            <div
              className="login-item-animate"
              style={{ animationDelay: '360ms' }}
            >
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p
          style={{
            position: 'absolute',
            bottom: 22,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: 10,
            color: '#5A6475',
            margin: 0,
            userSelect: 'none',
          }}
        >
          Seu Contrato © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
