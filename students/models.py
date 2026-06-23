from django.db import models
from django.core.exceptions import ValidationError


class Student(models.Model):
    """Core student information."""
    student_id = models.CharField(max_length=20, unique=True, primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    personal_email = models.EmailField(blank=True)
    student_email = models.EmailField(blank=True)
    employer = models.CharField(max_length=255, blank=True)
    date_created = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'students'
        ordering = ['student_id']

    def clean(self):
        """Validate that at least one email is provided."""
        if not self.personal_email and not self.student_email:
            raise ValidationError('At least one email address (personal or student) must be provided.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student_id} - {self.first_name} {self.last_name}"
