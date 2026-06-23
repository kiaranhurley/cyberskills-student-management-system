from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError


class User(AbstractUser):
    """Custom user model extending Django's AbstractUser."""
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        ordering = ['username']

    def __str__(self):
        return self.username


class Role(models.Model):
    """Role definitions for RBAC."""
    ROLE_CHOICES = [
        ('ADMIN', 'Administrator'),
        ('LECTURER', 'Lecturer'),
        ('STUDENT', 'Student'),
    ]

    name = models.CharField(max_length=50, unique=True, choices=ROLE_CHOICES)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'roles'
        ordering = ['name']

    def __str__(self):
        return self.get_name_display()


class UserRole(models.Model):
    """Many-to-many relationship between users and roles."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='role_assignments_made'
    )

    class Meta:
        db_table = 'user_roles'
        unique_together = ['user', 'role']
        ordering = ['user', 'role']

    def __str__(self):
        return f"{self.user.username} - {self.role.name}"


class LecturerCourse(models.Model):
    """Assigns lecturers to specific modules for specific terms (departmental permissions)."""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='lecturer_assignments'
    )
    module_code = models.ForeignKey(
        'courses.Module',
        on_delete=models.CASCADE,
        related_name='lecturer_assignments',
        db_column='module_code',
        to_field='module_code'
    )
    term_code = models.CharField(max_length=10)  # Format: YYYYSS (e.g., 20241)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lecturer_courses'
        unique_together = ['user', 'module_code', 'term_code']
        ordering = ['term_code', 'module_code']

    def __str__(self):
        return f"{self.user.username} - {self.module_code.module_code} - {self.term_code}"


class AuditLog(models.Model):
    """System audit trail for tracking data access and modifications."""
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('READ', 'Read'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=255, null=True, blank=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    additional_info = models.TextField(blank=True)

    class Meta:
        db_table = 'audit_log'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['model_name', 'action']),
        ]

    def __str__(self):
        return f"{self.action} - {self.model_name} - {self.timestamp}"
