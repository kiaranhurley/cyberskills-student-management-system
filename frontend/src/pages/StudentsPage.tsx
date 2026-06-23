import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  Stack,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CloseIcon from '@mui/icons-material/Close'
import { api } from '../api/client'
import { useCompactMode } from '../context/useCompactMode'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import { compactCellPadding, stickyHeadCellSx, tableScrollSx } from '../components/tableSx'
import type {
  Module as CourseModule,
  Paginated,
  Programme as CourseProgramme,
  Student,
  StudentProgram,
  StudentModule,
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

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StudentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { compact } = useCompactMode()

  const [rows, setRows] = useState<Student[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [searchDebounced, setSearchDebounced] = useState(() => searchParams.get('search') ?? '')
  const [programmeCodeFilter, setProgrammeCodeFilter] = useState(() => searchParams.get('programme_code') ?? '')
  const [moduleCodeFilter, setModuleCodeFilter] = useState(() => searchParams.get('module_code') ?? '')
  const [enrollmentYearFilter, setEnrollmentYearFilter] = useState(() => searchParams.get('enrollment_year') ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [programs, setPrograms] = useState<StudentProgram[]>([])
  const [modules, setModules] = useState<StudentModule[]>([])
  const [results, setResults] = useState<StudentResult[]>([])
  const [programmeOptions, setProgrammeOptions] = useState<string[]>([])
  const [moduleOptions, setModuleOptions] = useState<string[]>([])
  const [yearOptions, setYearOptions] = useState<string[]>([])

  useEffect(() => {
    const stu = searchParams.get('student')
    if (stu) {
      navigate(`/students/${encodeURIComponent(stu)}`, { replace: true })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (search) next.set('search', search)
          else next.delete('search')
          next.delete('student_id')
          if (programmeCodeFilter) next.set('programme_code', programmeCodeFilter)
          else next.delete('programme_code')
          if (moduleCodeFilter) next.set('module_code', moduleCodeFilter)
          else next.delete('module_code')
          if (enrollmentYearFilter) next.set('enrollment_year', enrollmentYearFilter)
          else next.delete('enrollment_year')
          return next
        },
        { replace: true },
      )
    }, 400)
    return () => clearTimeout(t)
  }, [search, programmeCodeFilter, moduleCodeFilter, enrollmentYearFilter, setSearchParams])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Paginated<Student>>('/api/students/students/', {
        params: {
          page: page + 1,
          page_size: rowsPerPage,
          search: searchDebounced || undefined,
          programme_code: programmeCodeFilter || undefined,
          module_code: moduleCodeFilter || undefined,
          enrollment_year: enrollmentYearFilter || undefined,
        },
      })
      setRows(data.results)
      setTotal(data.count)
    } catch {
      setError('Failed to load students.')
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, searchDebounced, programmeCodeFilter, moduleCodeFilter, enrollmentYearFilter])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    let cancelled = false
    async function loadFilterOptions() {
      try {
        const [pRes, mRes] = await Promise.all([
          api.get<Paginated<CourseProgramme>>('/api/courses/programmes/', { params: { page_size: 500 } }),
          api.get<Paginated<CourseModule>>('/api/courses/modules/', { params: { page_size: 500 } }),
        ])
        if (cancelled) return
        setProgrammeOptions(
          pRes.data.results.map((r) => r.programme_code).filter(Boolean).sort((a, b) => a.localeCompare(b)),
        )
        setModuleOptions(
          mRes.data.results.map((r) => r.module_code).filter(Boolean).sort((a, b) => a.localeCompare(b)),
        )
      } catch {
        // Keep filters usable even if options fail to load.
      }
    }
    void loadFilterOptions()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadEnrollmentYears() {
      try {
        const { data } = await api.get<{ years: number[] }>('/api/students/students/enrollment-years/')
        if (cancelled) return
        setYearOptions((data.years ?? []).map((y) => String(y)))
      } catch {
        // Leave empty; users can still use other filters.
      }
    }
    void loadEnrollmentYears()
    return () => {
      cancelled = true
    }
  }, [])

  const openDetail = useCallback(
    async (studentId: string) => {
      if (expanded === studentId) {
        setExpanded(null)
        return
      }
      setExpanded(studentId)
      setDetailLoading(true)
      setPrograms([])
      setModules([])
      setResults([])
      try {
        const [p, m, r] = await Promise.all([
          api.get<Paginated<StudentProgram>>('/api/enrollments/student-programs/', {
            params: { student: studentId, page_size: 100 },
          }),
          api.get<Paginated<StudentModule>>('/api/enrollments/student-modules/', {
            params: { student: studentId, page_size: 100 },
          }),
          api.get<Paginated<StudentResult>>('/api/grades/student-results/', {
            params: { student: studentId, page_size: 100 },
          }),
        ])
        setPrograms(p.data.results)
        setModules(m.data.results)
        setResults(r.data.results)
      } catch {
        setError('Failed to load student details.')
      } finally {
        setDetailLoading(false)
      }
    },
    [expanded],
  )

  const cp = compactCellPadding(compact)
  const start = total === 0 ? 0 : page * rowsPerPage + 1
  const end = Math.min((page + 1) * rowsPerPage, total)

  return (
    <Box>
      <PageHeader
        title="Students"
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Students' }]}
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search by name"
          size="small"
          sx={{ minWidth: 260 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={programmeOptions}
          value={programmeCodeFilter || null}
          onChange={(_, v) => {
            setProgrammeCodeFilter(v ?? '')
            setPage(0)
          }}
          renderInput={(params) => <TextField {...params} placeholder="Filter by programme code" />}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          options={moduleOptions}
          value={moduleCodeFilter || null}
          onChange={(_, v) => {
            setModuleCodeFilter(v ?? '')
            setPage(0)
          }}
          renderInput={(params) => <TextField {...params} placeholder="Filter by module code" />}
        />
        <TextField
          select
          label="Enrolment year"
          size="small"
          sx={{ minWidth: 220 }}
          value={enrollmentYearFilter}
          onChange={(e) => {
            setEnrollmentYearFilter(e.target.value)
            setPage(0)
          }}
        >
          <MenuItem value="">All years</MenuItem>
          {yearOptions.map((year) => (
            <MenuItem key={year} value={year}>
              {year}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Showing {start}-{end} of {total}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} action={<Button size="small" onClick={loadList}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {loading ? (
        <TableLoadingSkeleton cols={6} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={tableScrollSx(compact)}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={48} sx={stickyHeadCellSx()} />
                <TableCell sx={stickyHeadCellSx()}>#</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Student ID</TableCell>
                <TableCell sx={stickyHeadCellSx()}>First name</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Last name</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Employer</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                const isOpen = expanded === row.student_id
                return (
                  <Fragment key={row.student_id}>
                    <TableRow sx={{ bgcolor: idx % 2 ? 'action.hover' : 'background.paper' }}>
                      <TableCell sx={cp}>
                        <IconButton
                          size="small"
                          onClick={() => void openDetail(row.student_id)}
                          aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                          aria-expanded={isOpen}
                          sx={{ minWidth: 44, minHeight: 44 }}
                        >
                          {isOpen ? <CloseIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={cp}>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={cp}>
                        {isOpen && detailLoading && <CircularProgress size={16} />}
                        <Typography
                          component={RouterLink}
                          to={`/students/${encodeURIComponent(row.student_id)}`}
                          variant="body2"
                          sx={{ fontWeight: 600, color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {row.student_id}
                        </Typography>
                      </TableCell>
                      <TableCell sx={cp}>
                        {row.first_name}
                      </TableCell>
                      <TableCell sx={cp}>{row.last_name}</TableCell>
                      <TableCell sx={cp}>{row.employer || '—'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: isOpen ? undefined : 0, ...cp }}>
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 1 }}>
                            {detailLoading ? (
                              <Box display="flex" justifyContent="center" py={2}>
                                <CircularProgress size={28} />
                              </Box>
                            ) : (
                              <Stack spacing={2}>
                                <Paper variant="outlined" sx={{ p: 1.5 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    Created: {formatTimestamp(row.date_created)} | Updated: {formatTimestamp(row.date_updated)}
                                  </Typography>
                                </Paper>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                                  {programs.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                      —
                                    </Typography>
                                  ) : (
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Programme code</TableCell>
                                          <TableCell>Programme</TableCell>
                                          <TableCell>Term</TableCell>
                                          <TableCell>Status</TableCell>
                                          <TableCell>Enrolled</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {programs.map((p) => (
                                          <TableRow key={p.enrollment_id}>
                                            <TableCell>{p.programme.programme_code}</TableCell>
                                            <TableCell>{p.programme.programme_name}</TableCell>
                                            <TableCell>{p.term_code}</TableCell>
                                            <TableCell>{statusChip(p.enroll_status)}</TableCell>
                                            <TableCell>{p.enrollment_date}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </Paper>
                                <Paper variant="outlined" sx={{ p: 2, flex: 2 }}>
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
                                          (r) =>
                                            r.module.module_code === m.module.module_code &&
                                            r.term_code === m.term_code,
                                        )
                                        return (
                                          <TableRow key={m.enrollment_id}>
                                            <TableCell>{m.module.module_code}</TableCell>
                                            <TableCell>{m.module.module_name}</TableCell>
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
                                              (m) =>
                                                m.module.module_code === r.module.module_code &&
                                                m.term_code === r.term_code,
                                            ),
                                        )
                                        .map((r) => (
                                          <TableRow key={r.result_id}>
                                            <TableCell>{r.module.module_code}</TableCell>
                                            <TableCell>{r.module.module_name}</TableCell>
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
                              </Stack>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>
      )}
    </Box>
  )
}
