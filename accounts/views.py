from rest_framework import status, viewsets, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.conf import settings
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from django_filters.rest_framework import DjangoFilterBackend
from .models import User, Role, UserRole, LecturerCourse, AuditLog
from .serializers import (
    UserSerializer, RoleSerializer, RegisterSerializer, LoginSerializer,
    AuthResponseSerializer, UserRoleSerializer, LecturerCourseSerializer,
    UserCreateSerializer, UserUpdateSerializer, AuditLogSerializer,
)
from .permissions import IsAdministrator


@extend_schema(request=RegisterSerializer, responses={201: AuthResponseSerializer})
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user."""
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name') or ''
    last_name = request.data.get('last_name') or ''

    errors = {}
    if not username or not str(username).strip():
        errors['username'] = ['This field is required.']
    if not email or not str(email).strip():
        errors['email'] = ['This field is required.']
    if not password:
        errors['password'] = ['This field is required.']
    elif len(str(password)) < settings.PASSWORD_MIN_LENGTH:
        errors['password'] = [f'Password must be at least {settings.PASSWORD_MIN_LENGTH} characters.']
    if errors:
        return Response({'error': 'Validation failed', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

    username = str(username).strip()
    email = str(email).strip()

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists', 'details': {'username': ['A user with this username already exists.']}}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists', 'details': {'email': ['A user with this email already exists.']}}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
    except DjangoValidationError as e:
        details = e.message_dict if hasattr(e, 'message_dict') else {'__all__': [str(e)]}
        return Response({'error': 'Validation failed', 'details': details}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': 'Validation failed', 'details': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    student_role, _ = Role.objects.get_or_create(name='STUDENT')
    UserRole.objects.create(user=user, role=student_role)

    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }, status=status.HTTP_201_CREATED)


@extend_schema(
    request=LoginSerializer,
    responses={200: AuthResponseSerializer, 401: None},
    description='Login with username and password. Returns JWT access and refresh tokens.',
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Login endpoint (alternative to token endpoint)."""
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)
    if user:
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@extend_schema(responses={200: UserSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    """Get current user profile."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@extend_schema(responses={200: RoleSerializer(many=True)})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def roles_list(request):
    """List all available roles."""
    roles = Role.objects.all()
    serializer = RoleSerializer(roles, many=True)
    return Response(serializer.data)


@extend_schema(responses={200: LecturerCourseSerializer(many=True)})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_assignments(request):
    """Return the current lecturer's module assignments."""
    assignments = LecturerCourse.objects.filter(user=request.user).select_related('module_code')
    serializer = LecturerCourseSerializer(assignments, many=True)
    return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    """Admin-only CRUD for user accounts."""
    queryset = User.objects.prefetch_related('user_roles__role').order_by('username')
    permission_classes = [IsAuthenticated, IsAdministrator]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'email', 'created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserSerializer

    @action(detail=True, methods=['post'], url_path='assign-role')
    def assign_role(self, request, pk=None):
        """Assign a role to a user."""
        user = self.get_object()
        role_name = request.data.get('role')
        if not role_name:
            return Response({'error': 'role is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            role = Role.objects.get(name=role_name)
        except Role.DoesNotExist:
            return Response({'error': f'Role {role_name} does not exist'}, status=status.HTTP_400_BAD_REQUEST)

        _, created = UserRole.objects.get_or_create(
            user=user, role=role,
            defaults={'assigned_by': request.user},
        )
        if not created:
            return Response({'detail': 'User already has this role'}, status=status.HTTP_200_OK)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='remove-role')
    def remove_role(self, request, pk=None):
        """Remove a role from a user."""
        user = self.get_object()
        role_name = request.data.get('role')
        if not role_name:
            return Response({'error': 'role is required'}, status=status.HTTP_400_BAD_REQUEST)

        deleted, _ = UserRole.objects.filter(user=user, role__name=role_name).delete()
        if not deleted:
            return Response({'error': 'User does not have this role'}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['get', 'post'], url_path='lecturer-assignments')
    def lecturer_assignments(self, request, pk=None):
        """List or create lecturer-module assignments for a user."""
        user = self.get_object()
        if request.method == 'GET':
            assignments = LecturerCourse.objects.filter(user=user).select_related('module_code')
            return Response(LecturerCourseSerializer(assignments, many=True).data)

        serializer = LecturerCourseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = serializer.save(user=user)
        return Response(LecturerCourseSerializer(assignment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        """Set a new password for a user."""
        user = self.get_object()
        password = request.data.get('password', '')
        if len(str(password)) < settings.PASSWORD_MIN_LENGTH:
            return Response(
                {'error': f'Password must be at least {settings.PASSWORD_MIN_LENGTH} characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password updated.'})

    @action(detail=True, methods=['delete'], url_path='lecturer-assignments/(?P<assignment_id>[^/.]+)')
    def delete_lecturer_assignment(self, request, pk=None, assignment_id=None):
        """Delete a specific lecturer-module assignment."""
        user = self.get_object()
        try:
            assignment = LecturerCourse.objects.get(id=assignment_id, user=user)
        except LecturerCourse.DoesNotExist:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only read-only view of system audit logs."""
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdministrator]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['action', 'model_name']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']
