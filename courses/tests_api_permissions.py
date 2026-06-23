"""
Permission tests for Course API endpoints.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import Role, UserRole, LecturerCourse
from .models import Programme, Module, ProgrammeModuleAssociation

User = get_user_model()


class CoursePermissionTest(TestCase):
    """Test role-based permissions for Course endpoints."""
    
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
            username='student',
            email='student@example.com',
            password='studentpass123'
        )
        UserRole.objects.create(user=self.student_user, role=self.student_role)
        
        # Create test data
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
        
        # Assign lecturer to module1 only
        LecturerCourse.objects.create(
            user=self.lecturer_user,
            module_code=self.module1,
            term_code='202400'
        )
        
        # Create association
        ProgrammeModuleAssociation.objects.create(
            programme=self.programme,
            module=self.module1,
        )
    
    def test_admin_can_list_all_modules(self):
        """Test that admin can list all modules."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/courses/modules/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_admin_can_create_module(self):
        """Test that admin can create a module."""
        self.client.force_authenticate(user=self.admin_user)
        data = {
            'module_code': 'CYBR8003',
            'module_name': 'New Module'
        }
        response = self.client.post('/api/courses/modules/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Module.objects.filter(module_code='CYBR8003').exists())
    
    def test_lecturer_can_list_assigned_modules(self):
        """Test that lecturer can only see assigned modules."""
        self.client.force_authenticate(user=self.lecturer_user)
        response = self.client.get('/api/courses/modules/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see module1 (assigned to lecturer)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['module_code'], 'CYBR8001')
    
    def test_lecturer_cannot_create_module(self):
        """Test that lecturer cannot create a module."""
        self.client.force_authenticate(user=self.lecturer_user)
        data = {
            'module_code': 'CYBR8004',
            'module_name': 'New Module'
        }
        response = self.client.post('/api/courses/modules/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_student_can_list_all_modules(self):
        """Test that student can list all modules (read-only)."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/courses/modules/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_student_cannot_create_module(self):
        """Test that student cannot create a module."""
        self.client.force_authenticate(user=self.student_user)
        data = {
            'module_code': 'CYBR8005',
            'module_name': 'New Module'
        }
        response = self.client.post('/api/courses/modules/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_admin_can_list_all_programmes(self):
        """Test that admin can list all programmes."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/courses/programmes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
    
    def test_lecturer_can_list_programmes_with_assigned_modules(self):
        """Test that lecturer can see programmes containing assigned modules."""
        self.client.force_authenticate(user=self.lecturer_user)
        response = self.client.get('/api/courses/programmes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see programme containing module1
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['programme_code'], 'CS101')

    def test_admin_pathway_enrollment_counts(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/courses/programmes/pathway-enrollment-counts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('counts', response.data)
        self.assertIn('term_code', response.data)

    def test_lecturer_cannot_pathway_enrollment_counts(self):
        self.client.force_authenticate(user=self.lecturer_user)
        response = self.client.get('/api/courses/programmes/pathway-enrollment-counts/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
