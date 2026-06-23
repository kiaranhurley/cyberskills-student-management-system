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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
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
import type { Module, Paginated, Programme, Student, StudentModule, StudentProgram } from '../types/api'

function statusChip(status: string) {
  const color = status === 'ACTIVE' ? 'success' : status === 'COMPLETED' ? 'info' : 'warning'
  const label = status === 'ACTIVE' ? 'Active' : status === 'COMPLETED' ? 'Completed' : 'Withdrawn'
  return <Chip size="small" label={label} color={color} variant="outlined" />
}

const STATUSES = ['ACTIVE', 'COMPLETED', 'WITHDRAWN'] as const
const today = new Date().toISOString().slice(0, 10)

const emptyAddForm = {
  student_id: '',
  programme_code: '',
  module_code: '',
  term_code: '',
  enroll_status: 'ACTIVE' as string,
  enrollment_date: today,
}

const emptyEditForm = {
  enroll_status: 'ACTIVE' as string,
  completion_date: '',
}

export function EnrollmentsPage() {
  const { compact } = useCompactMode()
  const { showSuccess, showError } = useSnackbar()

  const [tab, setTab] = useState(0)
  const [pathRows, setPathRows] = useState<StudentProgram[]>([])
  const [modRows, setModRows] = useState<StudentModule[]>([])
  const [pathTotal, setPathTotal] = useState(0)
  const [modTotal, setModTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [students, setStudents] = useState<Student[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [modules, setModules] = useState<Module[]>([])

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyAddForm)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Edit dialog
  const [editPathRow, setEditPathRow] = useState<StudentProgram | null>(null)
  const [editModRow, setEditModRow] = useState<StudentModule | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Delete dialog
  const [deletePathRow, setDeletePathRow] = useState<StudentProgram | null>(null)
  const [deleteModRow, setDeleteModRow] = useState<StudentModule | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const loadPath = useCallback(async () => {
    const { data } = await api.get<Paginated<StudentProgram>>('/api/enrollments/student-programs/', {
      params: { page: page + 1, page_size: rowsPerPage },
    })
    setPathRows(data.results)
    setPathTotal(data.count)
  }, [page, rowsPerPage])

  const loadMod = useCallback(async () => {
    const { data } = await api.get<Paginated<StudentModule>>('/api/enrollments/student-modules/', {
      params: { page: page + 1, page_size: rowsPerPage },
    })
    setModRows(data.results)
    setModTotal(data.count)
  }, [page, rowsPerPage])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        if (tab === 0) await loadPath()
        else await loadMod()
      } catch {
        if (!cancelled) setError('Failed to load enrollments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [tab, loadPath, loadMod])

  useEffect(() => {
    Promise.all([
      api.get<Paginated<Student>>('/api/students/students/', { params: { page_size: 500 } }),
      api.get<Paginated<Programme>>('/api/courses/programmes/', { params: { page_size: 500 } }),
      api.get<Paginated<Module>>('/api/courses/modules/', { params: { page_size: 500 } }),
    ]).then(([s, p, m]) => {
      setStudents(s.data.results)
      setProgrammes(p.data.results)
      setModules(m.data.results)
    })
  }, [])

  const reload = () => (tab === 0 ? loadPath() : loadMod())

  const exportCsv = () => {
    if (tab === 0) {
      downloadCsv(
        'pathway-enrollments',
        ['Student', 'Student ID', 'Programme', 'Term', 'Status', 'Enrolled'],
        pathRows.map((r) => [
          `${r.student.first_name} ${r.student.last_name}`,
          r.student.student_id,
          r.programme.programme_name,
          r.term_code,
          r.enroll_status,
          r.enrollment_date,
        ]),
      )
    } else {
      downloadCsv(
        'module-enrollments',
        ['Student', 'Student ID', 'Module', 'Term', 'Status', 'Enrolled'],
        modRows.map((r) => [
          `${r.student.first_name} ${r.student.last_name}`,
          r.student.student_id,
          r.module.module_name,
          r.term_code,
          r.enroll_status,
          r.enrollment_date,
        ]),
      )
    }
  }

  const handleAdd = async () => {
    setAddSubmitting(true)
    setAddError(null)
    try {
      if (tab === 0) {
        await api.post('/api/enrollments/student-programs/', {
          student_id: addForm.student_id,
          programme_code: addForm.programme_code,
          term_code: addForm.term_code,
          enroll_status: addForm.enroll_status,
          enrollment_date: addForm.enrollment_date,
        })
      } else {
        await api.post('/api/enrollments/student-modules/', {
          student_id: addForm.student_id,
          module_code: addForm.module_code,
          term_code: addForm.term_code,
          enroll_status: addForm.enroll_status,
          enrollment_date: addForm.enrollment_date,
        })
      }
      setAddOpen(false)
      setAddForm(emptyAddForm)
      showSuccess('Enrollment added.')
      reload()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setAddError(msg ?? 'Failed to add enrollment.')
    } finally {
      setAddSubmitting(false)
    }
  }

  const openEditPath = (r: StudentProgram) => {
    setEditPathRow(r)
    setEditForm({ enroll_status: r.enroll_status, completion_date: r.completion_date ?? '' })
    setEditError(null)
  }

  const openEditMod = (r: StudentModule) => {
    setEditModRow(r)
    setEditForm({ enroll_status: r.enroll_status, completion_date: r.completion_date ?? '' })
    setEditError(null)
  }

  const handleEdit = async () => {
    setEditSubmitting(true)
    setEditError(null)
    const body = {
      enroll_status: editForm.enroll_status,
      completion_date: editForm.completion_date || null,
    }
    try {
      if (editPathRow) {
        await api.patch(`/api/enrollments/student-programs/${editPathRow.enrollment_id}/`, body)
        setEditPathRow(null)
      } else if (editModRow) {
        await api.patch(`/api/enrollments/student-modules/${editModRow.enrollment_id}/`, body)
        setEditModRow(null)
      }
      showSuccess('Enrollment updated.')
      reload()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setEditError(msg ?? 'Failed to update enrollment.')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleteSubmitting(true)
    try {
      if (deletePathRow) {
        await api.delete(`/api/enrollments/student-programs/${deletePathRow.enrollment_id}/`)
        setDeletePathRow(null)
      } else if (deleteModRow) {
        await api.delete(`/api/enrollments/student-modules/${deleteModRow.enrollment_id}/`)
        setDeleteModRow(null)
      }
      showSuccess('Enrollment deleted.')
      reload()
    } catch {
      showError('Failed to delete enrollment.')
      setDeletePathRow(null)
      setDeleteModRow(null)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const editOpen = !!editPathRow || !!editModRow
  const deleteOpen = !!deletePathRow || !!deleteModRow
  const deleteLabel = deletePathRow
    ? `${deletePathRow.student.first_name} ${deletePathRow.student.last_name} from ${deletePathRow.programme.programme_name}`
    : deleteModRow
    ? `${deleteModRow.student.first_name} ${deleteModRow.student.last_name} from ${deleteModRow.module.module_name}`
    : ''

  const cp = compactCellPadding(compact)
  const cols = 6

  const addValid = tab === 0
    ? addForm.student_id && addForm.programme_code && addForm.term_code
    : addForm.student_id && addForm.module_code && addForm.term_code

  return (
    <Box>
      <PageHeader
        title="Enrollments"
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Enrollments' }]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={exportCsv}
              disabled={loading || (tab === 0 ? !pathRows.length : !modRows.length)}
            >
              Export CSV
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => { setAddForm(emptyAddForm); setAddError(null); setAddOpen(true) }}
            >
              Add Enrollment
            </Button>
          </Stack>
        }
      />
      <Tabs
        value={tab}
        onChange={(_, v) => { setLoading(true); setTab(v); setPage(0) }}
        sx={{ mb: 2 }}
      >
        <Tab label="Pathways" />
        <Tab label="Modules" />
      </Tabs>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} action={<Button size="small" onClick={() => reload()}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {loading ? (
        <TableLoadingSkeleton cols={cols} />
      ) : tab === 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={tableScrollSx(compact)}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={stickyHeadCellSx()}>Student</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Programme</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Term</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Status</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Enrolled</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pathRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                    <EmptyState message="No pathway enrollments found." />
                  </TableCell>
                </TableRow>
              ) : pathRows.map((r) => (
                <TableRow key={r.enrollment_id}>
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
                      to={`/courses?view=programmes&expand=${encodeURIComponent(r.programme.programme_code)}`}
                      variant="body2"
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {r.programme.programme_name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cp}>{r.term_code}</TableCell>
                  <TableCell sx={cp}>{statusChip(r.enroll_status)}</TableCell>
                  <TableCell sx={cp}>{r.enrollment_date}</TableCell>
                  <TableCell sx={cp}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditPath(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeletePathRow(r)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={pathTotal}
            page={page}
            onPageChange={(_, p) => { setLoading(true); setPage(p) }}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setLoading(true); setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={tableScrollSx(compact)}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={stickyHeadCellSx()}>Student</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Module</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Term</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Status</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Enrolled</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {modRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                    <EmptyState message="No module enrollments found." />
                  </TableCell>
                </TableRow>
              ) : modRows.map((r) => (
                <TableRow key={r.enrollment_id}>
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
                  <TableCell sx={cp}>{statusChip(r.enroll_status)}</TableCell>
                  <TableCell sx={cp}>{r.enrollment_date}</TableCell>
                  <TableCell sx={cp}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditMod(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteModRow(r)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={modTotal}
            page={page}
            onPageChange={(_, p) => { setLoading(true); setPage(p) }}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setLoading(true); setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>
      )}

      {/* Add Enrollment dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add {tab === 0 ? 'Pathway' : 'Module'} Enrollment</DialogTitle>
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
            {tab === 0 ? (
              <FormControl fullWidth size="small">
                <InputLabel>Programme</InputLabel>
                <Select label="Programme" value={addForm.programme_code} onChange={(e) => setAddForm(f => ({ ...f, programme_code: e.target.value }))}>
                  {programmes.map((p) => (
                    <MenuItem key={p.programme_code} value={p.programme_code}>
                      {p.programme_name} ({p.programme_code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
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
            )}
            <TextField
              label="Term Code"
              size="small"
              value={addForm.term_code}
              onChange={(e) => setAddForm(f => ({ ...f, term_code: e.target.value }))}
              helperText="e.g. 20241"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={addForm.enroll_status} onChange={(e) => setAddForm(f => ({ ...f, enroll_status: e.target.value }))}>
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Enrollment Date"
              size="small"
              type="date"
              value={addForm.enrollment_date}
              onChange={(e) => setAddForm(f => ({ ...f, enrollment_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={addSubmitting || !addValid}>Add</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Enrollment dialog */}
      <Dialog open={editOpen} onClose={() => { setEditPathRow(null); setEditModRow(null) }} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Enrollment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            {editPathRow && (
              <Typography variant="body2" color="text.secondary">
                {editPathRow.student.first_name} {editPathRow.student.last_name} — {editPathRow.programme.programme_name}
              </Typography>
            )}
            {editModRow && (
              <Typography variant="body2" color="text.secondary">
                {editModRow.student.first_name} {editModRow.student.last_name} — {editModRow.module.module_name}
              </Typography>
            )}
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={editForm.enroll_status} onChange={(e) => setEditForm(f => ({ ...f, enroll_status: e.target.value }))}>
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Completion Date"
              size="small"
              type="date"
              value={editForm.completion_date}
              onChange={(e) => setEditForm(f => ({ ...f, completion_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              helperText="Optional"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditPathRow(null); setEditModRow(null) }}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={editSubmitting}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onClose={() => { setDeletePathRow(null); setDeleteModRow(null) }} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Enrollment?</DialogTitle>
        <DialogContent>
          <Typography>Remove enrollment of <strong>{deleteLabel}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeletePathRow(null); setDeleteModRow(null) }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteSubmitting}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
