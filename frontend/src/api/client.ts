import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const TOKEN_KEY = 'sms_access_token'
const REFRESH_KEY = 'sms_refresh_token'

/** Base URL: empty in dev uses Vite proxy to Django; set VITE_API_BASE_URL for production. */
export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

export const api = axios.create({
  baseURL: getApiBase(),
  headers: { 'Content-Type': 'application/json' },
})

export function getStoredAccess(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true
    const hadSession = Boolean(original.headers?.Authorization)
    const refresh = localStorage.getItem(REFRESH_KEY)
    if (!refresh) {
      clearTokens()
      if (hadSession && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign(`${window.location.origin}/login?expired=1`)
      }
      return Promise.reject(error)
    }
    try {
      const base = getApiBase()
      const { data } = await axios.post<{ access: string }>(
        `${base}/api/token/refresh/`,
        { refresh },
        { headers: { 'Content-Type': 'application/json' } },
      )
      localStorage.setItem(TOKEN_KEY, data.access)
      original.headers.Authorization = `Bearer ${data.access}`
      return api(original)
    } catch {
      clearTokens()
      if (hadSession && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign(`${window.location.origin}/login?expired=1`)
      }
      return Promise.reject(error)
    }
  },
)

export { TOKEN_KEY, REFRESH_KEY }
