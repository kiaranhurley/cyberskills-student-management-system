import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { isAdministrator } from '../auth/roles'
import { useAuth } from '../context/AuthContext'

export function AdminRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdministrator(user)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
