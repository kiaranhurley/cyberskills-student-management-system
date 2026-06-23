from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Role, UserRole

User = get_user_model()


class AuthenticationAPIIntegrationTest(TestCase):
    """Integration tests for authentication API."""
    
    def setUp(self):
        self.client = APIClient()
        # Create roles
        self.admin_role = Role.objects.create(name='ADMIN')
        self.student_role = Role.objects.create(name='STUDENT')

    def test_register_user_creates_student_role(self):
        """Test that registering a user automatically assigns STUDENT role."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'testpass123',
            'first_name': 'New',
            'last_name': 'User'
        }
        response = self.client.post('/api/auth/register/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        user = User.objects.get(username='newuser')
        self.assertTrue(user.user_roles.filter(role=self.student_role).exists())

    def test_login_returns_tokens(self):
        """Test that login returns access and refresh tokens."""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post('/api/auth/login/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)

    def test_profile_endpoint_returns_user_data(self):
        """Test that profile endpoint returns correct user data."""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        UserRole.objects.create(user=user, role=self.student_role)
        
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
        self.assertEqual(response.data['email'], 'test@example.com')
        self.assertIn('roles', response.data)

    def test_roles_list_endpoint(self):
        """Test that roles list endpoint returns all roles."""
        # Ensure all roles exist
        Role.objects.get_or_create(name='ADMIN')
        Role.objects.get_or_create(name='LECTURER')
        Role.objects.get_or_create(name='STUDENT')
        
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/auth/roles/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)  # ADMIN, LECTURER, STUDENT
