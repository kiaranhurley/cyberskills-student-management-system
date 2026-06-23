/** DRF paginated list response */
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  roles: string[]
  created_at: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
}

export interface Role {
  id: number
  name: string
  description: string
  created_at: string
}

export interface Student {
  student_id: string
  first_name: string
  last_name: string
  personal_email: string
  student_email: string
  employer: string
  date_created: string
  date_updated: string
}

export interface Programme {
  programme_code: string
  programme_name: string
  credits: number | null
  fee: string | null
  lecturer_name: string
  lecturer_email: string
  created_at: string
  updated_at: string
}

export interface Module {
  module_code: string
  module_name: string
  credits: number | null
  fee: string | null
  lecturer_name: string
  lecturer_email: string
  created_at: string
  updated_at: string
}

export interface StudentProgram {
  enrollment_id: number
  student: Student
  programme: Programme
  term_code: string
  enroll_status: 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN'
  enrollment_date: string
  completion_date: string | null
  created_at: string
  updated_at: string
}

export interface StudentModule {
  enrollment_id: number
  student: Student
  module: Module
  term_code: string
  enroll_status: 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN'
  enrollment_date: string
  completion_date: string | null
  created_at: string
  updated_at: string
}

export interface StudentResult {
  result_id: number
  student: Student
  module: Module
  term_code: string
  raw_grade: string
  processed_grade: 'PASS' | 'FAIL' | 'COMPENSATORY_PASS'
  numeric_grade: string | null
  recorded_date: string
  created_at: string
  updated_at: string
}

export interface ProgrammeModuleAssociation {
  id: number
  programme: Programme
  module: Module
  semester: number | null
  block: string
  created_at: string
}
