import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
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
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CloseIcon from '@mui/icons-material/Close'
import { api } from '../api/client'
import { useCompactMode } from '../context/useCompactMode'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import { compactCellPadding, stickyHeadCellSx, tableScrollSx } from '../components/tableSx'
import { downloadCsv } from '../utils/csv'
import type { Paginated, Programme, ProgrammeModuleAssociation } from '../types/api'

interface PathwayCountsResponse {
  term_code: string | null
  counts: Record<string, number>
}

export function ProgrammesPage() {
  const { compact } = useCompactMode()
  const [rows, setRows] = useState<Programme[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [assocLoading, setAssocLoading] = useState(false)
  const [associations, setAssociations] = useState<ProgrammeModuleAssociation[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({})
  const [terms, setTerms] = useState<string[]>([])
  const [countTerm, setCountTerm] = useState<string>('')

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    api
      .get<{ terms: string[] }>('/api/enrollments/enrollment-terms/')
      .then((r) => setTerms(r.data.terms))
      .catch(() => {})
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data }, countsRes] = await Promise.all([
        api.get<Paginated<Programme>>('/api/courses/programmes/', {
          params: {
            page: page + 1,
            page_size: rowsPerPage,
            search: searchDebounced || undefined,
          },
        }),
        api.get<PathwayCountsResponse>('/api/courses/programmes/pathway-enrollment-counts/', {
          params: countTerm ? { term_code: countTerm } : {},
        }),
      ])
      setRows(data.results)
      setTotal(data.count)
      setStudentCounts(countsRes.data.counts)
      if (!countTerm && countsRes.data.term_code) {
        setCountTerm(countsRes.data.term_code)
      }
    } catch {
      setError('Failed to load programmes.')
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, searchDebounced, countTerm])

  useEffect(() => {
    loadList()
  }, [loadList])

  const openDetail = useCallback(
    async (code: string) => {
      if (expanded === code) {
        setExpanded(null)
        return
      }
      setExpanded(code)
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
    [expanded],
  )

  const handleTermChange = (e: SelectChangeEvent<string>) => {
    setCountTerm(e.target.value)
    setPage(0)
  }

  const exportCsv = () => {
    downloadCsv(
      'programmes',
      ['#', 'Code', 'Name', 'Credits', 'Students (pathway, term)'],
      rows.map((row, idx) => [
        page * rowsPerPage + idx + 1,
        row.programme_code,
        row.programme_name,
        row.credits ?? '',
        studentCounts[row.programme_code] ?? 0,
      ]),
    )
  }

  const cp = compactCellPadding(compact)

  return (
    <Box>
      <PageHeader
        title="Programmes"
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Programmes' }]}
        actions={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 160 }} disabled={!terms.length}>
              <InputLabel id="term-count-label">Term (counts)</InputLabel>
              <Select
                labelId="term-count-label"
                label="Term (counts)"
                value={terms.includes(countTerm) ? countTerm : countTerm === '' ? '' : terms[0] ?? ''}
                onChange={handleTermChange}
              >
                <MenuItem value="">
                  <em>Latest (default)</em>
                </MenuItem>
                {terms.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
          </Box>
        }
      />
      <TextField
        placeholder="Search"
        size="small"
        sx={{ mb: 2, minWidth: 280 }}
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
      {error && (
        <Typography color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
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
                <TableCell sx={stickyHeadCellSx()}>Programme</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Credits</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Semesters</TableCell>
                <TableCell sx={stickyHeadCellSx()}>Students</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                const isOpen = expanded === row.programme_code
                return (
                  <Fragment key={row.programme_code}>
                    <TableRow sx={{ bgcolor: idx % 2 ? 'action.hover' : 'background.paper' }}>
                      <TableCell sx={cp}>
                        <IconButton
                          size="small"
                          onClick={() => void openDetail(row.programme_code)}
                          aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                          aria-expanded={isOpen}
                          sx={{ minWidth: 44, minHeight: 44 }}
                        >
                          {isOpen ? <CloseIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={cp}>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell sx={cp}>
                        <Typography variant="body2" fontWeight={600}>
                          {row.programme_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.programme_code}
                        </Typography>
                      </TableCell>
                      <TableCell sx={cp}>{row.credits ?? '—'}</TableCell>
                      <TableCell sx={cp}>
                        {isOpen
                          ? associations.length === 0
                            ? '—'
                            : new Set(associations.map((a) => a.semester).filter((s) => s != null)).size
                          : '—'}
                      </TableCell>
                      <TableCell sx={cp}>{studentCounts[row.programme_code] ?? '—'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: isOpen ? undefined : 0, ...cp }}>
                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 1 }}>
                            {assocLoading ? (
                              <Box display="flex" justifyContent="center" py={2}>
                                <CircularProgress size={28} />
                              </Box>
                            ) : (
                              <Paper variant="outlined" sx={{ p: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Module</TableCell>
                                      <TableCell>Code</TableCell>
                                      <TableCell>Semester</TableCell>
                                      <TableCell>Block</TableCell>
                                      <TableCell>Credits</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {associations.map((a) => (
                                      <TableRow key={a.id}>
                                        <TableCell>{a.module.module_name}</TableCell>
                                        <TableCell>{a.module.module_code}</TableCell>
                                        <TableCell>{a.semester ?? '—'}</TableCell>
                                        <TableCell>{a.block || '—'}</TableCell>
                                        <TableCell>{a.module.credits ?? '—'}</TableCell>
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
