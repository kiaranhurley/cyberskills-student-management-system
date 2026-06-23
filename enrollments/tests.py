from django.test import TestCase
from students.models import Student
from courses.models import Programme, Module
from .models import StudentProgram, StudentModule
from datetime import date


class StudentProgramModelTest(TestCase):
    """Test StudentProgram model."""
    
    def setUp(self):
        self.student = Student.objects.create(
            student_id='R00228237',
            first_name='John',
            last_name='Doe',
            personal_email='john@example.com'
        )
        self.programme = Programme.objects.create(
            programme_code='CS101',
            programme_name='Computer Science Fundamentals'
        )

    def test_student_program_creation(self):
        """Test student program enrollment can be created."""
        enrollment = StudentProgram.objects.create(
            student=self.student,
            programme=self.programme,
            term_code='20241',
            enroll_status='ACTIVE',
            enrollment_date=date.today()
        )
        self.assertEqual(enrollment.student, self.student)
        self.assertEqual(enrollment.programme, self.programme)
        self.assertEqual(enrollment.enroll_status, 'ACTIVE')

    def test_student_program_str(self):
        """Test student program string representation."""
        enrollment = StudentProgram.objects.create(
            student=self.student,
            programme=self.programme,
            term_code='20241',
            enroll_status='ACTIVE',
            enrollment_date=date.today()
        )
        self.assertIn('R00228237', str(enrollment))
        self.assertIn('CS101', str(enrollment))


class StudentModuleModelTest(TestCase):
    """Test StudentModule model."""
    
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

    def test_student_module_creation(self):
        """Test student module enrollment can be created."""
        enrollment = StudentModule.objects.create(
            student=self.student,
            module=self.module,
            term_code='20241',
            enroll_status='ACTIVE',
            enrollment_date=date.today()
        )
        self.assertEqual(enrollment.student, self.student)
        self.assertEqual(enrollment.module, self.module)
        self.assertEqual(enrollment.enroll_status, 'ACTIVE')

    def test_student_module_str(self):
        """Test student module string representation."""
        enrollment = StudentModule.objects.create(
            student=self.student,
            module=self.module,
            term_code='20241',
            enroll_status='ACTIVE',
            enrollment_date=date.today()
        )
        self.assertIn('R00228237', str(enrollment))
        self.assertIn('DB101', str(enrollment))
