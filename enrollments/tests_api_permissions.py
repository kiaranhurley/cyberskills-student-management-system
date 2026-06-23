"""
Permission tests for Enrollment API endpoints.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import Role, UserRole, LecturerCourse
from students.models import Student
from courses.models import Programme, Module
from .models import StudentProgram, StudentModule

User = get_user_model()


class EnrollmentPermissionTest(TestCase):
    """Test role-based permissions for Enrollment endpoints."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create roles
        self.admin_role = Role.objects.create(name='ADMIN')
        self.lecturer_role = Role.objects.create(name='LECTURER')
        self.student_role = Role.objects.create(name='STUDENT')
        
        # Create users
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        UserRole.objects.create(user=self.admin_user, role=self.admin_role)
        
        self.lecturer_user = User.objects.create_user(
            username='lecturer',
            email='lecturer@example.com',
            password='lecturerpass123'
        )
        UserRole.objects.create(user=self.lecturer_user, role=self.lecturer_role)
        
        self.student_user = User.objects.create_user(
            username='R00111111',
            email='student@example.com',
            password='studentpass123'
        )
        UserRole.objects.create(user=self.student_user, role=self.student_role)
        
        # Create test data
        self.student1 = Student.objects.create(
            student_id='R00111111',
            first_name='John',
            last_name='Doe',
            personal_email='john@example.com'
        )
        
        self.student2 = Student.objects.create(
            student_id='R00222222',
            first_name='Jane',
            last_name='Smith',
            personal_email='jane@example.com'
        )
        
        self.programme = Programme.objects.create(
            programme_code='CS101',
            programme_name='Computer Science'
        )
        
        self.module1 = Module.objects.create(
            module_code='CYBR8001',
            module_name='Module 1'
        )
        
        self.module2 = Module.objects.create(
            module_code='CYBR8002',
            module_name='Module 2'
        )
        
        # Assign lecturer to module1
        LecturerCourse.objects.create(
            user=self.lecturer_user,
            module_code=self.module1,
            term_code='202400'
        )
        
        # Create enrollments
        self.enrollment1 = StudentModule.objects.create(
            student=self.student1,
            module=self.module1,
            term_code='202400',
            enroll_status='ACTIVE',
            enrollment_date='2024-01-01'
        )
        
        self.enrollment2 = StudentModule.objects.create(
            student=self.student2,
            module=self.module2,
            term_code='202400',
            enroll_status='ACTIVE',
            enrollment_date='2024-01-01'
        )
    
    def test_admin_can_list_all_enrollments(self):
        """Test that admin can list all enrollments."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/enrollments/student-modules/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_admin_can_create_enrollment(self):
        """Test that admin can create an enrollment."""
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'student_id': 'R00111111',
            'module_code': 'CYBR8002',
            'term_code': '202401',
            'enroll_status': 'ACTIVE',
            'enrollment_date': '2024-01-15'
        }
        response = self.client.post('/api/enrollments/student-modules/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_lecturer_can_list_assigned_enrollments(self):
        """Test that lecturer can only see enrollments for assigned modules."""
        self.client.force_authenticate(user=self.lecturer_user)
        response = self.client.get('/api/enrollments/student-modules/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see enrollment1 (for module1 assigned to lecturer)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['enrollment_id'], self.enrollment1.enrollment_id)
    
    def test_lecturer_cannot_create_enrollment(self):
        """Test that lecturer cannot create an enrollment."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {
            'student_id': 'R00111111',
            'module_code': 'CYBR8002',
            'term_code': '202401',
            'enroll_status': 'ACTIVE',
            'enrollment_date': '2024-01-15'
        }
        response = self.client.post('/api/enrollments/student-modules/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_student_can_list_own_enrollments(self):
        """Test that student can list their own enrollments."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/enrollments/student-modules/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see enrollment1 (own enrollment)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['enrollment_id'], self.enrollment1.enrollment_id)
    
    def test_student_cannot_view_other_enrollments(self):
        """Test that student cannot view other students' enrollments."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(f'/api/enrollments/student-modules/{self.enrollment2.enrollment_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_student_cannot_create_enrollment(self):
        """Test that student cannot create an enrollment."""
        self.client.force_authenticate(user=self.student_user)
        data = {
            'student_id': 'R00111111',
            'module_code': 'CYBR8002',
            'term_code': '202401',
            'enroll_status': 'ACTIVE',
            'enrollment_date': '2024-01-15'
        }
        response = self.client.post('/api/enrollments/student-modules/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_dashboard_summary(self):
        """Administrator dashboard summary is available to ADMIN role."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/enrollments/dashboard-summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('active_students_current_term', response.data)
        self.assertIn('returning_students_current_term', response.data)
        self.assertIn('enrollments_by_programme', response.data)

    def test_lecturer_cannot_access_dashboard_summary(self):
        self.client.force_authenticate(user=self.lecturer_user)
        response = self.client.get('/api/enrollments/dashboard-summary/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_access_dashboard_summary(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/enrollments/dashboard-summary/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_enrollment_terms(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/enrollments/enrollment-terms/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('terms', response.data)

    def test_dashboard_summary_accepts_term_code(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/enrollments/dashboard-summary/', {'term_code': '202401'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['current_term_code'], '202401')
