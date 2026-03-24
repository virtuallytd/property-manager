import { createContext, useCallback, useEffect, useState, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getMe, login as apiLogin, register as apiRegister, type UserOut } from '../api/auth'

interface AuthContextValue {
  user: UserOut | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (email: string, username: string, password: string) => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  register: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  // On mount (or when token changes), validate the stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setUser(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    getMe()
      .then((me) => {
        setUser(me)
        setToken(storedToken)
      })
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password)
    localStorage.setItem('token', response.access_token)
    setToken(response.access_token)
    setUser(response.user)
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }, [queryClient])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    queryClient.clear()
    window.location.href = '/login'
  }, [queryClient])

  const register = useCallback(async (email: string, username: string, password: string) => {
    await apiRegister(email, username, password)
    // Don't auto-login — account needs approval
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await getMe()
    setUser(me)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
