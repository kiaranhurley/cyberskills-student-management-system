from django.contrib import admin
from .models import StudentProgram, StudentModule


@admin.register(StudentProgram)
class StudentProgramAdmin(admin.ModelAdmin):
    list_display = ['student', 'programme', 'term_code', 'enroll_status', 'enrollment_date', 'completion_date']
    list_filter = ['enroll_status', 'term_code', 'enrollment_date']
    search_fields = ['student__student_id', 'programme__programme_code']


@admin.register(StudentModule)
class StudentModuleAdmin(admin.ModelAdmin):
    list_display = ['student', 'module', 'term_code', 'enroll_status', 'enrollment_date', 'completion_date']
    list_filter = ['enroll_status', 'term_code', 'enrollment_date']
    search_fields = ['student__student_id', 'module__module_code']
