import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface User {
  id: string
  email: string
  displayName: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  signIn: (token: string, user: User) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem('token')
  )
  const [user, setUser] = useState<User | null>(() => {
    const raw = sessionStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  function signIn(t: string, u: User) {
    sessionStorage.setItem('token', t)
    sessionStorage.setItem('user', JSON.stringify(u))
    setToken(t)
    setUser(u)
  }

  function signOut() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
