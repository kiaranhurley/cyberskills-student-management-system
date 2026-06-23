import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { Snackbar, Alert } from '@mui/material'

interface SnackbarContextValue {
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null)

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider')
  return ctx
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<'success' | 'error'>('success')

  function showSuccess(msg: string) {
    setMessage(msg)
    setSeverity('success')
    setOpen(true)
  }

  function showError(msg: string) {
    setMessage(msg)
    setSeverity('error')
    setOpen(true)
  }

  return (
    <SnackbarContext.Provider value={{ showSuccess, showError }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={severity} onClose={() => setOpen(false)} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  )
}
