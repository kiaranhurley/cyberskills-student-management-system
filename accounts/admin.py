from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, UserRole, LecturerCourse, AuditLog


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_staff', 'created_at']
    list_filter = ['is_staff', 'is_superuser', 'created_at']
    search_fields = ['username', 'email', 'first_name', 'last_name']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name', 'description']


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'assigned_at', 'assigned_by']
    list_filter = ['role', 'assigned_at']
    search_fields = ['user__username', 'role__name']


@admin.register(LecturerCourse)
class LecturerCourseAdmin(admin.ModelAdmin):
    list_display = ['user', 'module_code', 'term_code', 'assigned_at']
    list_filter = ['term_code', 'assigned_at']
    search_fields = ['user__username', 'module_code__module_code']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'model_name', 'object_id', 'timestamp']
    list_filter = ['action', 'model_name', 'timestamp']
    search_fields = ['user__username', 'model_name', 'object_id']
    readonly_fields = ['user', 'action', 'model_name', 'object_id', 'old_values', 'new_values', 'timestamp']
