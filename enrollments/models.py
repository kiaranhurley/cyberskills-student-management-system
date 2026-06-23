from django.db import models
from students.models import Student
from courses.models import Programme, Module


class StudentProgram(models.Model):
    """Pathway enrollments."""
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('WITHDRAWN', 'Withdrawn'),
    ]

    enrollment_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='program_enrollments',
        db_column='student_id',
        to_field='student_id'
    )
    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        related_name='enrollments',
        db_column='programme_code',
        to_field='programme_code'
    )
    term_code = models.CharField(max_length=10)  # Format: YYYYSS (e.g., 20241)
    enroll_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    enrollment_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_programs'
        ordering = ['-enrollment_date', 'student']
        indexes = [
            models.Index(fields=['student', 'term_code']),
            models.Index(fields=['programme', 'term_code']),
        ]

    def __str__(self):
        return f"{self.student.student_id} - {self.programme.programme_code} - {self.term_code}"


class StudentModule(models.Model):
    """Individual module enrollments."""
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('WITHDRAWN', 'Withdrawn'),
    ]

    enrollment_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='module_enrollments',
        db_column='student_id',
        to_field='student_id'
    )
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='enrollments',
        db_column='module_code',
        to_field='module_code'
    )
    term_code = models.CharField(max_length=10)  # Format: YYYYSS (e.g., 20241)
    enroll_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    enrollment_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_modules'
        ordering = ['-enrollment_date', 'student']
        indexes = [
            models.Index(fields=['student', 'term_code']),
            models.Index(fields=['module', 'term_code']),
        ]

    def __str__(self):
        return f"{self.student.student_id} - {self.module.module_code} - {self.term_code}"
