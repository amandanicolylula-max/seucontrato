import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CadastroCliente() {
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !empresa.trim() || !email.trim() || !password.trim()) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: nome,
          role: 'cliente_owner',
          empresa,
          cnpj: cnpj || undefined,
        },
      },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message === 'User already registered'
        ? 'Este e-mail já está cadastrado.'
        : 'Erro ao criar conta. Tente novamente.')
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-success">
            <p className="font-semibold text-base mb-2">Cadastro realizado!</p>
            <p className="text-sm opacity-80">
              Verifique seu e-mail para confirmar a conta. Após a confirmação, faça login para acessar seu portal.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 auth-btn"
            >
              Ir para o Login
            </button>
          </div>
        </div>
        <p className="auth-footer">Seu Contrato &copy; {new Date().getFullYear()} &middot; CorpLaw Advogados</p>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-light">SEU</span>
          <span className="auth-logo-accent">CONTRATO</span>
        </div>
        <p className="auth-tagline">Gestão Contratual Inteligente</p>

        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">Cadastre sua empresa para começar a gerenciar seus contratos.</p>

        <form onSubmit={handleCadastro} noValidate>
          <div className="auth-field">
            <label htmlFor="cad-nome" className="auth-label">Nome completo *</label>
            <input id="cad-nome" className="auth-input" type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome" autoComplete="name" />
          </div>

          <div className="auth-field">
            <label htmlFor="cad-empresa" className="auth-label">Nome da empresa *</label>
            <input id="cad-empresa" className="auth-input" type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} required placeholder="Razão social" />
          </div>

          <div className="auth-field">
            <label htmlFor="cad-cnpj" className="auth-label">CNPJ (opcional)</label>
            <input id="cad-cnpj" className="auth-input" type="text" value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>

          <div className="auth-field">
            <label htmlFor="cad-email" className="auth-label">E-mail *</label>
            <input id="cad-email" className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" autoComplete="email" />
          </div>

          <div className="auth-field">
            <label htmlFor="cad-password" className="auth-label">Senha *</label>
            <div className="auth-input-wrap">
              <input
                id="cad-password"
                className="auth-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                style={{ paddingRight: 42 }}
              />
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-btn" style={{ marginTop: 8 }} disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-link">
          Já tem uma conta? <Link to="/login">Entrar</Link>
        </div>
      </div>

      <p className="auth-footer">Seu Contrato &copy; {new Date().getFullYear()} &middot; CorpLaw Advogados</p>
    </div>
  )
}
