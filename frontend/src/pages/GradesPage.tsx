import { useCallback, useEffect, useState } from 'react'
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
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../api/client'
import { useCompactMode } from '../context/useCompactMode'
import { useSnackbar } from '../context/SnackbarContext'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import { EmptyState } from '../components/EmptyState'
import { compactCellPadding, stickyHeadCellSx, tableScrollSx } from '../components/tableSx'
import { downloadCsv } from '../utils/csv'
import type { Module, Paginated, Student, StudentResult } from '../types/api'

function gradeChip(g: string) {
  const color = g === 'PASS' ? 'success' : g === 'COMPENSATORY_PASS' ? 'warning' : 'error'
  const label = g === 'COMPENSATORY_PASS' ? 'Comp. pass' : g.replace('_', ' ')
  return <Chip size="small" label={label} color={color} variant="outlined" />
}

const PROCESSED_GRADES = ['PASS', 'FAIL', 'COMPENSATORY_PASS'] as const

const emptyForm = {
  student_id: '',
  module_code: '',
  term_code: '',
  raw_grade: '',
  processed_grade: '' as string,
  numeric_grade: '',
  recorded_date: new Date().toISOString().slice(0, 10),
}

export function GradesPage() {
  const { compact } = useCompactMode()
  const { showSuccess, showError } = useSnackbar()

  const [rows, setRows] = useState<StudentResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [students, setStudents] = useState<Student[]>([])
  const [modules, setModules] = useState<Module[]>([])

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Edit dialog
  const [editRow, setEditRow] = useState<StudentResult | null>(null)
  const [editForm, setEditForm] = useState({ raw_grade: '', processed_grade: '', numeric_grade: '', recorded_date: '' })
  const [editError, setEditError] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Delete dialog
  const [deleteRow, setDeleteRow] = useState<StudentResult | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Paginated<StudentResult>>('/api/grades/student-results/', {
        params: { page: page + 1, page_size: rowsPerPage },
      })
      setRows(data.results)
      setTotal(data.count)
    } catch {
      setError('Failed to load grades.')
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([
      api.get<Paginated<Student>>('/api/students/students/', { params: { page_size: 500 } }),
      api.get<Paginated<Module>>('/api/courses/modules/', { params: { page_size: 500 } }),
    ]).then(([s, m]) => {
      setStudents(s.data.results)
      setModules(m.data.results)
    })
  }, [])

  const exportCsv = () => {
    downloadCsv(
      'grades',
      ['Student', 'Student ID', 'Module', 'Term', 'Raw', 'Result', 'Recorded'],
      rows.map((r) => [
        `${r.student.first_name} ${r.student.last_name}`,
        r.student.student_id,
        r.module.module_name,
        r.term_code,
        r.raw_grade,
        r.processed_grade,
        r.recorded_date,
      ]),
    )
  }

  const handleAdd = async () => {
    setAddSubmitting(true)
    setAddError(null)
    try {
      await api.post('/api/grades/student-results/', {
        student_id: addForm.student_id,
        module_code: addForm.module_code,
        term_code: addForm.term_code,
        raw_grade: addForm.raw_grade,
        processed_grade: addForm.processed_grade,
        numeric_grade: addForm.numeric_grade || null,
        recorded_date: addForm.recorded_date,
      })
      setAddOpen(false)
      setAddForm(emptyForm)
      showSuccess('Grade added.')
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setAddError(msg ?? 'Failed to add grade.')
    } finally {
      setAddSubmitting(false)
    }
  }

  const openEdit = (r: StudentResult) => {
    setEditRow(r)
    setEditForm({
      raw_grade: r.raw_grade,
      processed_grade: r.processed_grade,
      numeric_grade: r.numeric_grade ?? '',
      recorded_date: r.recorded_date,
    })
    setEditError(null)
  }

  const handleEdit = async () => {
    if (!editRow) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      await api.patch(`/api/grades/student-results/${editRow.result_id}/`, {
        raw_grade: editForm.raw_grade,
        processed_grade: editForm.processed_grade,
        numeric_grade: editForm.numeric_grade || null,
        recorded_date: editForm.recorded_date,
      })
      setEditRow(null)
      showSuccess('Grade updated.')
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setEditError(msg ?? 'Failed to update grade.')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteRow) return
    setDeleteSubmitting(true)
    try {
      await api.delete(`/api/grades/student-results/${deleteRow.result_id}/`)
      setDeleteRow(null)
      showSuccess('Grade deleted.')
      load()
    } catch {
      showError('Failed to delete grade.')
      setDeleteRow(null)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const cp = compactCellPadding(compact)

  return (
    <Box>
      <PageHeader
        title="Grades"
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Grades' }]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={exportCsv} disabled={!rows.length || loading}>
              Export CSV
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setAddForm(emptyForm); setAddError(null); setAddOpen(true) }}>
              Add Grade
            </Button>
          </Stack>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} action={<Button size="small" onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {loading ? (
        <TableLoadingSkeleton cols={7} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={tableScrollSx(compact)}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={stickyHeadCellSx()}>Student</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Module</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Term</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Raw</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Result</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Recorded</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                    <EmptyState message="No grades found." />
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.result_id}>
                  <TableCell sx={cp}>
                    <Typography
                      component={RouterLink}
                      to={`/students/${r.student.student_id}`}
                      variant="body2"
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {r.student.first_name} {r.student.last_name}
                    </Typography>
                    {' '}({r.student.student_id})
                  </TableCell>
                  <TableCell sx={cp}>
                    <Typography
                      component={RouterLink}
                      to={`/courses?view=modules&expand=${encodeURIComponent(r.module.module_code)}`}
                      variant="body2"
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {r.module.module_name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cp}>{r.term_code}</TableCell>
                  <TableCell sx={cp}>{r.raw_grade}</TableCell>
                  <TableCell sx={cp}>{gradeChip(r.processed_grade)}</TableCell>
                  <TableCell sx={cp}>{r.recorded_date}</TableCell>
                  <TableCell sx={cp}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteRow(r)}><DeleteIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>
      )}

      {/* Add Grade dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Grade</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {addError && <Alert severity="error">{addError}</Alert>}
            <FormControl fullWidth size="small">
              <InputLabel>Student</InputLabel>
              <Select label="Student" value={addForm.student_id} onChange={(e) => setAddForm(f => ({ ...f, student_id: e.target.value }))}>
                {students.map((s) => (
                  <MenuItem key={s.student_id} value={s.student_id}>
                    {s.first_name} {s.last_name} ({s.student_id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Module</InputLabel>
              <Select label="Module" value={addForm.module_code} onChange={(e) => setAddForm(f => ({ ...f, module_code: e.target.value }))}>
                {modules.map((m) => (
                  <MenuItem key={m.module_code} value={m.module_code}>
                    {m.module_name} ({m.module_code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Term Code"
              size="small"
              value={addForm.term_code}
              onChange={(e) => setAddForm(f => ({ ...f, term_code: e.target.value }))}
              helperText="e.g. 20241"
            />
            <TextField
              label="Raw Grade"
              size="small"
              value={addForm.raw_grade}
              onChange={(e) => setAddForm(f => ({ ...f, raw_grade: e.target.value }))}
              helperText="e.g. 75, PASS, EXEMPT"
            />
            <TextField
              label="Numeric Grade"
              size="small"
              type="number"
              value={addForm.numeric_grade}
              onChange={(e) => setAddForm(f => ({ ...f, numeric_grade: e.target.value }))}
              helperText="Optional, 0–100"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Result</InputLabel>
              <Select label="Result" value={addForm.processed_grade} onChange={(e) => setAddForm(f => ({ ...f, processed_grade: e.target.value }))}>
                {PROCESSED_GRADES.map((g) => (
                  <MenuItem key={g} value={g}>{g === 'COMPENSATORY_PASS' ? 'Compensatory Pass' : g.charAt(0) + g.slice(1).toLowerCase()}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Recorded Date"
              size="small"
              type="date"
              value={addForm.recorded_date}
              onChange={(e) => setAddForm(f => ({ ...f, recorded_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={addSubmitting || !addForm.student_id || !addForm.module_code || !addForm.processed_grade}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Grade dialog */}
      <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Grade</DialogTitle>
        <DialogContent>
          {editRow && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {editError && <Alert severity="error">{editError}</Alert>}
              <Typography variant="body2" color="text.secondary">
                {editRow.student.first_name} {editRow.student.last_name} — {editRow.module.module_name} ({editRow.term_code})
              </Typography>
              <TextField
                label="Raw Grade"
                size="small"
                value={editForm.raw_grade}
                onChange={(e) => setEditForm(f => ({ ...f, raw_grade: e.target.value }))}
              />
              <TextField
                label="Numeric Grade"
                size="small"
                type="number"
                value={editForm.numeric_grade}
                onChange={(e) => setEditForm(f => ({ ...f, numeric_grade: e.target.value }))}
                helperText="Optional, 0–100"
              />
              <FormControl fullWidth size="small">
                <InputLabel>Result</InputLabel>
                <Select label="Result" value={editForm.processed_grade} onChange={(e) => setEditForm(f => ({ ...f, processed_grade: e.target.value }))}>
                  {PROCESSED_GRADES.map((g) => (
                    <MenuItem key={g} value={g}>{g === 'COMPENSATORY_PASS' ? 'Compensatory Pass' : g.charAt(0) + g.slice(1).toLowerCase()}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Recorded Date"
                size="small"
                type="date"
                value={editForm.recorded_date}
                onChange={(e) => setEditForm(f => ({ ...f, recorded_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRow(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={editSubmitting}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteRow} onClose={() => setDeleteRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Grade?</DialogTitle>
        <DialogContent>
          {deleteRow && (
            <Typography>
              Delete the grade for <strong>{deleteRow.student.first_name} {deleteRow.student.last_name}</strong> in{' '}
              <strong>{deleteRow.module.module_name}</strong> ({deleteRow.term_code})?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteRow(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteSubmitting}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
