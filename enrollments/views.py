from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from accounts.permissions import EnrollmentPermission, is_administrator, is_lecturer, is_student, get_lecturer_modules
from students.models import Student
from .models import StudentProgram, StudentModule
from .serializers import StudentProgramSerializer, StudentModuleSerializer


class StudentProgramViewSet(viewsets.ModelViewSet):
    """
    ViewSet for StudentProgram model.
    
    Permissions:
    - Administrators: Full CRUD access
    - Lecturers: Read-only access to enrollments for assigned modules
    - Students: Read-only access to own enrollments
    """
    queryset = StudentProgram.objects.all()  # Required for router basename, filtered in get_queryset()
    serializer_class = StudentProgramSerializer
    permission_classes = [EnrollmentPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'programme', 'term_code', 'enroll_status']
    ordering_fields = ['enrollment_date', 'term_code', 'student']
    ordering = ['-enrollment_date', 'student']
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        queryset = StudentProgram.objects.all()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return StudentProgram.objects.none()
        
        # Administrators see all enrollments
        if is_administrator(user):
            return queryset
        
        # Lecturers see enrollments for students in their assigned modules
        if is_lecturer(user):
            lecturer_modules = get_lecturer_modules(user)
            if lecturer_modules:
                # Get students enrolled in lecturer's modules
                student_ids = StudentModule.objects.filter(
                    module__module_code__in=lecturer_modules
                ).values_list('student_id', flat=True).distinct()
                return queryset.filter(student_id__in=student_ids)
            return StudentProgram.objects.none()
        
        # Students see only their own enrollments
        if is_student(user):
            try:
                student = Student.objects.get(student_id=user.username)
                return queryset.filter(student=student)
            except Student.DoesNotExist:
                return StudentProgram.objects.none()
        
        return StudentProgram.objects.none()


class StudentModuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for StudentModule model.
    
    Permissions:
    - Administrators: Full CRUD access
    - Lecturers: Read-only access to enrollments for assigned modules
    - Students: Read-only access to own enrollments
    """
    queryset = StudentModule.objects.all()  # Required for router basename, filtered in get_queryset()
    serializer_class = StudentModuleSerializer
    permission_classes = [EnrollmentPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'module', 'term_code', 'enroll_status']
    ordering_fields = ['enrollment_date', 'term_code', 'student']
    ordering = ['-enrollment_date', 'student']
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        queryset = StudentModule.objects.all()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return StudentModule.objects.none()
        
        # Administrators see all enrollments
        if is_administrator(user):
            return queryset
        
        # Lecturers see enrollments for their assigned modules
        if is_lecturer(user):
            lecturer_modules = get_lecturer_modules(user)
            if lecturer_modules:
                return queryset.filter(module__module_code__in=lecturer_modules)
            return StudentModule.objects.none()
        
        # Students see only their own enrollments
        if is_student(user):
            try:
                student = Student.objects.get(student_id=user.username)
                return queryset.filter(student=student)
            except Student.DoesNotExist:
                return StudentModule.objects.none()
        
        return StudentModule.objects.none()
