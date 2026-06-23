import type { User } from '../types/api'

export function isAdministrator(user: User | null): boolean {
  if (!user) return false
  if (user.is_superuser || user.is_staff) return true
  return user.roles?.includes('ADMIN') ?? false
}
