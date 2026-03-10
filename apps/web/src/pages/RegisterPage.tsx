import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await register(email, password, displayName)
      signIn(token, user)
      navigate('/campaigns')
    } catch (err: unknown) {
      const e = err as { message?: string }
      if (e.message === 'EMAIL_TAKEN') {
        setError('This email is already registered.')
      } else if (e.message === 'VALIDATION_ERROR') {
        setError('Please check your inputs.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-400 tracking-wide">
            RoleCompanion
          </h1>
          <div className="flex items-center gap-3 mt-3 justify-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-stone-700" />
            <span className="text-stone-500 text-sm italic">Campaign Companion</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-stone-700" />
          </div>
        </div>

        {/* Form card */}
        <div className="bg-stone-900 border border-stone-700 rounded-xl p-8">
          <p className="text-stone-400 text-center mb-6 text-sm uppercase tracking-widest">
            Create Account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-stone-300 mb-1">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={100}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                placeholder="Gandalf"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-crimson-500 hover:bg-crimson-400 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-stone-400 text-sm text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-400 hover:text-amber-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
