export interface DashboardSummary {
  current_term_code: string | null
  active_students_current_term: number
  returning_students_current_term: number
  enrollments_by_programme: Array<{
    programme_code: string
    programme_name: string
    count: number
  }>
  most_popular_programme: {
    programme_code: string
    programme_name: string
    active_enrollments: number
  } | null
  top_employers: Array<{
    employer: string
    student_count: number
  }>
}
