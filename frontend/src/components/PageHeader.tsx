import { Box, Breadcrumbs, Link as MuiLink, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export function PageHeader({
  title,
  crumbs,
  actions,
}: {
  title: string
  crumbs: BreadcrumbItem[]
  actions?: ReactNode
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 0.5 }}>
        {crumbs.map((c, i) =>
          c.to ? (
            <MuiLink
              key={`${c.label}-${i}`}
              component={RouterLink}
              to={c.to}
              color="inherit"
              underline="hover"
              variant="body2"
            >
              {c.label}
            </MuiLink>
          ) : (
            <Typography key={`${c.label}-${i}`} color="text.primary" variant="body2">
              {c.label}
            </Typography>
          ),
        )}
      </Breadcrumbs>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="h5" component="h1" fontWeight={600}>
          {title}
        </Typography>
        {actions}
      </Box>
    </Box>
  )
}
