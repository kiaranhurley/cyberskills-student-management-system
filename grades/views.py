from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from accounts.permissions import ResultPermission, is_administrator, is_lecturer, is_student, get_lecturer_modules
from students.models import Student
from .models import StudentResult
from .serializers import StudentResultSerializer


class StudentResultViewSet(viewsets.ModelViewSet):
    """
    ViewSet for StudentResult model.
    
    Permissions:
    - Administrators: Full CRUD access
    - Lecturers: Read, create, and update results for assigned modules
    - Students: Read-only access to own results
    """
    queryset = StudentResult.objects.all()  # Required for router basename, filtered in get_queryset()
    serializer_class = StudentResultSerializer
    permission_classes = [ResultPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['student', 'module', 'term_code', 'processed_grade']
    ordering_fields = ['recorded_date', 'term_code', 'student']
    ordering = ['-recorded_date', 'student']
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        queryset = StudentResult.objects.all()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return StudentResult.objects.none()
        
        # Administrators see all results
        if is_administrator(user):
            return queryset
        
        # Lecturers see results for their assigned modules
        if is_lecturer(user):
            lecturer_modules = get_lecturer_modules(user)
            if lecturer_modules:
                return queryset.filter(module__module_code__in=lecturer_modules)
            return StudentResult.objects.none()
        
        # Students see only their own results
        if is_student(user):
            try:
                student = Student.objects.get(student_id=user.username)
                return queryset.filter(student=student)
            except Student.DoesNotExist:
                return StudentResult.objects.none()
        
        return StudentResult.objects.none()
    
    def create(self, request, *args, **kwargs):
        """Override create to validate lecturer can submit grades for this module."""
        # Check if lecturer is trying to create a result
        if is_lecturer(request.user) and not is_administrator(request.user):
            module_code = request.data.get('module_code')
            if module_code:
                lecturer_modules = get_lecturer_modules(request.user)
                if module_code not in lecturer_modules:
                    return Response(
                        {'error': 'You are not assigned to teach this module.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
        
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        """Override update to validate lecturer can update grades for this module."""
        # Check if lecturer is trying to update a result
        if is_lecturer(request.user) and not is_administrator(request.user):
            instance = self.get_object()
            lecturer_modules = get_lecturer_modules(request.user)
            if instance.module.module_code not in lecturer_modules:
                return Response(
                    {'error': 'You are not assigned to teach this module.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        return super().update(request, *args, **kwargs)
