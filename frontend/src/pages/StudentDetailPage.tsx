import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import type {
  Paginated,
  Student,
  StudentModule,
  StudentProgram,
  StudentResult,
} from '../types/api'

function statusChip(status: string) {
  const color =
    status === 'ACTIVE' ? 'success' : status === 'COMPLETED' ? 'info' : 'warning'
  const label =
    status === 'ACTIVE' ? 'Active' : status === 'COMPLETED' ? 'Completed' : 'Withdrawn'
  return <Chip size="small" label={label} color={color} variant="outlined" />
}

function gradeChip(g: string) {
  const color = g === 'PASS' ? 'success' : g === 'COMPENSATORY_PASS' ? 'warning' : 'error'
  const label = g === 'PASS' ? 'Pass' : g === 'FAIL' ? 'Fail' : 'Compensatory pass'
  return <Chip size="small" label={label} color={color} variant="outlined" />
}

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [programs, setPrograms] = useState<StudentProgram[]>([])
  const [modules, setModules] = useState<StudentModule[]>([])
  const [results, setResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    try {
      const [s, p, m, r] = await Promise.all([
        api.get<Student>(`/api/students/students/${encodeURIComponent(studentId)}/`),
        api.get<Paginated<StudentProgram>>('/api/enrollments/student-programs/', {
          params: { student: studentId, page_size: 200 },
        }),
        api.get<Paginated<StudentModule>>('/api/enrollments/student-modules/', {
          params: { student: studentId, page_size: 200 },
        }),
        api.get<Paginated<StudentResult>>('/api/grades/student-results/', {
          params: { student: studentId, page_size: 200 },
        }),
      ])
      setStudent(s.data)
      setPrograms(p.data.results)
      setModules(m.data.results)
      setResults(r.data.results)
    } catch {
      setError('Student not found or could not load data.')
      setStudent(null)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    void load()
  }, [load])

  const title = student ? `${student.first_name} ${student.last_name}` : studentId ?? ''

  return (
    <Box>
      <PageHeader
        title={title}
        crumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Students', to: '/students' },
          { label: studentId ?? '' },
        ]}
        actions={
          <Button
            component={RouterLink}
            to="/students"
            startIcon={<ArrowBackIcon />}
            size="small"
            variant="outlined"
          >
            Back
          </Button>
        }
      />
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {loading ? (
        <TableLoadingSkeleton cols={4} rows={6} />
      ) : !student ? (
        <Button variant="contained" onClick={() => navigate('/students')}>
          Return to list
        </Button>
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {student.student_id}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {student.employer || '—'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {student.student_email || '—'}
            </Typography>
            <Typography variant="body2">{student.personal_email || '—'}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            {programs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            ) : (
              programs.map((p) => (
                <Box
                  key={p.enrollment_id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}
                >
                  <Typography
                    component={RouterLink}
                    to={`/courses?view=programmes&expand=${encodeURIComponent(p.programme.programme_code)}`}
                    variant="body2"
                    sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {p.programme.programme_name}
                  </Typography>
                  <Typography variant="body2" component="span" color="text.secondary">
                    ({p.term_code})
                  </Typography>
                  {statusChip(p.enroll_status)}
                </Box>
              ))
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Module code</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell>Term</TableCell>
                  <TableCell>Enrolment</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Recorded</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {modules.map((m) => {
                  const res = results.find(
                    (r) => r.module.module_code === m.module.module_code && r.term_code === m.term_code,
                  )
                  return (
                    <TableRow key={m.enrollment_id}>
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={`/courses?view=modules&expand=${encodeURIComponent(m.module.module_code)}`}
                          variant="body2"
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {m.module.module_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={`/courses?view=modules&expand=${encodeURIComponent(m.module.module_code)}`}
                          variant="body2"
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {m.module.module_name}
                        </Typography>
                      </TableCell>
                      <TableCell>{m.term_code}</TableCell>
                      <TableCell>{statusChip(m.enroll_status)}</TableCell>
                      <TableCell>{res ? gradeChip(res.processed_grade) : '—'}</TableCell>
                      <TableCell>{res ? res.recorded_date : '—'}</TableCell>
                    </TableRow>
                  )
                })}
                {results
                  .filter(
                    (r) =>
                      !modules.some(
                        (m) => m.module.module_code === r.module.module_code && m.term_code === r.term_code,
                      ),
                  )
                  .map((r) => (
                    <TableRow key={r.result_id}>
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={`/courses?view=modules&expand=${encodeURIComponent(r.module.module_code)}`}
                          variant="body2"
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {r.module.module_code}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={`/courses?view=modules&expand=${encodeURIComponent(r.module.module_code)}`}
                          variant="body2"
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {r.module.module_name}
                        </Typography>
                      </TableCell>
                      <TableCell>{r.term_code}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>{gradeChip(r.processed_grade)}</TableCell>
                      <TableCell>{r.recorded_date}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      )}
    </Box>
  )
}
