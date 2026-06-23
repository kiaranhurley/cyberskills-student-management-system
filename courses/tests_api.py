from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import Role, UserRole
from .models import Programme, Module, ProgrammeModuleAssociation

User = get_user_model()


class CourseAPIIntegrationTest(TestCase):
    """Integration tests for Course API."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        admin_role = Role.objects.get_or_create(name='ADMIN')[0]
        UserRole.objects.create(user=self.user, role=admin_role)
        self.client.force_authenticate(user=self.user)

    def test_create_programme(self):
        """Test creating a programme via API."""
        data = {
            'programme_code': 'CS101',
            'programme_name': 'Computer Science Fundamentals',
            'credits': 60
        }
        response = self.client.post('/api/courses/programmes/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Programme.objects.count(), 1)

    def test_create_module(self):
        """Test creating a module via API."""
        data = {
            'module_code': 'DB101',
            'module_name': 'Database Fundamentals',
            'credits': 5
        }
        response = self.client.post('/api/courses/modules/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Module.objects.count(), 1)

    def test_create_programme_module_association(self):
        """Test creating a programme-module association via API."""
        programme = Programme.objects.create(
            programme_code='CS101',
            programme_name='Computer Science'
        )
        module = Module.objects.create(
            module_code='DB101',
            module_name='Database Fundamentals'
        )
        
        data = {
            'programme_code': 'CS101',
            'module_code': 'DB101',
            'semester': 1,
        }
        response = self.client.post('/api/courses/programme-module-associations/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProgrammeModuleAssociation.objects.count(), 1)
