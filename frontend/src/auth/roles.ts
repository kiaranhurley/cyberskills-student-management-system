import type { User } from '../types/api'

export function isAdministrator(user: User | null): boolean {
  if (!user) return false
  if (user.is_superuser || user.is_staff) return true
  return user.roles?.includes('ADMIN') ?? false
}

export function isLecturer(user: User | null): boolean {
  if (!user) return false
  return user.roles?.includes('LECTURER') ?? false
}

export function isStudent(user: User | null): boolean {
  if (!user) return false
  return user.roles?.includes('STUDENT') ?? false
}

export function getHomeRoute(user: User | null): string {
  if (!user) return '/login'
  if (isAdministrator(user)) return '/'
  if (isLecturer(user)) return '/lecturer'
  if (isStudent(user)) return '/my-dashboard'
  return '/unauthorized'
}
