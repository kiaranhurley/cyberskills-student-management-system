from django.test import TestCase
from students.models import Student
from courses.models import Module
from .models import StudentResult
from datetime import date


class StudentResultModelTest(TestCase):
    """Test StudentResult model."""
    
    def setUp(self):
        self.student = Student.objects.create(
            student_id='R00228237',
            first_name='John',
            last_name='Doe',
            personal_email='john@example.com'
        )
        self.module = Module.objects.create(
            module_code='DB101',
            module_name='Database Fundamentals'
        )

    def test_student_result_creation(self):
        """Test student result can be created."""
        result = StudentResult.objects.create(
            student=self.student,
            module=self.module,
            term_code='20241',
            raw_grade='85',
            processed_grade='PASS',
            numeric_grade=85.0,
            recorded_date=date.today()
        )
        self.assertEqual(result.student, self.student)
        self.assertEqual(result.module, self.module)
        self.assertEqual(result.processed_grade, 'PASS')
        self.assertEqual(result.raw_grade, '85')

    def test_student_result_str(self):
        """Test student result string representation."""
        result = StudentResult.objects.create(
            student=self.student,
            module=self.module,
            term_code='20241',
            raw_grade='85',
            processed_grade='PASS',
            numeric_grade=85.0,
            recorded_date=date.today()
        )
        self.assertIn('R00228237', str(result))
        self.assertIn('DB101', str(result))
        self.assertIn('PASS', str(result))
