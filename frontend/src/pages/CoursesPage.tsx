import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  Paper,
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
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useCompactMode } from '../context/useCompactMode'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import { compactCellPadding, stickyHeadCellSx, tableScrollSx } from '../components/tableSx'
import { downloadCsv } from '../utils/csv'
import type { Module, Paginated, Programme, ProgrammeModuleAssociation } from '../types/api'

interface PathwayCountsResponse {
  term_code: string | null
  counts: Record<string, number>
}
interface ModuleCountsResponse {
  term_code: string | null
  counts: Record<string, number>
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

function formatFee(fee: string | null | undefined): string {
  if (fee == null || fee === '') return '—'
  return `€${fee}`
}

function tabFromViewParam(view: string | null): number {
  return view === 'modules' ? 1 : 0
}

function viewParamFromTab(tab: number): 'programmes' | 'modules' {
  return tab === 1 ? 'modules' : 'programmes'
}

export function CoursesPage() {
  const { compact } = useCompactMode()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => tabFromViewParam(searchParams.get('view')))

  const [programRows, setProgramRows] = useState<Programme[]>([])
  const [programTotal, setProgramTotal] = useState(0)
  const [programPage, setProgramPage] = useState(0)
  const [programRowsPerPage, setProgramRowsPerPage] = useState(50)
  const [programSearch, setProgramSearch] = useState('')
  const [programSearchDebounced, setProgramSearchDebounced] = useState('')
  const [programStudentFilter, setProgramStudentFilter] = useState('')
  const [programLoading, setProgramLoading] = useState(true)

  const [moduleRows, setModuleRows] = useState<Module[]>([])
  const [moduleTotal, setModuleTotal] = useState(0)
  const [modulePage, setModulePage] = useState(0)
  const [moduleRowsPerPage, setModuleRowsPerPage] = useState(50)
  const [moduleSearch, setModuleSearch] = useState('')
  const [moduleSearchDebounced, setModuleSearchDebounced] = useState('')
  const [moduleStudentFilter, setModuleStudentFilter] = useState('')
  const [moduleLoading, setModuleLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [assocLoading, setAssocLoading] = useState(false)
  const [associations, setAssociations] = useState<ProgrammeModuleAssociation[]>([])

  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [moduleStudentCounts, setModuleStudentCounts] = useState<Record<string, number>>({})

  // Code to auto-expand when navigating from a cross-link (?expand=CODE)
  const [pendingExpand, setPendingExpand] = useState(() => searchParams.get('expand') ?? '')

  useEffect(() => {
    const t = setTimeout(() => setProgramSearchDebounced(programSearch), 400)
    return () => clearTimeout(t)
  }, [programSearch])

  useEffect(() => {
    const t = setTimeout(() => setModuleSearchDebounced(moduleSearch), 400)
    return () => clearTimeout(t)
  }, [moduleSearch])

  useEffect(() => {
    const nextTab = tabFromViewParam(searchParams.get('view'))
    if (nextTab !== tab) setTab(nextTab)
    const nextExpand = searchParams.get('expand') ?? ''
    if (nextExpand) setPendingExpand(nextExpand)
  }, [searchParams, tab])

  const loadProgrammes = useCallback(async () => {
    setProgramLoading(true)
    setError(null)
    try {
      const [{ data }, countsRes] = await Promise.all([
        api.get<Paginated<Programme>>('/api/courses/programmes/', {
          params: {
            page: programPage + 1,
            page_size: programRowsPerPage,
            search: programSearchDebounced || undefined,
            student_id: programStudentFilter || undefined,
          },
        }),
        api.get<PathwayCountsResponse>('/api/courses/programmes/pathway-enrollment-counts/', {
          params: {
            student_id: programStudentFilter || undefined,
          },
        }),
      ])
      setProgramRows(data.results)
      setProgramTotal(data.count)
      setStudentCounts(countsRes.data.counts)
    } catch {
      setError('Failed to load programmes.')
    } finally {
      setProgramLoading(false)
    }
  }, [programPage, programRowsPerPage, programSearchDebounced, programStudentFilter])

  useEffect(() => {
    if (tab === 0) void loadProgrammes()
  }, [loadProgrammes, tab])

  const loadModules = useCallback(async () => {
    setModuleLoading(true)
    setError(null)
    try {
      const [{ data }, countsRes] = await Promise.all([
        api.get<Paginated<Module>>('/api/courses/modules/', {
          params: {
            page: modulePage + 1,
            page_size: moduleRowsPerPage,
            search: moduleSearchDebounced || undefined,
            student_id: moduleStudentFilter || undefined,
          },
        }),
        api.get<ModuleCountsResponse>('/api/courses/modules/enrollment-counts/', {
          params: {
            student_id: moduleStudentFilter || undefined,
          },
        }),
      ])
      setModuleRows(data.results)
      setModuleTotal(data.count)
      setModuleStudentCounts(countsRes.data.counts)
    } catch {
      setError('Failed to load modules.')
    } finally {
      setModuleLoading(false)
    }
  }, [modulePage, moduleRowsPerPage, moduleSearchDebounced, moduleStudentFilter])

  useEffect(() => {
    if (tab === 1) void loadModules()
  }, [loadModules, tab])

  const openProgrammeDetail = useCallback(
    async (code: string) => {
      if (expandedProgram === code) {
        setExpandedProgram(null)
        return
      }
      setExpandedProgram(code)
      setAssocLoading(true)
      setAssociations([])
      try {
        const { data } = await api.get<Paginated<ProgrammeModuleAssociation>>(
          '/api/courses/programme-module-associations/',
          { params: { programme: code, page_size: 200 } },
        )
        setAssociations(data.results)
      } catch {
        setError('Failed to load modules.')
      } finally {
        setAssocLoading(false)
      }
    },
    [expandedProgram],
  )

  const openModuleDetail = useCallback(
    async (code: string) => {
      if (expandedModule === code) {
        setExpandedModule(null)
        return
      }
      setExpandedModule(code)
      setAssocLoading(true)
      setAssociations([])
      try {
        const { data } = await api.get<Paginated<ProgrammeModuleAssociation>>(
          '/api/courses/programme-module-associations/',
          { params: { module: code, page_size: 200 } },
        )
        setAssociations(data.results)
      } catch {
        setError('Failed to load programmes.')
      } finally {
        setAssocLoading(false)
      }
    },
    [expandedModule],
  )

  // Auto-expand when arriving from a cross-link (?expand=CODE)
  useEffect(() => {
    if (tab !== 0 || !pendingExpand || programLoading) return
    const match = programRows.find((r) => r.programme_code === pendingExpand)
    if (match) {
      setPendingExpand('')
      void openProgrammeDetail(match.programme_code)
    }
  }, [programRows, programLoading, tab, pendingExpand, openProgrammeDetail])

  useEffect(() => {
    if (tab !== 1 || !pendingExpand || moduleLoading) return
    const match = moduleRows.find((r) => r.module_code === pendingExpand)
    if (match) {
      setPendingExpand('')
      void openModuleDetail(match.module_code)
    }
  }, [moduleRows, moduleLoading, tab, pendingExpand, openModuleDetail])

  const cp = compactCellPadding(compact)
  const activeLoading = tab === 0 ? programLoading : moduleLoading
  const tableCols = 9

  function exportCsv() {
    if (tab === 0) {
      downloadCsv('programmes.csv',
        ['Programme Code', 'Programme Name', 'Credits', 'Fee', 'Lecturer', 'Lecturer Email', 'Students'],
        programRows.map((r) => [
          r.programme_code, r.programme_name, r.credits ?? '', formatFee(r.fee),
          r.lecturer_name || '', r.lecturer_email || '', studentCounts[r.programme_code] ?? 0,
        ]),
      )
    } else {
      downloadCsv('modules.csv',
        ['Module Code', 'Module Name', 'Credits', 'Fee', 'Lecturer', 'Lecturer Email', 'Students'],
        moduleRows.map((r) => [
          r.module_code, r.module_name, r.credits ?? '', formatFee(r.fee),
          r.lecturer_name || '', r.lecturer_email || '', moduleStudentCounts[r.module_code] ?? 0,
        ]),
      )
    }
  }

  return (
    <Box>
      <PageHeader
        title="Courses"
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Courses' }]}
        actions={
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportCsv}
            disabled={tab === 0 ? programRows.length === 0 : moduleRows.length === 0}
          >
            Export CSV
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v)
          const next = new URLSearchParams(searchParams)
          next.set('view', viewParamFromTab(v))
          setSearchParams(next, { replace: true })
          setError(null)
          setAssociations([])
          setExpandedProgram(null)
          setExpandedModule(null)
        }}
        sx={{ mb: 2 }}
      >
        <Tab label="Programmes" />
        <Tab label="Modules" />
      </Tabs>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          placeholder={tab === 0 ? 'Search by programme code/name' : 'Search by module code/name'}
          size="small"
          sx={{ minWidth: 280 }}
          value={tab === 0 ? programSearch : moduleSearch}
          onChange={(e) => {
            if (tab === 0) {
              setProgramSearch(e.target.value)
              setProgramPage(0)
            } else {
              setModuleSearch(e.target.value)
              setModulePage(0)
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          placeholder="Filter by student ID"
          size="small"
          sx={{ minWidth: 220 }}
          value={tab === 0 ? programStudentFilter : moduleStudentFilter}
          onChange={(e) => {
            const value = e.target.value.toUpperCase()
            if (tab === 0) {
              setProgramStudentFilter(value)
              setProgramPage(0)
            } else {
              setModuleStudentFilter(value)
              setModulePage(0)
            }
          }}
        />
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      {activeLoading ? (
        <TableLoadingSkeleton cols={tableCols} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={tableScrollSx(compact)}>
          <Table size="small">
            {tab === 0 ? (
              <>
                <TableHead>
                  <TableRow>
                    <TableCell width={48} sx={stickyHeadCellSx()} />
                    <TableCell sx={stickyHeadCellSx()}>#</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Course code</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Course name</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Credits</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Students</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Fee</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Lecturer</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Lecturer email</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {programRows.map((row, idx) => {
                    const isOpen = expandedProgram === row.programme_code
                    return (
                      <Fragment key={row.programme_code}>
                        <TableRow sx={{ bgcolor: idx % 2 ? 'action.hover' : 'background.paper' }}>
                          <TableCell sx={cp}>
                            <IconButton
                              size="small"
                              onClick={() => void openProgrammeDetail(row.programme_code)}
                              aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                              aria-expanded={isOpen}
                              sx={{ minWidth: 44, minHeight: 44 }}
                            >
                              {isOpen ? <CloseIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={cp}>{programPage * programRowsPerPage + idx + 1}</TableCell>
                          <TableCell sx={cp}>
                            <Typography variant="body2" fontWeight={600}>
                              {row.programme_code}
                            </Typography>
                          </TableCell>
                          <TableCell sx={cp}>{row.programme_name}</TableCell>
                          <TableCell sx={cp}>{row.credits ?? '—'}</TableCell>
                          <TableCell sx={cp}>
                            <Typography
                              component={RouterLink}
                              to={`/students?programme_code=${encodeURIComponent(row.programme_code)}`}
                              variant="body2"
                              sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {studentCounts[row.programme_code] ?? 0}
                            </Typography>
                          </TableCell>
                          <TableCell sx={cp}>{formatFee(row.fee)}</TableCell>
                          <TableCell sx={cp}>{row.lecturer_name || '—'}</TableCell>
                          <TableCell sx={cp}>{row.lecturer_email || '—'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={9} sx={{ py: 0, borderBottom: isOpen ? undefined : 0, ...cp }}>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 2, px: 1 }}>
                                {assocLoading ? (
                                  <Box display="flex" justifyContent="center" py={2}>
                                    <CircularProgress size={28} />
                                  </Box>
                                ) : (
                                  <>
                                    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        Created: {formatTimestamp(row.created_at)} | Updated: {formatTimestamp(row.updated_at)}
                                      </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                      <Table size="small">
                                        <TableHead>
                                          <TableRow>
                                            <TableCell>Module code</TableCell>
                                            <TableCell>Module name</TableCell>
                                            <TableCell>Credits</TableCell>
                                            <TableCell>Fee</TableCell>
                                            <TableCell>Lecturer</TableCell>
                                            <TableCell>Lecturer email</TableCell>
                                            <TableCell>Semester</TableCell>
                                            <TableCell>Block</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {associations.map((a) => (
                                            <TableRow key={a.id}>
                                              <TableCell>
                                                <Typography
                                                  component={RouterLink}
                                                  to={`/courses?view=modules&expand=${encodeURIComponent(a.module.module_code)}`}
                                                  variant="body2"
                                                  sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                                >
                                                  {a.module.module_code}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Typography
                                                  component={RouterLink}
                                                  to={`/courses?view=modules&expand=${encodeURIComponent(a.module.module_code)}`}
                                                  variant="body2"
                                                  sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                                >
                                                  {a.module.module_name}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>{a.module.credits ?? '—'}</TableCell>
                                              <TableCell>{formatFee(a.module.fee)}</TableCell>
                                              <TableCell>{a.module.lecturer_name || '—'}</TableCell>
                                              <TableCell>{a.module.lecturer_email || '—'}</TableCell>
                                              <TableCell>{a.semester ?? '—'}</TableCell>
                                              <TableCell>{a.block || '—'}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                      {associations.length === 0 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                          —
                                        </Typography>
                                      )}
                                    </Paper>
                                  </>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    )
                  })}
                </TableBody>
              </>
            ) : (
              <>
                <TableHead>
                  <TableRow>
                    <TableCell width={48} sx={stickyHeadCellSx()} />
                    <TableCell sx={stickyHeadCellSx()}>#</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Module code</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Module name</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Students</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Credits</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Fee</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Lecturer</TableCell>
                    <TableCell sx={stickyHeadCellSx()}>Lecturer email</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {moduleRows.map((row, idx) => {
                    const isOpen = expandedModule === row.module_code
                    return (
                      <Fragment key={row.module_code}>
                        <TableRow sx={{ bgcolor: idx % 2 ? 'action.hover' : 'background.paper' }}>
                          <TableCell sx={cp}>
                            <IconButton
                              size="small"
                              onClick={() => void openModuleDetail(row.module_code)}
                              aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                              aria-expanded={isOpen}
                              sx={{ minWidth: 44, minHeight: 44 }}
                            >
                              {isOpen ? <CloseIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={cp}>{modulePage * moduleRowsPerPage + idx + 1}</TableCell>
                          <TableCell sx={cp}>{row.module_code}</TableCell>
                          <TableCell sx={cp}>{row.module_name}</TableCell>
                          <TableCell sx={cp}>
                            <Typography
                              component={RouterLink}
                              to={`/students?module_code=${encodeURIComponent(row.module_code)}`}
                              variant="body2"
                              sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {moduleStudentCounts[row.module_code] ?? 0}
                            </Typography>
                          </TableCell>
                          <TableCell sx={cp}>{row.credits ?? '—'}</TableCell>
                          <TableCell sx={cp}>{formatFee(row.fee)}</TableCell>
                          <TableCell sx={cp}>{row.lecturer_name || '—'}</TableCell>
                          <TableCell sx={cp}>{row.lecturer_email || '—'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={9} sx={{ py: 0, borderBottom: isOpen ? undefined : 0, ...cp }}>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box sx={{ py: 2, px: 1 }}>
                                {assocLoading ? (
                                  <Box display="flex" justifyContent="center" py={2}>
                                    <CircularProgress size={28} />
                                  </Box>
                                ) : (
                                  <>
                                    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        Created: {formatTimestamp(row.created_at)} | Updated: {formatTimestamp(row.updated_at)}
                                      </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                      <Table size="small">
                                        <TableHead>
                                          <TableRow>
                                            <TableCell>Programme code</TableCell>
                                            <TableCell>Programme name</TableCell>
                                            <TableCell>Semester</TableCell>
                                            <TableCell>Block</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {associations.map((a) => (
                                            <TableRow key={a.id}>
                                              <TableCell>
                                                <Typography
                                                  component={RouterLink}
                                                  to={`/courses?view=programmes&expand=${encodeURIComponent(a.programme.programme_code)}`}
                                                  variant="body2"
                                                  sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                                >
                                                  {a.programme.programme_code}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Typography
                                                  component={RouterLink}
                                                  to={`/courses?view=programmes&expand=${encodeURIComponent(a.programme.programme_code)}`}
                                                  variant="body2"
                                                  sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                                >
                                                  {a.programme.programme_name}
                                                </Typography>
                                              </TableCell>
                                              <TableCell>{a.semester ?? '—'}</TableCell>
                                              <TableCell>{a.block || '—'}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                      {associations.length === 0 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                          —
                                        </Typography>
                                      )}
                                    </Paper>
                                  </>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    )
                  })}
                </TableBody>
              </>
            )}
          </Table>
          <TablePagination
            component="div"
            count={tab === 0 ? programTotal : moduleTotal}
            page={tab === 0 ? programPage : modulePage}
            onPageChange={(_, p) => {
              if (tab === 0) setProgramPage(p)
              else setModulePage(p)
            }}
            rowsPerPage={tab === 0 ? programRowsPerPage : moduleRowsPerPage}
            onRowsPerPageChange={(e) => {
              if (tab === 0) {
                setProgramRowsPerPage(parseInt(e.target.value, 10))
                setProgramPage(0)
              } else {
                setModuleRowsPerPage(parseInt(e.target.value, 10))
                setModulePage(0)
              }
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </TableContainer>
      )}
    </Box>
  )
}

