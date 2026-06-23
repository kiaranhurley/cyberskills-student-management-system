import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { AuthProvider } from './context/AuthContext'
import { CompactModeProvider } from './context/CompactModeContext'
import { SnackbarProvider } from './context/SnackbarContext'
import { AdminRoute } from './components/AdminRoute'
import { LecturerRoute } from './components/LecturerRoute'
import { StudentRoute } from './components/StudentRoute'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { UnauthorizedPage } from './pages/UnauthorizedPage'
import { StudentsPage } from './pages/StudentsPage'
import { CoursesPage } from './pages/CoursesPage'
import { StudentDetailPage } from './pages/StudentDetailPage'
import { EnrollmentsPage } from './pages/EnrollmentsPage'
import { GradesPage } from './pages/GradesPage'
import { ProgrammesPage } from './pages/ProgrammesPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { ReportsPage } from './pages/ReportsPage'
import { LecturerDashboardPage } from './pages/LecturerDashboardPage'
import { LecturerModulePage } from './pages/LecturerModulePage'
import { StudentDashboardPage } from './pages/StudentDashboardPage'
import { AuditLogPage } from './pages/AuditLogPage'

const DashboardPage = lazy(async () => {
  const m = await import('./pages/DashboardPage')
  return { default: m.DashboardPage }
})

function DashboardFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress />
    </Box>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CompactModeProvider>
        <SnackbarProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Admin routes */}
            <Route element={<AdminRoute />}>
              <Route element={<AppLayout role="ADMIN" />}>
                <Route
                  index
                  element={
                    <Suspense fallback={<DashboardFallback />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route path="students/:studentId" element={<StudentDetailPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="courses" element={<CoursesPage />} />
                <Route path="programmes" element={<ProgrammesPage />} />
                <Route path="enrollments" element={<EnrollmentsPage />} />
                <Route path="grades" element={<GradesPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="audit-logs" element={<AuditLogPage />} />
              </Route>
            </Route>

            {/* Lecturer routes */}
            <Route element={<LecturerRoute />}>
              <Route element={<AppLayout role="LECTURER" />}>
                <Route path="lecturer" element={<LecturerDashboardPage />} />
                <Route path="lecturer/modules/:moduleCode" element={<LecturerModulePage />} />
              </Route>
            </Route>

            {/* Student routes */}
            <Route element={<StudentRoute />}>
              <Route element={<AppLayout role="STUDENT" />}>
                <Route path="my-dashboard" element={<StudentDashboardPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
        </SnackbarProvider>
      </CompactModeProvider>
    </BrowserRouter>
  )
}
