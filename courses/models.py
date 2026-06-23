from django.db import models
from django.core.exceptions import ValidationError


class Programme(models.Model):
    """Pathway definitions."""
    programme_code = models.CharField(max_length=20, unique=True, primary_key=True)
    programme_name = models.CharField(max_length=255)
    credits = models.IntegerField(null=True, blank=True)
    fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    lecturer_name = models.CharField(max_length=255, blank=True)
    lecturer_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'programmes'
        ordering = ['programme_code']

    def __str__(self):
        return f"{self.programme_code} - {self.programme_name}"


class Module(models.Model):
    """Microcredential definitions."""
    module_code = models.CharField(max_length=20, unique=True, primary_key=True)
    module_name = models.CharField(max_length=255)
    credits = models.IntegerField(null=True, blank=True)
    fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    lecturer_name = models.CharField(max_length=255, blank=True)
    lecturer_email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'modules'
        ordering = ['module_code']

    def __str__(self):
        return f"{self.module_code} - {self.module_name}"


class ProgrammeModuleAssociation(models.Model):
    """Many-to-many relationship between programmes and modules."""
    SEMESTER_CHOICES = [
        (1, 'Semester 1'),
        (2, 'Semester 2'),
    ]

    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        related_name='module_associations',
        db_column='programme_code',
        to_field='programme_code'
    )
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='programme_associations',
        db_column='module_code',
        to_field='module_code'
    )
    semester = models.IntegerField(choices=SEMESTER_CHOICES, null=True, blank=True)
    block = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'programme_module_associations'
        unique_together = ['programme', 'module']
        ordering = ['programme', 'semester', 'module']

    def __str__(self):
        return f"{self.programme.programme_code} - {self.module.module_code}"
