"""
Permission tests for Student API endpoints.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import Role, UserRole, LecturerCourse
from .models import Student
from courses.models import Module
from enrollments.models import StudentModule

User = get_user_model()


class StudentPermissionTest(TestCase):
    """Test role-based permissions for Student endpoints."""
    
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
        
        self.module = Module.objects.create(
            module_code='CYBR8001',
            module_name='Test Module'
        )
        
        # Assign lecturer to module
        LecturerCourse.objects.create(
            user=self.lecturer_user,
            module_code=self.module,
            term_code='202400'
        )
        
        # Create enrollment linking student1 to lecturer's module
        StudentModule.objects.create(
            student=self.student1,
            module=self.module,
            term_code='202400',
            enroll_status='ACTIVE',
            enrollment_date='2024-01-01'
        )
    
    def test_admin_can_list_all_students(self):
        """Test that admin can list all students."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/students/students/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_admin_cannot_create_student_on_read_only_endpoint(self):
        """Test admin cannot create on GET-only endpoint."""
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'student_id': 'R00333333',
            'first_name': 'New',
            'last_name': 'Student',
            'personal_email': 'new@example.com'
        }
        response = self.client.post('/api/students/students/', data)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertFalse(Student.objects.filter(student_id='R00333333').exists())
    
    def test_admin_cannot_update_student_on_read_only_endpoint(self):
        """Test admin cannot update on GET-only endpoint."""
        self.client.force_authenticate(user=self.admin_user)
        data = {'first_name': 'Updated'}
        response = self.client.patch(f'/api/students/students/{self.student1.student_id}/', data)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.student1.refresh_from_db()
        self.assertEqual(self.student1.first_name, 'John')
    
    def test_admin_cannot_delete_student_on_read_only_endpoint(self):
        """Test admin cannot delete on GET-only endpoint."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(f'/api/students/students/{self.student2.student_id}/')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Student.objects.filter(student_id='R00222222').exists())
    
    def test_lecturer_can_list_assigned_students(self):
        """Test that lecturer can only see students enrolled in assigned modules."""
        self.client.force_authenticate(user=self.lecturer_user)
        response = self.client.get('/api/students/students/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see student1 (enrolled in assigned module)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['student_id'], 'R00111111')
    
    def test_lecturer_cannot_create_student(self):
        """Test that lecturer cannot create a student."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {
            'student_id': 'R00444444',
            'first_name': 'New',
            'last_name': 'Student',
            'personal_email': 'new@example.com'
        }
        response = self.client.post('/api/students/students/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_lecturer_cannot_update_student(self):
        """Test that lecturer cannot update a student."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {'first_name': 'Updated'}
        response = self.client.patch(f'/api/students/students/{self.student1.student_id}/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_student_can_view_own_record(self):
        """Test that student can view their own record."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(f'/api/students/students/{self.student1.student_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['student_id'], 'R00111111')
    
    def test_student_cannot_view_other_students(self):
        """Test that student cannot view other students' records."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(f'/api/students/students/{self.student2.student_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_student_cannot_create_student(self):
        """Test that student cannot create a student."""
        self.client.force_authenticate(user=self.student_user)
        data = {
            'student_id': 'R00555555',
            'first_name': 'New',
            'last_name': 'Student',
            'personal_email': 'new@example.com'
        }
        response = self.client.post('/api/students/students/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_unauthenticated_cannot_access(self):
        """Test that unauthenticated users cannot access."""
        response = self.client.get('/api/students/students/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


