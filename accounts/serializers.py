from django.conf import settings
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import User, Role, UserRole, LecturerCourse, AuditLog


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=settings.PASSWORD_MIN_LENGTH)
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'roles', 'created_at', 'is_active', 'is_staff', 'is_superuser',
        ]
        read_only_fields = ['id', 'created_at', 'is_staff', 'is_superuser']

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_roles(self, obj):
        return list(obj.user_roles.values_list('role__name', flat=True))


class UserCreateSerializer(serializers.Serializer):
    """Used when an admin creates a user directly."""
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=settings.PASSWORD_MIN_LENGTH)
    first_name = serializers.CharField(required=False, allow_blank=True, default='')
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    role = serializers.ChoiceField(choices=['ADMIN', 'LECTURER', 'STUDENT'], default='STUDENT')

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def create(self, validated_data):
        role_name = validated_data.pop('role', 'STUDENT')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        role, _ = Role.objects.get_or_create(name=role_name)
        UserRole.objects.create(user=user, role=role)
        return user

    def to_representation(self, instance):
        return UserSerializer(instance).data


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name']

    def validate_username(self, value):
        if User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def to_representation(self, instance):
        return UserSerializer(instance).data


class AuthResponseSerializer(serializers.Serializer):
    user = UserSerializer(read_only=True)
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)


class UserRoleSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()
    role = serializers.StringRelatedField()

    class Meta:
        model = UserRole
        fields = ['id', 'user', 'role', 'assigned_at', 'assigned_by']
        read_only_fields = ['id', 'assigned_at']


class LecturerCourseSerializer(serializers.ModelSerializer):
    module_code_id = serializers.CharField(source='module_code.module_code', read_only=True)
    module_name = serializers.CharField(source='module_code.module_name', read_only=True)
    module_code = serializers.CharField(write_only=True)

    class Meta:
        model = LecturerCourse
        fields = ['id', 'module_code', 'module_code_id', 'module_name', 'term_code', 'assigned_at']
        read_only_fields = ['id', 'assigned_at', 'module_code_id', 'module_name']

    def validate_module_code(self, value):
        from courses.models import Module
        try:
            return Module.objects.get(module_code=value)
        except Module.DoesNotExist:
            raise serializers.ValidationError(f'Module {value} does not exist.')

    def create(self, validated_data):
        module = validated_data.pop('module_code')
        return LecturerCourse.objects.create(module_code=module, **validated_data)


class AuditLogSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'action', 'model_name', 'object_id',
                  'ip_address', 'timestamp', 'additional_info']
        read_only_fields = fields
