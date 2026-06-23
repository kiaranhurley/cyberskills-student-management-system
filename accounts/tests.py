from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Role, UserRole

User = get_user_model()


class UserModelTest(TestCase):
    """Test User model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_user_creation(self):
        """Test user can be created."""
        self.assertEqual(self.user.username, 'testuser')
        self.assertEqual(self.user.email, 'test@example.com')
        self.assertTrue(self.user.check_password('testpass123'))

    def test_user_str(self):
        """Test user string representation."""
        self.assertEqual(str(self.user), 'testuser')


class RoleModelTest(TestCase):
    """Test Role model."""
    
    def setUp(self):
        self.role = Role.objects.create(
            name='STUDENT',
            description='Student role'
        )

    def test_role_creation(self):
        """Test role can be created."""
        self.assertEqual(self.role.name, 'STUDENT')
        self.assertEqual(self.role.description, 'Student role')

    def test_role_str(self):
        """Test role string representation."""
        self.assertEqual(str(self.role), 'Student')


class UserRoleModelTest(TestCase):
    """Test UserRole model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.role = Role.objects.create(name='STUDENT')
        self.user_role = UserRole.objects.create(user=self.user, role=self.role)

    def test_user_role_creation(self):
        """Test user role can be created."""
        self.assertEqual(self.user_role.user, self.user)
        self.assertEqual(self.user_role.role, self.role)

    def test_user_role_unique_together(self):
        """Test that same user-role combination cannot be created twice."""
        with self.assertRaises(Exception):
            UserRole.objects.create(user=self.user, role=self.role)


class AuthenticationAPITest(TestCase):
    """Test authentication API endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_register_user(self):
        """Test user registration."""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'newpass123',
            'first_name': 'New',
            'last_name': 'User'
        }
        response = self.client.post('/api/auth/register/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login(self):
        """Test user login."""
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        response = self.client.post('/api/auth/login/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_profile_requires_authentication(self):
        """Test that profile endpoint requires authentication."""
        response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_with_authentication(self):
        """Test profile endpoint with authentication."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
