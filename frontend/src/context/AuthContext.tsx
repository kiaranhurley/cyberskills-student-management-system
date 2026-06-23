import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, clearTokens, setTokens, getStoredAccess } from '../api/client'
import type { User } from '../types/api'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(getStoredAccess()))

  const refreshProfile = useCallback(async () => {
    const { data } = await api.get<User>('/api/auth/profile/')
    setUser(data)
  }, [])

  useEffect(() => {
    if (!getStoredAccess()) return
    refreshProfile()
      .catch(() => {
        clearTokens()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [refreshProfile])

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await api.post<{ user: User; access: string; refresh: string }>(
      '/api/auth/login/',
      { username, password },
    )
    setTokens(data.access, data.refresh)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshProfile }),
    [user, loading, login, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
