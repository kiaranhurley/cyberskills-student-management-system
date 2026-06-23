from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from accounts.permissions import CoursePermission, is_administrator, is_lecturer, get_lecturer_modules
from enrollments.models import StudentProgram, StudentModule
from .models import Programme, Module, ProgrammeModuleAssociation
from .serializers import ProgrammeSerializer, ModuleSerializer, ProgrammeModuleAssociationSerializer


class ProgrammeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Programme model.
    
    Permissions:
    - Administrators: Full CRUD access
    - Lecturers: Read-only access to programmes containing assigned modules
    - Students: Read-only access
    """
    queryset = Programme.objects.all()  # Required for router basename, filtered in get_queryset()
    serializer_class = ProgrammeSerializer
    permission_classes = [CoursePermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['programme_code', 'programme_name', 'credits']
    search_fields = ['programme_name', 'programme_code']
    ordering_fields = ['programme_code', 'programme_name', 'created_at']
    ordering = ['programme_code']
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        queryset = Programme.objects.all()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return Programme.objects.none()
        
        # Administrators see all programmes
        if is_administrator(user):
            scoped = queryset
        
        # Lecturers see programmes containing their assigned modules
        elif is_lecturer(user):
            lecturer_modules = get_lecturer_modules(user)
            if lecturer_modules:
                scoped = queryset.filter(
                    module_associations__module__module_code__in=lecturer_modules
                ).distinct()
            else:
                return Programme.objects.none()
        
        # Students see all programmes (read-only)
        else:
            scoped = queryset

        student_id = (self.request.query_params.get('student_id') or '').strip().upper()
        if student_id:
            scoped = scoped.filter(enrollments__student__student_id=student_id)
        return scoped.distinct()

    @extend_schema(
        summary='Pathway enrolment counts by programme',
        description='Distinct student counts per programme (administrators only).',
        tags=['courses'],
    )
    @action(detail=False, methods=['get'], url_path='pathway-enrollment-counts')
    def pathway_enrollment_counts(self, request):
        """Batch counts for programmes page (avoids N+1 API calls)."""
        if not is_administrator(request.user):
            return Response({'detail': 'Forbidden'}, status=403)
        student_id = (request.query_params.get('student_id') or '').strip().upper()
        term_code = (request.query_params.get('term_code') or '').strip() or None
        qs = StudentProgram.objects.all()
        if student_id:
            qs = qs.filter(student__student_id=student_id)
        if term_code:
            qs = qs.filter(term_code=term_code)
        rows = (
            qs
            .values('programme')
            .annotate(c=Count('student', distinct=True))
        )
        counts = {row['programme']: row['c'] for row in rows}
        return Response({'counts': counts, 'term_code': term_code})


class ModuleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Module model.
    
    Permissions:
    - Administrators: Full CRUD access
    - Lecturers: Read-only access to assigned modules
    - Students: Read-only access
    """
    queryset = Module.objects.all()  # Required for router basename, filtered in get_queryset()
    serializer_class = ModuleSerializer
    permission_classes = [CoursePermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['module_code', 'module_name', 'credits']
    search_fields = ['module_name', 'module_code']
    ordering_fields = ['module_code', 'module_name', 'created_at']
    ordering = ['module_code']
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        queryset = Module.objects.all()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return Module.objects.none()
        
        # Administrators see all modules
        if is_administrator(user):
            scoped = queryset
        
        # Lecturers see only their assigned modules
        elif is_lecturer(user):
            lecturer_modules = get_lecturer_modules(user)
            if lecturer_modules:
                scoped = queryset.filter(module_code__in=lecturer_modules)
            else:
                return Module.objects.none()
        
        # Students see all modules (read-only)
        else:
            scoped = queryset

        student_id = (self.request.query_params.get('student_id') or '').strip().upper()
        if student_id:
            scoped = scoped.filter(enrollments__student__student_id=student_id)
        return scoped.distinct()

    @extend_schema(
        summary='Module enrolment counts',
        description='Distinct student counts per module (administrators only).',
        tags=['courses'],
    )
    @action(detail=False, methods=['get'], url_path='enrollment-counts')
    def enrollment_counts(self, request):
        if not is_administrator(request.user):
            return Response({'detail': 'Forbidden'}, status=403)
        student_id = (request.query_params.get('student_id') or '').strip().upper()
        qs = StudentModule.objects.all()
        if student_id:
            qs = qs.filter(student__student_id=student_id)
        rows = qs.values('module').annotate(c=Count('student', distinct=True))
        counts = {row['module']: row['c'] for row in rows}
        return Response({'counts': counts})


class ProgrammeModuleAssociationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ProgrammeModuleAssociation model.
    
    Permissions:
    - Administrators: Full CRUD access
    - Lecturers: Read-only access to associations for assigned modules
    - Students: Read-only access
    """
    queryset = ProgrammeModuleAssociation.objects.all()  # Required for router basename, filtered in get_queryset()
    serializer_class = ProgrammeModuleAssociationSerializer
    permission_classes = [CoursePermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['programme', 'module', 'semester']
    ordering_fields = ['programme', 'module', 'semester']
    ordering = ['programme', 'semester', 'module']
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        queryset = ProgrammeModuleAssociation.objects.all()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return ProgrammeModuleAssociation.objects.none()
        
        # Administrators see all associations
        if is_administrator(user):
            return queryset
        
        # Lecturers see associations for their assigned modules
        if is_lecturer(user):
            lecturer_modules = get_lecturer_modules(user)
            if lecturer_modules:
                return queryset.filter(module__module_code__in=lecturer_modules)
            return ProgrammeModuleAssociation.objects.none()
        
        # Students see all associations (read-only)
        return queryset
