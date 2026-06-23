import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PageHeader } from '../components/PageHeader'
import type { DashboardSummary } from '../types/dashboard'

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const displayName = useMemo(() => {
    const parts = [user?.first_name, user?.last_name].filter(Boolean)
    if (parts.length) return parts.join(' ')
    return user?.username ?? 'Administrator'
  }, [user])

  const loadDashboard = useCallback(async () => {
    const { data: body } = await api.get<DashboardSummary>('/api/enrollments/dashboard-summary/')
    setData(body)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      setError(null)
      try {
        if (cancelled) return
        await loadDashboard()
      } catch {
        if (!cancelled) setError('Unable to load dashboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [loadDashboard])

  if (error && !data) {
    return (
      <Box>
        <PageHeader title="Dashboard" crumbs={[{ label: 'Dashboard' }]} />
        <Alert severity="error" action={<Button size="small" onClick={loadDashboard}>Retry</Button>}>{error}</Alert>
      </Box>
    )
  }

  const returning = Math.max(0, data?.returning_students_current_term ?? 0)
  const active = Math.max(0, data?.active_students_current_term ?? 0)
  const nonReturning = Math.max(0, active - returning)
  const totalPie = returning + nonReturning
  const pieRows = [
    { name: 'Returning', value: returning, color: '#1976d2' },
    { name: 'Other active', value: nonReturning, color: '#90caf9' },
  ].filter((r) => r.value > 0)

  return (
    <Box>
      <PageHeader
        title={`Welcome, ${displayName}`}
        crumbs={[{ label: 'Dashboard' }]}
      />
      {loading && !data ? (
        <Box sx={{ py: 2 }}>
          <Skeleton variant="rectangular" height={120} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={300} />
        </Box>
      ) : !data ? null : (
        <>
          {loading && (
            <Box sx={{ mb: 1 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} md={3}>
              <Card variant="outlined" sx={{ height: '100%', minHeight: 200 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Returning students
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Returning vs other active students
                  </Typography>
                  {pieRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    <Box sx={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieRows} dataKey="value" nameKey="name" outerRadius={64} innerRadius={30}>
                            {pieRows.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [`${value} students`, String(name)]}
                            labelFormatter={() => 'Current active cohort split'}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                  {pieRows.length > 0 && (
                    <Stack spacing={0.5}>
                      {pieRows.map((row) => (
                        <Box key={row.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color }} />
                          <Typography variant="caption" color="text.secondary">
                            {row.name}: {row.value}
                            {totalPie > 0 ? ` (${Math.round((row.value / totalPie) * 100)}%)` : ''}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Active students
                      </Typography>
                      <Typography variant="h3" component="p" sx={{ fontWeight: 600 }}>
                        {data.active_students_current_term}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Top employers
                      </Typography>
                      {data.top_employers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {data.top_employers.map((row) => (
                            <ListItem key={row.employer} disableGutters sx={{ py: 0.25 }}>
                              <ListItemText
                                primary={row.employer}
                                secondary={String(row.student_count)}
                                primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                                secondaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Enrolments by programme
                  </Typography>
                  {data.enrollments_by_programme.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Programme code</TableCell>
                          <TableCell>Programme name</TableCell>
                          <TableCell align="right">Students</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.enrollments_by_programme.map((row) => (
                          <TableRow key={`${row.programme_code}-${row.programme_name}`}>
                            <TableCell>{row.programme_code}</TableCell>
                            <TableCell>{row.programme_name}</TableCell>
                            <TableCell align="right">{row.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card variant="outlined" sx={{ height: '100%', minHeight: 200 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Most popular pathway
                  </Typography>
                  {!data.most_popular_programme ? (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {data.most_popular_programme.programme_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        {data.most_popular_programme.programme_code}
                      </Typography>
                      <Typography variant="h3" component="p" sx={{ fontWeight: 600 }}>
                        {data.most_popular_programme.active_enrollments}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  )
}
