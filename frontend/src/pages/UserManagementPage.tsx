import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import LockResetIcon from '@mui/icons-material/LockReset'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import { api } from '../api/client'
import { useCompactMode } from '../context/useCompactMode'
import { useAuth } from '../context/AuthContext'
import { useSnackbar } from '../context/SnackbarContext'
import { PageHeader } from '../components/PageHeader'
import { TableLoadingSkeleton } from '../components/TableLoadingSkeleton'
import { EmptyState } from '../components/EmptyState'
import { tableScrollSx, stickyHeadCellSx, compactCellPadding } from '../components/tableSx'
import type { Paginated, User, Module } from '../types/api'

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  ADMIN: 'error',
  LECTURER: 'warning',
  STUDENT: 'info',
}

type NewUserForm = {
  username: string
  email: string
  password: string
  first_name: string
  last_name: string
  role: string
}

type LecturerAssignment = {
  id: number
  module_code_id: string
  module_name: string
  term_code: string
}

const EMPTY_FORM: NewUserForm = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: 'STUDENT',
}

export function UserManagementPage() {
  const { compact } = useCompactMode()
  const { user: currentUser } = useAuth()
  const { showSuccess, showError } = useSnackbar()
  const cp = compactCellPadding(compact)
  const headSx = stickyHeadCellSx()

  const [users, setUsers] = useState<User[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)

  const [roleUser, setRoleUser] = useState<User | null>(null)
  const [roleAction, setRoleAction] = useState<'assign' | 'remove'>('assign')
  const [selectedRole, setSelectedRole] = useState('LECTURER')
  const [roleSubmitting, setRoleSubmitting] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)

  const [assignUser, setAssignUser] = useState<User | null>(null)
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [newModuleCode, setNewModuleCode] = useState('')
  const [newTermCode, setNewTermCode] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignLoading, setAssignLoading] = useState(false)

  // Edit user
  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ username: '', email: '', first_name: '', last_name: '' })
  const [editError, setEditError] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Password reset
  const [pwUser, setPwUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  // Delete user
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = {
        page: page + 1,
        page_size: rowsPerPage,
      }
      if (search) params.search = search
      const { data } = await api.get<Paginated<User>>('/api/auth/users/', { params })
      setUsers(data.results)
      setCount(data.count)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => {
    api.get<Paginated<Module>>('/api/courses/modules/', { params: { page_size: 500 } })
      .then(({ data }) => setModules(data.results))
      .catch(() => {})
  }, [])

  async function handleCreate() {
    setFormSubmitting(true)
    setFormError(null)
    try {
      await api.post('/api/auth/users/', form)
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      fetchUsers()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; username?: string[]; email?: string[] } } }
      const d = e?.response?.data
      setFormError(d?.detail ?? d?.username?.[0] ?? d?.email?.[0] ?? 'Failed to create user.')
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleRoleSubmit() {
    if (!roleUser) return
    setRoleSubmitting(true)
    setRoleError(null)
    try {
      const endpoint = roleAction === 'assign' ? 'assign-role' : 'remove-role'
      await api.post(`/api/auth/users/${roleUser.id}/${endpoint}/`, { role: selectedRole })
      setRoleUser(null)
      fetchUsers()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setRoleError(e?.response?.data?.error ?? 'Failed to update role.')
    } finally {
      setRoleSubmitting(false)
    }
  }

  async function openAssignments(user: User) {
    setAssignUser(user)
    setAssignError(null)
    setAssignLoading(true)
    try {
      const { data } = await api.get<LecturerAssignment[]>(`/api/auth/users/${user.id}/lecturer-assignments/`)
      setAssignments(data)
    } catch {
      setAssignError('Failed to load assignments.')
    } finally {
      setAssignLoading(false)
    }
  }

  async function handleAddAssignment() {
    if (!assignUser || !newModuleCode || !newTermCode) return
    setAssignError(null)
    try {
      const { data } = await api.post<LecturerAssignment>(
        `/api/auth/users/${assignUser.id}/lecturer-assignments/`,
        { module_code: newModuleCode, term_code: newTermCode },
      )
      setAssignments((prev) => [...prev, data])
      setNewModuleCode('')
      setNewTermCode('')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { non_field_errors?: string[]; module_code?: string[] } } }
      const d = e?.response?.data
      setAssignError(d?.non_field_errors?.[0] ?? d?.module_code?.[0] ?? 'Failed to add assignment.')
    }
  }

  async function handleDeleteAssignment(id: number) {
    if (!assignUser) return
    try {
      await api.delete(`/api/auth/users/${assignUser.id}/lecturer-assignments/${id}/`)
      setAssignments((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setAssignError('Failed to remove assignment.')
    }
  }

  function openEdit(u: User) {
    setEditUser(u)
    setEditForm({ username: u.username, email: u.email, first_name: u.first_name, last_name: u.last_name })
    setEditError(null)
  }

  async function handleEditSubmit() {
    if (!editUser) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      await api.patch(`/api/auth/users/${editUser.id}/`, editForm)
      setEditUser(null)
      showSuccess('User updated.')
      fetchUsers()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; username?: string[]; email?: string[] } } }
      const d = e?.response?.data
      setEditError(d?.detail ?? d?.username?.[0] ?? d?.email?.[0] ?? 'Failed to update user.')
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleSetPassword() {
    if (!pwUser) return
    setPwSubmitting(true)
    setPwError(null)
    try {
      await api.post(`/api/auth/users/${pwUser.id}/set-password/`, { password: newPassword })
      setPwUser(null)
      setNewPassword('')
      showSuccess('Password updated.')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setPwError(e?.response?.data?.error ?? 'Failed to update password.')
    } finally {
      setPwSubmitting(false)
    }
  }

  async function handleDeleteUser() {
    if (!deleteUser) return
    setDeleteSubmitting(true)
    try {
      await api.delete(`/api/auth/users/${deleteUser.id}/`)
      setDeleteUser(null)
      showSuccess('User deleted.')
      fetchUsers()
    } catch {
      showError('Failed to delete user.')
      setDeleteUser(null)
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title="User Management"
        crumbs={[{ label: 'User Management' }]}
        actions={
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => { setCreateOpen(true); setFormError(null); setForm(EMPTY_FORM) }}
          >
            New User
          </Button>
        }
      />

      <Paper elevation={1}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            size="small"
            placeholder="Search by name, username or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            sx={{ width: 340 }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ m: 2 }} action={<Button size="small" onClick={fetchUsers}>Retry</Button>}>
            {error}
          </Alert>
        )}

        <TableContainer sx={tableScrollSx(compact)}>
          <Table size={compact ? 'small' : 'medium'} stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Username</TableCell>
                <TableCell sx={headSx}>Name</TableCell>
                <TableCell sx={headSx}>Email</TableCell>
                <TableCell sx={headSx}>Roles</TableCell>
                <TableCell sx={headSx}>Joined</TableCell>
                <TableCell sx={headSx}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableLoadingSkeleton rows={rowsPerPage} cols={6} />
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                    <EmptyState message="No users found." />
                  </TableCell>
                </TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={cp}>{u.username}</TableCell>
                  <TableCell sx={cp}>
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                  </TableCell>
                  <TableCell sx={cp}>{u.email}</TableCell>
                  <TableCell sx={cp}>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {u.roles.length === 0
                        ? <Typography variant="caption" color="text.secondary">None</Typography>
                        : u.roles.map((r) => (
                          <Chip
                            key={r}
                            label={r}
                            size="small"
                            color={ROLE_COLORS[r] ?? 'default'}
                            variant="outlined"
                          />
                        ))}
                    </Stack>
                  </TableCell>
                  <TableCell sx={cp}>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  <TableCell sx={cp}>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      <Tooltip title="Assign role">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { setRoleUser(u); setRoleAction('assign'); setSelectedRole('LECTURER'); setRoleError(null) }}
                        >
                          +Role
                        </Button>
                      </Tooltip>
                      {u.roles.length > 0 && (
                        <Tooltip title="Remove role">
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => { setRoleUser(u); setRoleAction('remove'); setSelectedRole(u.roles[0]); setRoleError(null) }}
                          >
                            −Role
                          </Button>
                        </Tooltip>
                      )}
                      {u.roles.includes('LECTURER') && (
                        <Tooltip title="Manage module assignments">
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            onClick={() => openAssignments(u)}
                          >
                            Modules
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit user">
                        <IconButton size="small" onClick={() => openEdit(u)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reset password">
                        <IconButton size="small" color="warning" onClick={() => { setPwUser(u); setNewPassword(''); setPwError(null) }}>
                          <LockResetIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={u.id === currentUser?.id ? 'Cannot delete your own account' : 'Delete user'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={u.id === currentUser?.id}
                            onClick={() => setDeleteUser(u)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
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
          rowsPerPageOptions={[10, 25, 50]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
        />
      </Paper>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Stack gap={2} sx={{ mt: 1 }}>
            <Stack direction="row" gap={2}>
              <TextField
                label="First name"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Last name"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Username"
              required
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Password"
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              fullWidth
              helperText="Minimum 8 characters"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                label="Role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <MenuItem value="ADMIN">Administrator</MenuItem>
                <MenuItem value="LECTURER">Lecturer</MenuItem>
                <MenuItem value="STUDENT">Student</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={formSubmitting || !form.username || !form.email || !form.password}
          >
            {formSubmitting ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={Boolean(roleUser)} onClose={() => setRoleUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {roleAction === 'assign' ? 'Assign Role to' : 'Remove Role from'} {roleUser?.username}
        </DialogTitle>
        <DialogContent>
          {roleError && <Alert severity="error" sx={{ mb: 2 }}>{roleError}</Alert>}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <MenuItem value="ADMIN">Administrator</MenuItem>
              <MenuItem value="LECTURER">Lecturer</MenuItem>
              <MenuItem value="STUDENT">Student</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleUser(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={roleAction === 'assign' ? 'primary' : 'warning'}
            onClick={handleRoleSubmit}
            disabled={roleSubmitting}
          >
            {roleSubmitting ? 'Saving…' : roleAction === 'assign' ? 'Assign' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User — {editUser?.username}</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <Stack gap={2} sx={{ mt: 1 }}>
            <Stack direction="row" gap={2}>
              <TextField
                label="First name"
                value={editForm.first_name}
                onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Last name"
                value={editForm.last_name}
                onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Username"
              required
              value={editForm.username}
              onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              required
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleEditSubmit}
            disabled={editSubmitting || !editForm.username || !editForm.email}
          >
            {editSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!pwUser} onClose={() => setPwUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Password — {pwUser?.username}</DialogTitle>
        <DialogContent>
          {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
          <TextField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            helperText="Minimum 8 characters"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwUser(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleSetPassword}
            disabled={pwSubmitting || newPassword.length < 8}
          >
            {pwSubmitting ? 'Saving…' : 'Set Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUser} onClose={() => setDeleteUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete User?</DialogTitle>
        <DialogContent>
          <Typography>
            Permanently delete <strong>{deleteUser?.username}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteUser(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteUser} disabled={deleteSubmitting}>
            {deleteSubmitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lecturer Module Assignments Dialog */}
      <Dialog open={Boolean(assignUser)} onClose={() => setAssignUser(null)} maxWidth="md" fullWidth>
        <DialogTitle>Module Assignments — {assignUser?.username}</DialogTitle>
        <DialogContent>
          {assignError && <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert>}
          {assignLoading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Module Code</TableCell>
                      <TableCell>Module Name</TableCell>
                      <TableCell>Term Code</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                          No module assignments yet.
                        </TableCell>
                      </TableRow>
                    ) : assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.module_code_id}</TableCell>
                        <TableCell>{a.module_name}</TableCell>
                        <TableCell>{a.term_code}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => handleDeleteAssignment(a.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>Add Assignment</Typography>
              <Stack direction="row" gap={2} alignItems="flex-start">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Module</InputLabel>
                  <Select
                    label="Module"
                    value={newModuleCode}
                    onChange={(e) => setNewModuleCode(e.target.value)}
                  >
                    {modules.map((m) => (
                      <MenuItem key={m.module_code} value={m.module_code}>
                        {m.module_code} — {m.module_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="Term Code"
                  placeholder="e.g. 20241"
                  value={newTermCode}
                  onChange={(e) => setNewTermCode(e.target.value)}
                  sx={{ width: 140 }}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddAssignment}
                  disabled={!newModuleCode || !newTermCode}
                >
                  Add
                </Button>
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
