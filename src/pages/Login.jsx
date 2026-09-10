import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await signIn(email.trim(), password)
    setEnviando(false)
    if (error) {
      setError('Email o contraseña incorrectos.')
    }
  }

  return (
    <div className="login-pantalla">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo__marca">TACOS RUTH</div>
          <div className="login-logo__sub">Centro de Control</div>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <form className="form-grid espaciado-v" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
