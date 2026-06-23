import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DownloadIcon from '@mui/icons-material/Download'
import { api } from '../api/client'
import { useCompactMode } from '../context/useCompactMode'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import { compactCellPadding, stickyHeadCellSx, tableScrollSx } from '../components/tableSx'
import { downloadCsv } from '../utils/csv'
import type { Paginated, StudentModule, StudentResult } from '../types/api'

function gradeChip(g: string) {
  const color = g === 'PASS' ? 'success' : g === 'COMPENSATORY_PASS' ? 'warning' : 'error'
  const label = g === 'COMPENSATORY_PASS' ? 'Comp. Pass' : g
  return <Chip size="small" label={label} color={color} variant="outlined" />
}

type GradeForm = {
  student: string
  module_code: string
  term_code: string
  raw_grade: string
  processed_grade: string
  numeric_grade: string
  recorded_date: string
}

export function LecturerModulePage() {
  const { moduleCode } = useParams<{ moduleCode: string }>()
  const navigate = useNavigate()
  const { compact } = useCompactMode()
  const cp = compactCellPadding(compact)
  const headSx = stickyHeadCellSx()

  const [enrollments, setEnrollments] = useState<StudentModule[]>([])
  const [enrollCount, setEnrollCount] = useState(0)
  const [enrollPage, setEnrollPage] = useState(0)
  const [enrollLoading, setEnrollLoading] = useState(true)

  const [grades, setGrades] = useState<StudentResult[]>([])
  const [gradeCount, setGradeCount] = useState(0)
  const [gradePage, setGradePage] = useState(0)
  const [gradeLoading, setGradeLoading] = useState(true)

  const [tab, setTab] = useState<'students' | 'grades'>('students')
  const [error, setError] = useState<string | null>(null)

  // Grade entry dialog
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
  const [editingResult, setEditingResult] = useState<StudentResult | null>(null)
  const [gradeForm, setGradeForm] = useState<GradeForm>({
    student: '', module_code: moduleCode ?? '', term_code: '',
    raw_grade: '', processed_grade: 'PASS', numeric_grade: '', recorded_date: new Date().toISOString().split('T')[0],
  })
  const [gradeError, setGradeError] = useState<string | null>(null)
  const [gradeSubmitting, setGradeSubmitting] = useState(false)

  const rowsPerPage = 25

  const fetchEnrollments = useCallback(async () => {
    if (!moduleCode) return
    setEnrollLoading(true)
    try {
      const { data } = await api.get<Paginated<StudentModule>>('/api/enrollments/student-modules/', {
        params: { module: moduleCode, page: enrollPage + 1, page_size: rowsPerPage },
      })
      setEnrollments(data.results)
      setEnrollCount(data.count)
    } catch {
      setError('Failed to load enrollments.')
    } finally {
      setEnrollLoading(false)
    }
  }, [moduleCode, enrollPage])

  const fetchGrades = useCallback(async () => {
    if (!moduleCode) return
    setGradeLoading(true)
    try {
      const { data } = await api.get<Paginated<StudentResult>>('/api/grades/student-results/', {
        params: { module: moduleCode, page: gradePage + 1, page_size: rowsPerPage },
      })
      setGrades(data.results)
      setGradeCount(data.count)
    } catch {
      setError('Failed to load grades.')
    } finally {
      setGradeLoading(false)
    }
  }, [moduleCode, gradePage])

  useEffect(() => { fetchEnrollments() }, [fetchEnrollments])
  useEffect(() => { fetchGrades() }, [fetchGrades])

  function openAddGrade(enrollment?: StudentModule) {
    setEditingResult(null)
    setGradeForm({
      student: enrollment?.student.student_id ?? '',
      module_code: moduleCode ?? '',
      term_code: enrollment?.term_code ?? '',
      raw_grade: '',
      processed_grade: 'PASS',
      numeric_grade: '',
      recorded_date: new Date().toISOString().split('T')[0],
    })
    setGradeError(null)
    setGradeDialogOpen(true)
  }

  function openEditGrade(result: StudentResult) {
    setEditingResult(result)
    setGradeForm({
      student: result.student.student_id,
      module_code: result.module.module_code,
      term_code: result.term_code,
      raw_grade: result.raw_grade,
      processed_grade: result.processed_grade,
      numeric_grade: result.numeric_grade ?? '',
      recorded_date: result.recorded_date,
    })
    setGradeError(null)
    setGradeDialogOpen(true)
  }

  async function handleGradeSubmit() {
    setGradeSubmitting(true)
    setGradeError(null)
    const payload = {
      student: gradeForm.student,
      module_code: gradeForm.module_code,
      term_code: gradeForm.term_code,
      raw_grade: gradeForm.raw_grade,
      processed_grade: gradeForm.processed_grade,
      numeric_grade: gradeForm.numeric_grade || null,
      recorded_date: gradeForm.recorded_date,
    }
    try {
      if (editingResult) {
        await api.patch(`/api/grades/student-results/${editingResult.result_id}/`, payload)
      } else {
        await api.post('/api/grades/student-results/', payload)
      }
      setGradeDialogOpen(false)
      fetchGrades()
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } }
      const d = e?.response?.data
      const msg = d ? Object.values(d).flat().join(' ') : 'Failed to save grade.'
      setGradeError(msg)
    } finally {
      setGradeSubmitting(false)
    }
  }

  const statusChip = (s: string) => {
    const color = s === 'ACTIVE' ? 'success' : s === 'COMPLETED' ? 'info' : 'warning'
    return <Chip size="small" label={s} color={color} variant="outlined" />
  }

  return (
    <Box>
      <PageHeader
        title={moduleCode ?? ''}
        crumbs={[{ label: 'Dashboard', to: '/lecturer' }, { label: moduleCode ?? '' }]}
        actions={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/lecturer')}>
            Back to dashboard
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Tab buttons */}
      <Stack direction="row" gap={1} sx={{ mb: 2 }}>
        <Button
          variant={tab === 'students' ? 'contained' : 'outlined'}
          onClick={() => setTab('students')}
        >
          Enrolled Students ({enrollCount})
        </Button>
        <Button
          variant={tab === 'grades' ? 'contained' : 'outlined'}
          onClick={() => setTab('grades')}
        >
          Grades ({gradeCount})
        </Button>
        <Box flex={1} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => {
            if (tab === 'students') {
              downloadCsv(`${moduleCode ?? 'module'}_students.csv`,
                ['Student ID', 'First Name', 'Last Name', 'Email', 'Term', 'Status'],
                enrollments.map((e) => [
                  e.student.student_id,
                  e.student.first_name,
                  e.student.last_name,
                  e.student.student_email || e.student.personal_email,
                  e.term_code,
                  e.enroll_status,
                ]),
              )
            } else {
              downloadCsv(`${moduleCode ?? 'module'}_grades.csv`,
                ['Student ID', 'Name', 'Term', 'Raw Grade', 'Result', 'Numeric', 'Recorded'],
                grades.map((g) => [
                  g.student.student_id,
                  [g.student.first_name, g.student.last_name].filter(Boolean).join(' '),
                  g.term_code,
                  g.raw_grade,
                  g.processed_grade,
                  g.numeric_grade ?? '',
                  new Date(g.recorded_date).toLocaleDateString(),
                ]),
              )
            }
          }}
          disabled={tab === 'students' ? enrollments.length === 0 : grades.length === 0}
        >
          Export CSV
        </Button>
        {tab === 'grades' && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openAddGrade()}>
            Add Grade
          </Button>
        )}
      </Stack>

      {tab === 'students' && (
        <Paper elevation={1}>
          <TableContainer sx={tableScrollSx(compact)}>
            <Table size={compact ? 'small' : 'medium'} stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Student ID</TableCell>
                  <TableCell sx={headSx}>Name</TableCell>
                  <TableCell sx={headSx}>Email</TableCell>
                  <TableCell sx={headSx}>Term</TableCell>
                  <TableCell sx={headSx}>Status</TableCell>
                  <TableCell sx={headSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {enrollLoading ? (
                  <TableLoadingSkeleton rows={rowsPerPage} cols={6} />
                ) : enrollments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      No students enrolled in this module.
                    </TableCell>
                  </TableRow>
                ) : enrollments.map((e) => (
                  <TableRow key={e.enrollment_id} hover>
                    <TableCell sx={cp}>{e.student.student_id}</TableCell>
                    <TableCell sx={cp}>
                      {[e.student.first_name, e.student.last_name].filter(Boolean).join(' ')}
                    </TableCell>
                    <TableCell sx={cp}>{e.student.student_email || e.student.personal_email}</TableCell>
                    <TableCell sx={cp}>{e.term_code}</TableCell>
                    <TableCell sx={cp}>{statusChip(e.enroll_status)}</TableCell>
                    <TableCell sx={cp}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => openAddGrade(e)}
                      >
                        Add grade
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={enrollCount}
            page={enrollPage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[25]}
            onPageChange={(_, p) => setEnrollPage(p)}
          />
        </Paper>
      )}

      {tab === 'grades' && (
        <Paper elevation={1}>
          <TableContainer sx={tableScrollSx(compact)}>
            <Table size={compact ? 'small' : 'medium'} stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Student ID</TableCell>
                  <TableCell sx={headSx}>Name</TableCell>
                  <TableCell sx={headSx}>Term</TableCell>
                  <TableCell sx={headSx}>Raw Grade</TableCell>
                  <TableCell sx={headSx}>Result</TableCell>
                  <TableCell sx={headSx}>Numeric</TableCell>
                  <TableCell sx={headSx}>Recorded</TableCell>
                  <TableCell sx={headSx}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gradeLoading ? (
                  <TableLoadingSkeleton rows={rowsPerPage} cols={8} />
                ) : grades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      No grades recorded yet.
                    </TableCell>
                  </TableRow>
                ) : grades.map((g) => (
                  <TableRow key={g.result_id} hover>
                    <TableCell sx={cp}>{g.student.student_id}</TableCell>
                    <TableCell sx={cp}>
                      {[g.student.first_name, g.student.last_name].filter(Boolean).join(' ')}
                    </TableCell>
                    <TableCell sx={cp}>{g.term_code}</TableCell>
                    <TableCell sx={cp}>{g.raw_grade}</TableCell>
                    <TableCell sx={cp}>{gradeChip(g.processed_grade)}</TableCell>
                    <TableCell sx={cp}>{g.numeric_grade ?? '—'}</TableCell>
                    <TableCell sx={cp}>{new Date(g.recorded_date).toLocaleDateString()}</TableCell>
                    <TableCell sx={cp}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => openEditGrade(g)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={gradeCount}
            page={gradePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[25]}
            onPageChange={(_, p) => setGradePage(p)}
          />
        </Paper>
      )}

      {/* Grade Entry Dialog */}
      <Dialog open={gradeDialogOpen} onClose={() => setGradeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingResult ? 'Edit Grade' : 'Add Grade'}</DialogTitle>
        <DialogContent>
          {gradeError && <Alert severity="error" sx={{ mb: 2 }}>{gradeError}</Alert>}
          <Stack gap={2} sx={{ mt: 1 }}>
            <TextField
              label="Student ID"
              required
              value={gradeForm.student}
              onChange={(e) => setGradeForm((f) => ({ ...f, student: e.target.value }))}
              disabled={Boolean(editingResult)}
              fullWidth
            />
            <TextField
              label="Term Code"
              required
              value={gradeForm.term_code}
              onChange={(e) => setGradeForm((f) => ({ ...f, term_code: e.target.value }))}
              fullWidth
              placeholder="e.g. 20241"
            />
            <TextField
              label="Raw Grade"
              required
              value={gradeForm.raw_grade}
              onChange={(e) => setGradeForm((f) => ({ ...f, raw_grade: e.target.value }))}
              fullWidth
              placeholder="e.g. PASS, 72, Distinction"
            />
            <FormControl fullWidth required>
              <InputLabel>Processed Grade</InputLabel>
              <Select
                label="Processed Grade"
                value={gradeForm.processed_grade}
                onChange={(e) => setGradeForm((f) => ({ ...f, processed_grade: e.target.value }))}
              >
                <MenuItem value="PASS">Pass</MenuItem>
                <MenuItem value="FAIL">Fail</MenuItem>
                <MenuItem value="COMPENSATORY_PASS">Compensatory Pass</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Numeric Grade"
              value={gradeForm.numeric_grade}
              onChange={(e) => setGradeForm((f) => ({ ...f, numeric_grade: e.target.value }))}
              fullWidth
              placeholder="Optional (e.g. 72)"
            />
            <TextField
              label="Recorded Date"
              type="date"
              required
              value={gradeForm.recorded_date}
              onChange={(e) => setGradeForm((f) => ({ ...f, recorded_date: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGradeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleGradeSubmit}
            disabled={gradeSubmitting || !gradeForm.student || !gradeForm.term_code || !gradeForm.raw_grade}
          >
            {gradeSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
