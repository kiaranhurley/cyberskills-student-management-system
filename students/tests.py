from django.test import TestCase
from .models import Student
from django.core.exceptions import ValidationError


class StudentModelTest(TestCase):
    """Test Student model."""
    
    def setUp(self):
        self.student = Student.objects.create(
            student_id='R00228237',
            first_name='John',
            last_name='Doe',
            personal_email='john.doe@example.com',
            student_email='john.doe@student.mtu.ie'
        )

    def test_student_creation(self):
        """Test student can be created."""
        self.assertEqual(self.student.student_id, 'R00228237')
        self.assertEqual(self.student.first_name, 'John')
        self.assertEqual(self.student.last_name, 'Doe')

    def test_student_str(self):
        """Test student string representation."""
        self.assertEqual(str(self.student), 'R00228237 - John Doe')

    def test_student_requires_at_least_one_email(self):
        """Test that student must have at least one email."""
        student = Student(
            student_id='R00111111',
            first_name='Jane',
            last_name='Smith'
        )
        with self.assertRaises(ValidationError):
            student.full_clean()

    def test_student_with_personal_email_only(self):
        """Test student can be created with only personal email."""
        student = Student.objects.create(
            student_id='R00111112',
            first_name='Jane',
            last_name='Smith',
            personal_email='jane@example.com'
        )
        self.assertIsNotNone(student)

    def test_student_with_student_email_only(self):
        """Test student can be created with only student email."""
        student = Student.objects.create(
            student_id='R00111113',
            first_name='Bob',
            last_name='Jones',
            student_email='bob@student.mtu.ie'
        )
        self.assertIsNotNone(student)
