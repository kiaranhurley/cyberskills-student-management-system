import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import SchoolIcon from '@mui/icons-material/School'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PageHeader } from '../components/PageHeader'

interface Assignment {
  id: number
  module_code_id: string
  module_name: string
  term_code: string
}

interface ModuleStats {
  module_code: string
  module_name: string
  terms: string[]
  student_count: number
  graded_count: number
}

export function LecturerDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [moduleStats, setModuleStats] = useState<ModuleStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Lecturer'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: asgn } = await api.get<Assignment[]>('/api/auth/my-assignments/')

      const byModule: Record<string, { module_code: string; module_name: string; terms: string[] }> = {}
      for (const a of asgn) {
        if (!byModule[a.module_code_id]) {
          byModule[a.module_code_id] = { module_code: a.module_code_id, module_name: a.module_name, terms: [] }
        }
        byModule[a.module_code_id].terms.push(a.term_code)
      }

      const stats: ModuleStats[] = []
      for (const mod of Object.values(byModule)) {
        const [enrollRes, gradeRes] = await Promise.all([
          api.get('/api/enrollments/student-modules/', { params: { module: mod.module_code, page_size: 1 } }),
          api.get('/api/grades/student-results/', { params: { module: mod.module_code, page_size: 1 } }),
        ])
        stats.push({
          ...mod,
          student_count: enrollRes.data.count,
          graded_count: gradeRes.data.count,
        })
      }
      setModuleStats(stats)
    } catch {
      setError('Failed to load your assignments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <Box>
      <PageHeader
        title={`Welcome, ${displayName}`}
        crumbs={[{ label: 'Dashboard' }]}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : moduleStats.length === 0 ? (
        <Card>
          <CardContent>
            <Stack alignItems="center" spacing={2} py={4}>
              <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography color="text.secondary">
                You have no module assignments yet. Contact an administrator.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            My Modules ({moduleStats.length})
          </Typography>
          <Grid container spacing={2}>
            {moduleStats.map((mod) => (
              <Grid item key={mod.module_code} xs={12} sm={6} md={4}>
                <Card elevation={1} sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="overline" color="text.secondary" lineHeight={1}>
                        {mod.module_code}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {mod.module_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Terms: {mod.terms.sort().join(', ')}
                      </Typography>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between">
                        <Box>
                          <Typography variant="h5" fontWeight={700}>{mod.student_count}</Typography>
                          <Typography variant="caption" color="text.secondary">Enrolled students</Typography>
                        </Box>
                        <Box>
                          <Typography variant="h5" fontWeight={700}>{mod.graded_count}</Typography>
                          <Typography variant="caption" color="text.secondary">Grades recorded</Typography>
                        </Box>
                      </Stack>
                      <Button
                        variant="outlined"
                        size="small"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => navigate(`/lecturer/modules/${mod.module_code}`)}
                        sx={{ mt: 1 }}
                      >
                        View module
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  )
}
