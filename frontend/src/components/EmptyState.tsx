import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import InboxIcon from '@mui/icons-material/Inbox'

interface EmptyStateProps {
  icon?: ReactNode
  message: string
  action?: ReactNode
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1 }}>
      <Box sx={{ color: 'text.disabled', mb: 0.5 }}>
        {icon ?? <InboxIcon sx={{ fontSize: 48 }} />}
      </Box>
      <Typography color="text.secondary">{message}</Typography>
      {action}
    </Box>
  )
}
