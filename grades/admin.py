from django.contrib import admin
from .models import StudentResult


@admin.register(StudentResult)
class StudentResultAdmin(admin.ModelAdmin):
    list_display = ['student', 'module', 'term_code', 'raw_grade', 'processed_grade', 'numeric_grade', 'recorded_date']
    list_filter = ['processed_grade', 'term_code', 'recorded_date']
    search_fields = ['student__student_id', 'module__module_code']
