from rest_framework import viewsets, filters
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import StudentPermission, is_administrator, is_lecturer, is_student, get_lecturer_modules
from .models import Student
from .serializers import StudentSerializer
from enrollments.models import StudentModule, StudentProgram


class StudentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for Student model.
    
    Permissions:
    - Administrators: Read access to all students
    - Lecturers: Read-only access to students enrolled in assigned modules
    - Students: Read-only access to own record
    """
    queryset = Student.objects.all()  # Required for router basename, filtered in get_queryset()
    serializer_class = StudentSerializer
    permission_classes = [StudentPermission]
    lookup_field = 'student_id'
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student_id', 'first_name', 'last_name', 'personal_email', 'student_email', 'employer']
    search_fields = ['first_name', 'last_name', 'student_id']
    ordering_fields = ['student_id', 'first_name', 'last_name', 'date_created']
    ordering = ['student_id']
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        queryset = Student.objects.all()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return Student.objects.none()
        
        # Administrators see all students
        if is_administrator(user):
            scoped = queryset
        
        # Lecturers see only students enrolled in their assigned modules
        elif is_lecturer(user):
            lecturer_modules = get_lecturer_modules(user)
            if lecturer_modules:
                scoped = queryset.filter(
                    module_enrollments__module__module_code__in=lecturer_modules
                ).distinct()
            else:
                return Student.objects.none()
        
        # Students see only their own record
        elif is_student(user):
            try:
                student = Student.objects.get(student_id=user.username)
                scoped = Student.objects.filter(student_id=student.student_id)
            except Student.DoesNotExist:
                return Student.objects.none()

        else:
            return Student.objects.none()

        student_id = (self.request.query_params.get('student_id') or '').strip().upper()
        programme_code = (self.request.query_params.get('programme_code') or '').strip().upper()
        module_code = (self.request.query_params.get('module_code') or '').strip().upper()
        enrollment_year_raw = (self.request.query_params.get('enrollment_year') or '').strip()

        if student_id:
            scoped = scoped.filter(student_id=student_id)
        if programme_code:
            scoped = scoped.filter(program_enrollments__programme__programme_code=programme_code)
        if module_code:
            scoped = scoped.filter(module_enrollments__module__module_code=module_code)
        if enrollment_year_raw.isdigit():
            enrollment_year = int(enrollment_year_raw)
            scoped = scoped.filter(
                Q(program_enrollments__enrollment_date__year=enrollment_year)
                | Q(module_enrollments__enrollment_date__year=enrollment_year)
            )

        return scoped.distinct()

    @action(detail=False, methods=['get'], url_path='enrollment-years')
    def enrollment_years(self, request):
        years = {d.year for d in StudentProgram.objects.exclude(enrollment_date__isnull=True).dates('enrollment_date', 'year')}
        years.update(
            d.year for d in StudentModule.objects.exclude(enrollment_date__isnull=True).dates('enrollment_date', 'year')
        )
        ordered = sorted([y for y in years if y is not None], reverse=True)
        return Response({'years': ordered})


