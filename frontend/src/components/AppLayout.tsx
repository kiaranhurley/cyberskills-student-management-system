import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Divider,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import SchoolIcon from '@mui/icons-material/School'
import AssignmentIcon from '@mui/icons-material/Assignment'
import GradeIcon from '@mui/icons-material/Grade'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import BarChartIcon from '@mui/icons-material/BarChart'
import LogoutIcon from '@mui/icons-material/Logout'
import HistoryIcon from '@mui/icons-material/History'
import type { Theme } from '@mui/material/styles'
import { useAuth } from '../context/AuthContext'

const drawerWidth = 240

type Role = 'ADMIN' | 'LECTURER' | 'STUDENT'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const adminNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/students', label: 'Students', icon: <PeopleIcon /> },
  { path: '/programmes', label: 'Programmes', icon: <AccountTreeIcon /> },
  { path: '/courses', label: 'Modules', icon: <SchoolIcon /> },
  { path: '/enrollments', label: 'Enrollments', icon: <AssignmentIcon /> },
  { path: '/grades', label: 'Grades', icon: <GradeIcon /> },
  { path: '/reports', label: 'Reports', icon: <BarChartIcon /> },
  { path: '/users', label: 'User Management', icon: <ManageAccountsIcon /> },
  { path: '/audit-logs', label: 'Audit Log', icon: <HistoryIcon /> },
]

const lecturerNavItems: NavItem[] = [
  { path: '/lecturer', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/lecturer/modules', label: 'My Modules', icon: <SchoolIcon /> },
]

const studentNavItems: NavItem[] = [
  { path: '/my-dashboard', label: 'My Dashboard', icon: <DashboardIcon /> },
]

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrator',
  LECTURER: 'Lecturer',
  STUDENT: 'Student',
}

const roleColors: Record<Role, 'error' | 'warning' | 'info'> = {
  ADMIN: 'error',
  LECTURER: 'warning',
  STUDENT: 'info',
}

interface AppLayoutProps {
  role: Role
}

export function AppLayout({ role }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'User'

  const navItems =
    role === 'ADMIN' ? adminNavItems : role === 'LECTURER' ? lecturerNavItems : studentNavItems

  const drawer = (
    <Box sx={{ bgcolor: '#e8e8e8', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ minHeight: 56 }} />
      <Divider />
      <List sx={{ flex: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={
              item.path === '/' || item.path === '/lecturer' || item.path === '/my-dashboard'
                ? location.pathname === item.path
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
            }
            onClick={() => {
              navigate(item.path)
              setMobileOpen(false)
            }}
            sx={{
              '&.Mui-selected': {
                bgcolor: 'background.paper',
                borderRight: 3,
                borderColor: 'primary.main',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Chip
          size="small"
          label={roleLabels[role]}
          color={roleColors[role]}
          variant="outlined"
          sx={{ width: '100%' }}
        />
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme: Theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Cyberskills SMS
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.light' }}>
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {displayName}
            </Typography>
            <IconButton color="inherit" onClick={() => { logout(); navigate('/login') }} aria-label="logout">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
