from django.db import models
from students.models import Student
from courses.models import Module


class StudentResult(models.Model):
    """Grades for completed modules."""
    PROCESSED_GRADE_CHOICES = [
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
        ('COMPENSATORY_PASS', 'Compensatory Pass'),
    ]

    result_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='results',
        db_column='student_id',
        to_field='student_id'
    )
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='results',
        db_column='module_code',
        to_field='module_code'
    )
    term_code = models.CharField(max_length=10)  # Format: YYYYSS (e.g., 20241)
    raw_grade = models.CharField(max_length=20)  # Original grade as entered (e.g., "39P", "85", "42")
    processed_grade = models.CharField(max_length=20, choices=PROCESSED_GRADE_CHOICES)
    numeric_grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    recorded_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_results'
        ordering = ['-recorded_date', 'student']
        indexes = [
            models.Index(fields=['student', 'term_code']),
            models.Index(fields=['module', 'term_code']),
        ]

    def __str__(self):
        return f"{self.student.student_id} - {self.module.module_code} - {self.processed_grade} ({self.term_code})"
