import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import FilterListIcon from '@mui/icons-material/FilterList'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { downloadCsv } from '../utils/csv'
import type { Paginated, Programme } from '../types/api'

const GRADE_COLORS: Record<string, string> = {
  PASS: '#4caf50',
  FAIL: '#f44336',
  COMPENSATORY_PASS: '#ff9800',
}

interface ReportsData {
  totals: {
    students: number
    programme_enrollments: number
    module_enrollments: number
    grades_recorded: number
    pass_count: number
  }
  module_enrollment_by_term: { term_code: string; count: number }[]
  programme_enrollment_by_term: { term_code: string; count: number }[]
  grade_distribution: { processed_grade: string; count: number }[]
  grade_by_module: { module__module_code: string; module__module_name: string; processed_grade: string; count: number }[]
  programme_completion: { programme__programme_code: string; programme__programme_name: string; enroll_status: string; count: number }[]
}

function gradeLabel(g: string): string {
  if (g === 'COMPENSATORY_PASS') return 'Comp. Pass'
  return g
}

export function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [terms, setTerms] = useState<string[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])

  // Active filter state
  const [termFrom, setTermFrom] = useState('')
  const [termTo, setTermTo] = useState('')
  const [programmeId, setProgrammeId] = useState('')

  // Pending (not yet applied) filter state
  const [pendingTermFrom, setPendingTermFrom] = useState('')
  const [pendingTermTo, setPendingTermTo] = useState('')
  const [pendingProgrammeId, setPendingProgrammeId] = useState('')

  const load = useCallback(async (tf: string, tt: string, pid: string) => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (tf) params.term_from = tf
      if (tt) params.term_to = tt
      if (pid) params.programme_id = pid
      const { data: d } = await api.get<ReportsData>('/api/enrollments/reports/', { params })
      setData(d)
    } catch {
      setError('Failed to load reports data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load('', '', '') }, [load])

  useEffect(() => {
    Promise.all([
      api.get<{ terms: string[] }>('/api/enrollments/enrollment-terms/'),
      api.get<Paginated<Programme>>('/api/courses/programmes/', { params: { page_size: 500 } }),
    ]).then(([t, p]) => {
      setTerms(t.data.terms)
      setProgrammes(p.data.results)
    }).catch(() => {})
  }, [])

  function applyFilters() {
    setTermFrom(pendingTermFrom)
    setTermTo(pendingTermTo)
    setProgrammeId(pendingProgrammeId)
    load(pendingTermFrom, pendingTermTo, pendingProgrammeId)
  }

  function clearFilters() {
    setPendingTermFrom('')
    setPendingTermTo('')
    setPendingProgrammeId('')
    setTermFrom('')
    setTermTo('')
    setProgrammeId('')
    load('', '', '')
  }

  const filtersActive = !!(termFrom || termTo || programmeId)

  const filterBar = (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap" useFlexGap>
        <FilterListIcon color="action" sx={{ mb: 0.5 }} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Term From</InputLabel>
          <Select label="Term From" value={pendingTermFrom} onChange={(e) => setPendingTermFrom(e.target.value)}>
            <MenuItem value=""><em>Any</em></MenuItem>
            {[...terms].reverse().map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Term To</InputLabel>
          <Select label="Term To" value={pendingTermTo} onChange={(e) => setPendingTermTo(e.target.value)}>
            <MenuItem value=""><em>Any</em></MenuItem>
            {terms.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Programme</InputLabel>
          <Select label="Programme" value={pendingProgrammeId} onChange={(e) => setPendingProgrammeId(e.target.value)}>
            <MenuItem value=""><em>All programmes</em></MenuItem>
            {programmes.map((p) => <MenuItem key={p.programme_code} value={p.programme_code}>{p.programme_name}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" size="small" onClick={applyFilters}>Apply</Button>
        {filtersActive && (
          <Button variant="outlined" size="small" onClick={clearFilters}>Clear</Button>
        )}
      </Stack>
    </Paper>
  )

  if (loading || !data) {
    return (
      <Box>
        <PageHeader title="Reports" crumbs={[{ label: 'Reports' }]} />
        {filterBar}
        {error ? (
          <Alert severity="error" action={<Button size="small" onClick={() => load(termFrom, termTo, programmeId)}>Retry</Button>}>{error}</Alert>
        ) : (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        )}
      </Box>
    )
  }

  const passRate = data.totals.grades_recorded > 0
    ? Math.round((data.totals.pass_count / data.totals.grades_recorded) * 100)
    : 0

  const programmeMap: Record<string, { code: string; name: string; ACTIVE: number; COMPLETED: number; WITHDRAWN: number }> = {}
  for (const row of data.programme_completion) {
    const key = row.programme__programme_code
    if (!programmeMap[key]) {
      programmeMap[key] = { code: row.programme__programme_code, name: row.programme__programme_name, ACTIVE: 0, COMPLETED: 0, WITHDRAWN: 0 }
    }
    const st = row.enroll_status as 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN'
    programmeMap[key][st] = row.count
  }
  const programmeRows = Object.values(programmeMap).sort((a, b) => {
    return (b.ACTIVE + b.COMPLETED + b.WITHDRAWN) - (a.ACTIVE + a.COMPLETED + a.WITHDRAWN)
  })

  const moduleGradeMap: Record<string, { module: string; PASS: number; FAIL: number; COMPENSATORY_PASS: number }> = {}
  for (const row of data.grade_by_module) {
    const key = row.module__module_code
    if (!moduleGradeMap[key]) {
      moduleGradeMap[key] = { module: row.module__module_code, PASS: 0, FAIL: 0, COMPENSATORY_PASS: 0 }
    }
    const grade = row.processed_grade as 'PASS' | 'FAIL' | 'COMPENSATORY_PASS'
    moduleGradeMap[key][grade] = row.count
  }
  const moduleGradeData = Object.values(moduleGradeMap)
    .sort((a, b) => (b.PASS + b.FAIL + b.COMPENSATORY_PASS) - (a.PASS + a.FAIL + a.COMPENSATORY_PASS))
    .slice(0, 12)

  function exportCompletionCsv() {
    const headers = ['Programme Code', 'Programme Name', 'Active', 'Completed', 'Withdrawn', 'Total', 'Completion Rate %']
    const rows = programmeRows.map((r) => {
      const total = r.ACTIVE + r.COMPLETED + r.WITHDRAWN
      const rate = total > 0 ? Math.round((r.COMPLETED / total) * 100) : 0
      return [r.code, r.name, r.ACTIVE, r.COMPLETED, r.WITHDRAWN, total, rate]
    })
    downloadCsv('programme_completion_report.csv', headers, rows)
  }

  const pieLabelRenderer = (props: Record<string, unknown>) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, name, percent } = props as {
      cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; name: string; percent: number
    }
    if (!percent || percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = (innerRadius ?? 0) + ((outerRadius ?? 0) - (innerRadius ?? 0)) * 0.5
    const x = (cx ?? 0) + radius * Math.cos(-((midAngle ?? 0) * RADIAN))
    const y = (cy ?? 0) + radius * Math.sin(-((midAngle ?? 0) * RADIAN))
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
        {`${gradeLabel(name ?? '')} ${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <Box>
      <PageHeader title="Reports" crumbs={[{ label: 'Reports' }]} />
      {filterBar}
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Students', value: data.totals.students },
          { label: 'Programme Enrollments', value: data.totals.programme_enrollments },
          { label: 'Module Enrollments', value: data.totals.module_enrollments },
          { label: 'Grades Recorded', value: data.totals.grades_recorded },
          { label: 'Overall Pass Rate', value: `${passRate}%` },
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

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Overall Grade Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.grade_distribution}
                  dataKey="count"
                  nameKey="processed_grade"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine={false}
                  label={(props) => pieLabelRenderer(props as unknown as Record<string, unknown>)}
                >
                  {data.grade_distribution.map((entry) => (
                    <Cell key={entry.processed_grade} fill={GRADE_COLORS[entry.processed_grade] ?? '#90a4ae'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [v, gradeLabel(String(name))]} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Module Enrollments by Term
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.module_enrollment_by_term} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="term_code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Enrollments" fill="#1976d2" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Programme Enrollments by Term
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.programme_enrollment_by_term} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="term_code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Enrollments" fill="#9c27b0" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {moduleGradeData.length > 0 && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Grade Distribution by Module (Top {moduleGradeData.length})
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={moduleGradeData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="module" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="PASS" name="Pass" fill={GRADE_COLORS.PASS} stackId="a" />
                  <Bar dataKey="COMPENSATORY_PASS" name="Comp. Pass" fill={GRADE_COLORS.COMPENSATORY_PASS} stackId="a" />
                  <Bar dataKey="FAIL" name="Fail" fill={GRADE_COLORS.FAIL} stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        <Grid item xs={12}>
          <Paper elevation={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>Programme Completion Rates</Typography>
              <Button size="small" startIcon={<DownloadIcon />} onClick={exportCompletionCsv}>
                Export CSV
              </Button>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Programme</TableCell>
                    <TableCell align="right">Active</TableCell>
                    <TableCell align="right">Completed</TableCell>
                    <TableCell align="right">Withdrawn</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Completion Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {programmeRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                        <EmptyState message="No programme data for the selected filters." />
                      </TableCell>
                    </TableRow>
                  ) : programmeRows.map((r) => {
                    const total = r.ACTIVE + r.COMPLETED + r.WITHDRAWN
                    const rate = total > 0 ? Math.round((r.COMPLETED / total) * 100) : 0
                    return (
                      <TableRow key={r.code} hover>
                        <TableCell>{r.code}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell align="right">{r.ACTIVE}</TableCell>
                        <TableCell align="right">{r.COMPLETED}</TableCell>
                        <TableCell align="right">{r.WITHDRAWN}</TableCell>
                        <TableCell align="right">{total}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color={rate >= 50 ? 'success.main' : rate >= 25 ? 'warning.main' : 'error.main'}
                          >
                            {rate}%
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
