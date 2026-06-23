import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import DownloadIcon from '@mui/icons-material/Download'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { downloadCsv } from '../utils/csv'
import type { Paginated, StudentModule, StudentProgram, StudentResult } from '../types/api'

const GRADE_COLORS: Record<string, string> = {
  PASS: '#4caf50',
  FAIL: '#f44336',
  COMPENSATORY_PASS: '#ff9800',
}

function statusChip(s: string) {
  const color = s === 'ACTIVE' ? 'success' : s === 'COMPLETED' ? 'info' : 'warning'
  return <Chip size="small" label={s} color={color} variant="outlined" />
}

function gradeChip(g: string) {
  const color = g === 'PASS' ? 'success' : g === 'COMPENSATORY_PASS' ? 'warning' : 'error'
  const label = g === 'COMPENSATORY_PASS' ? 'Comp. Pass' : g
  return <Chip size="small" label={label} color={color} variant="outlined" />
}

export function StudentDashboardPage() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<StudentProgram[]>([])
  const [modules, setModules] = useState<StudentModule[]>([])
  const [results, setResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Student'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [progRes, modRes, gradeRes] = await Promise.all([
        api.get<Paginated<StudentProgram>>('/api/enrollments/student-programs/', { params: { page_size: 100 } }),
        api.get<Paginated<StudentModule>>('/api/enrollments/student-modules/', { params: { page_size: 100 } }),
        api.get<Paginated<StudentResult>>('/api/grades/student-results/', { params: { page_size: 100 } }),
      ])
      setPrograms(progRes.data.results)
      setModules(modRes.data.results)
      setResults(gradeRes.data.results)
    } catch {
      setError('Failed to load your academic record.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const passCount = results.filter((r) => r.processed_grade === 'PASS' || r.processed_grade === 'COMPENSATORY_PASS').length
  const failCount = results.filter((r) => r.processed_grade === 'FAIL').length
  const activePrograms = programs.filter((p) => p.enroll_status === 'ACTIVE').length
  const activeModules = modules.filter((m) => m.enroll_status === 'ACTIVE').length

  const gradeDistribution = Object.entries(
    results.reduce<Record<string, number>>((acc, r) => {
      acc[r.processed_grade] = (acc[r.processed_grade] ?? 0) + 1
      return acc
    }, {}),
  ).map(([name, value]) => ({ name, value }))

  const modulesByTerm = Object.entries(
    modules.reduce<Record<string, number>>((acc, m) => {
      acc[m.term_code] = (acc[m.term_code] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([term_code, count]) => ({ term_code, count }))

  return (
    <Box>
      <PageHeader
        title={`Welcome, ${displayName}`}
        crumbs={[{ label: 'My Dashboard' }]}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {[
              { label: 'Active Programmes', value: activePrograms },
              { label: 'Active Modules', value: activeModules },
              { label: 'Grades Recorded', value: results.length },
              { label: 'Passed', value: passCount },
              { label: 'Failed', value: failCount },
            ].map(({ label, value }) => (
              <Grid item key={label} xs={6} sm={4} md={2}>
                <Card elevation={1}>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" fontWeight={700}>{value}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {(results.length > 0 || modules.length > 0) && (
            <Grid container spacing={3}>
              {results.length > 0 && (
                <Grid item xs={12} md={5}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      My Grade Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={gradeDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          labelLine={false}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) => {
                            if (!percent || percent < 0.05) return null
                            const RADIAN = Math.PI / 180
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                            const x = cx + radius * Math.cos(-((midAngle ?? 0) * RADIAN))
                            const y = cy + radius * Math.sin(-((midAngle ?? 0) * RADIAN))
                            const label = name === 'COMPENSATORY_PASS' ? 'Comp.Pass' : name
                            return (
                              <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11}>
                                {`${label} ${(percent * 100).toFixed(0)}%`}
                              </text>
                            )
                          }}
                        >
                          {gradeDistribution.map((entry) => (
                            <Cell key={entry.name} fill={GRADE_COLORS[entry.name] ?? '#90a4ae'} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [v, name === 'COMPENSATORY_PASS' ? 'Comp. Pass' : String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
              )}
              {modules.length > 0 && (
                <Grid item xs={12} md={7}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      Module Enrollments by Term
                    </Typography>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={modulesByTerm} margin={{ left: 0, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="term_code" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Modules" fill="#1976d2" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>Programme Enrollments</Typography>
              {programs.length > 0 && (
                <Button size="small" startIcon={<DownloadIcon />} onClick={() =>
                  downloadCsv('my_programme_enrollments.csv',
                    ['Programme', 'Code', 'Term', 'Status', 'Enrolled', 'Completed'],
                    programs.map((p) => [
                      p.programme.programme_name, p.programme.programme_code, p.term_code,
                      p.enroll_status, new Date(p.enrollment_date).toLocaleDateString(),
                      p.completion_date ? new Date(p.completion_date).toLocaleDateString() : '',
                    ]),
                  )
                }>Export CSV</Button>
              )}
            </Stack>
            {programs.length === 0 ? (
              <Typography color="text.secondary">No programme enrollments found.</Typography>
            ) : (
              <Paper elevation={1}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Programme</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell>Term</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Enrolled</TableCell>
                        <TableCell>Completed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {programs.map((p) => (
                        <TableRow key={p.enrollment_id} hover>
                          <TableCell>{p.programme.programme_name}</TableCell>
                          <TableCell>{p.programme.programme_code}</TableCell>
                          <TableCell>{p.term_code}</TableCell>
                          <TableCell>{statusChip(p.enroll_status)}</TableCell>
                          <TableCell>{new Date(p.enrollment_date).toLocaleDateString()}</TableCell>
                          <TableCell>{p.completion_date ? new Date(p.completion_date).toLocaleDateString() : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>Module Enrollments</Typography>
              {modules.length > 0 && (
                <Button size="small" startIcon={<DownloadIcon />} onClick={() =>
                  downloadCsv('my_module_enrollments.csv',
                    ['Module', 'Code', 'Term', 'Status', 'Enrolled'],
                    modules.map((m) => [
                      m.module.module_name, m.module.module_code, m.term_code,
                      m.enroll_status, new Date(m.enrollment_date).toLocaleDateString(),
                    ]),
                  )
                }>Export CSV</Button>
              )}
            </Stack>
            {modules.length === 0 ? (
              <Typography color="text.secondary">No module enrollments found.</Typography>
            ) : (
              <Paper elevation={1}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Module</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell>Term</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Enrolled</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {modules.map((m) => (
                        <TableRow key={m.enrollment_id} hover>
                          <TableCell>{m.module.module_name}</TableCell>
                          <TableCell>{m.module.module_code}</TableCell>
                          <TableCell>{m.term_code}</TableCell>
                          <TableCell>{statusChip(m.enroll_status)}</TableCell>
                          <TableCell>{new Date(m.enrollment_date).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Box>

          <Divider />

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>My Grades</Typography>
              {results.length > 0 && (
                <Button size="small" startIcon={<DownloadIcon />} onClick={() =>
                  downloadCsv('my_grades.csv',
                    ['Module', 'Code', 'Term', 'Raw Grade', 'Result', 'Numeric', 'Date'],
                    results.map((r) => [
                      r.module.module_name, r.module.module_code, r.term_code,
                      r.raw_grade, r.processed_grade, r.numeric_grade ?? '',
                      new Date(r.recorded_date).toLocaleDateString(),
                    ]),
                  )
                }>Export CSV</Button>
              )}
            </Stack>
            {results.length === 0 ? (
              <Typography color="text.secondary">No grades recorded yet.</Typography>
            ) : (
              <Paper elevation={1}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Module</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell>Term</TableCell>
                        <TableCell>Raw Grade</TableCell>
                        <TableCell>Result</TableCell>
                        <TableCell>Numeric</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((r) => (
                        <TableRow key={r.result_id} hover>
                          <TableCell>{r.module.module_name}</TableCell>
                          <TableCell>{r.module.module_code}</TableCell>
                          <TableCell>{r.term_code}</TableCell>
                          <TableCell>{r.raw_grade}</TableCell>
                          <TableCell>{gradeChip(r.processed_grade)}</TableCell>
                          <TableCell>{r.numeric_grade ?? '—'}</TableCell>
                          <TableCell>{new Date(r.recorded_date).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  )
}
