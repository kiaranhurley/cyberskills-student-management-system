import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
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
  Typography,
} from '@mui/material'
import { api } from '../api/client'
import { useCompactMode } from '../context/useCompactMode'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import { compactCellPadding, stickyHeadCellSx, tableScrollSx } from '../components/tableSx'
import type { Paginated } from '../types/api'

interface AuditLogEntry {
  id: number
  user: string | null
  action: string
  model_name: string
  object_id: string | null
  ip_address: string | null
  timestamp: string
  additional_info: string
}

const ACTION_COLORS: Record<string, 'success' | 'info' | 'error' | 'warning' | 'default'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'error',
  LOGIN: 'default',
  LOGOUT: 'default',
  READ: 'default',
}

const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']

export function AuditLogPage() {
  const { compact } = useCompactMode()
  const cp = compactCellPadding(compact)
  const headSx = stickyHeadCellSx()

  const [rows, setRows] = useState<AuditLogEntry[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [actionFilter, setActionFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [modelFilterDebounced, setModelFilterDebounced] = useState('')

  const rowsPerPage = 25

  useEffect(() => {
    const t = setTimeout(() => setModelFilterDebounced(modelFilter), 400)
    return () => clearTimeout(t)
  }, [modelFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Paginated<AuditLogEntry>>('/api/auth/audit-logs/', {
        params: {
          page: page + 1,
          page_size: rowsPerPage,
          action: actionFilter || undefined,
          model_name: modelFilterDebounced || undefined,
        },
      })
      setRows(data.results)
      setCount(data.count)
    } catch {
      setError('Failed to load audit log.')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, modelFilterDebounced])

  useEffect(() => { load() }, [load])

  return (
    <Box>
      <PageHeader title="Audit Log" crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Audit Log' }]} />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Action</InputLabel>
          <Select
            label="Action"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0) }}
          >
            <MenuItem value=""><em>All actions</em></MenuItem>
            {ACTIONS.map((a) => (
              <MenuItem key={a} value={a}>{a}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Model name"
          size="small"
          value={modelFilter}
          onChange={(e) => { setModelFilter(e.target.value); setPage(0) }}
          sx={{ minWidth: 200 }}
          placeholder="e.g. Student, Module"
        />
      </Stack>

      <Paper elevation={1}>
        <TableContainer sx={tableScrollSx(compact)}>
          <Table size={compact ? 'small' : 'medium'} stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Timestamp</TableCell>
                <TableCell sx={headSx}>User</TableCell>
                <TableCell sx={headSx}>Action</TableCell>
                <TableCell sx={headSx}>Model</TableCell>
                <TableCell sx={headSx}>Object ID</TableCell>
                <TableCell sx={headSx}>IP Address</TableCell>
                <TableCell sx={headSx}>Info</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableLoadingSkeleton rows={rowsPerPage} cols={7} />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No audit log entries found.
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={cp}>
                    <Typography variant="body2" noWrap>
                      {new Date(row.timestamp).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cp}>{row.user ?? '—'}</TableCell>
                  <TableCell sx={cp}>
                    <Chip
                      size="small"
                      label={row.action}
                      color={ACTION_COLORS[row.action] ?? 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={cp}>{row.model_name || '—'}</TableCell>
                  <TableCell sx={cp}>{row.object_id ?? '—'}</TableCell>
                  <TableCell sx={cp}>{row.ip_address ?? '—'}</TableCell>
                  <TableCell sx={cp}>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
                      {row.additional_info || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={count}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25]}
          onPageChange={(_, p) => setPage(p)}
        />
      </Paper>
    </Box>
  )
}
