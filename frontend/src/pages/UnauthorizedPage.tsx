import { Box, Button, Paper, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function UnauthorizedPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper elevation={1} sx={{ p: 4, maxWidth: 400 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          Access denied
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
          Administrator account required.
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        >
          Back to login
        </Button>
      </Paper>
    </Box>
  )
}
