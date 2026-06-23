"""
Permission tests for Grade/Result API endpoints.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import Role, UserRole, LecturerCourse
from students.models import Student
from courses.models import Module
from .models import StudentResult

User = get_user_model()


class ResultPermissionTest(TestCase):
    """Test role-based permissions for Result endpoints."""
    
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
        
        # Create results
        self.result1 = StudentResult.objects.create(
            student=self.student1,
            module=self.module1,
            term_code='202400',
            raw_grade='85',
            processed_grade='PASS',
            numeric_grade=85.0,
            recorded_date='2024-06-01'
        )
        
        self.result2 = StudentResult.objects.create(
            student=self.student2,
            module=self.module2,
            term_code='202400',
            raw_grade='75',
            processed_grade='PASS',
            numeric_grade=75.0,
            recorded_date='2024-06-01'
        )
    
    def test_admin_can_list_all_results(self):
        """Test that admin can list all results."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/grades/student-results/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_admin_can_create_result(self):
        """Test that admin can create a result."""
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'student_id': 'R00111111',
            'module_code': 'CYBR8002',
            'term_code': '202400',
            'raw_grade': '90',
            'processed_grade': 'PASS',
            'numeric_grade': 90.0,
            'recorded_date': '2024-06-01'
        }
        response = self.client.post('/api/grades/student-results/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_lecturer_can_list_assigned_results(self):
        """Test that lecturer can only see results for assigned modules."""
        self.client.force_authenticate(user=self.lecturer_user)
        response = self.client.get('/api/grades/student-results/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see result1 (for module1 assigned to lecturer)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['result_id'], self.result1.result_id)
    
    def test_lecturer_can_create_result_for_assigned_module(self):
        """Test that lecturer can create result for assigned module."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {
            'student_id': 'R00111111',
            'module_code': 'CYBR8001',
            'term_code': '202401',
            'raw_grade': '88',
            'processed_grade': 'PASS',
            'numeric_grade': 88.0,
            'recorded_date': '2024-06-15'
        }
        response = self.client.post('/api/grades/student-results/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_lecturer_cannot_create_result_for_unassigned_module(self):
        """Test that lecturer cannot create result for unassigned module."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {
            'student_id': 'R00111111',
            'module_code': 'CYBR8002',
            'term_code': '202400',
            'raw_grade': '90',
            'processed_grade': 'PASS',
            'numeric_grade': 90.0,
            'recorded_date': '2024-06-01'
        }
        response = self.client.post('/api/grades/student-results/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_lecturer_can_update_assigned_result(self):
        """Test that lecturer can update result for assigned module."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {'numeric_grade': 90.0}
        response = self.client.patch(f'/api/grades/student-results/{self.result1.result_id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_lecturer_cannot_update_unassigned_result(self):
        """Lecturer queryset hides unassigned rows, so PATCH returns 404 (not 403)."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {'numeric_grade': 80.0}
        response = self.client.patch(f'/api/grades/student-results/{self.result2.result_id}/', data)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_student_can_list_own_results(self):
        """Test that student can list their own results."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/grades/student-results/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see result1 (own result)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['result_id'], self.result1.result_id)
    
    def test_student_cannot_view_other_results(self):
        """Test that student cannot view other students' results."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(f'/api/grades/student-results/{self.result2.result_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_student_cannot_create_result(self):
        """Test that student cannot create a result."""
        self.client.force_authenticate(user=self.student_user)
        data = {
            'student_id': 'R00111111',
            'module_code': 'CYBR8001',
            'term_code': '202401',
            'raw_grade': '88',
            'processed_grade': 'PASS',
            'numeric_grade': 88.0,
            'recorded_date': '2024-06-15'
        }
        response = self.client.post('/api/grades/student-results/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
