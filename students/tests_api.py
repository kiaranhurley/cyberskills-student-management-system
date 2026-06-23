from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from accounts.models import Role, UserRole
from .models import Student

User = get_user_model()


class StudentAPIIntegrationTest(TestCase):
    """Integration tests for Student API."""
    
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

    def test_create_student_not_allowed(self):
        """Test student creation is not allowed (GET-only endpoint)."""
        data = {
            'student_id': 'R00111111',
            'first_name': 'John',
            'last_name': 'Doe',
            'personal_email': 'john@example.com',
            'student_email': 'john@student.mtu.ie'
        }
        response = self.client.post('/api/students/students/', data)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(Student.objects.count(), 0)

    def test_list_students(self):
        """Test listing students via API."""
        Student.objects.create(
            student_id='R00111111',
            first_name='John',
            last_name='Doe',
            personal_email='john@example.com'
        )
        Student.objects.create(
            student_id='R00111112',
            first_name='Jane',
            last_name='Smith',
            personal_email='jane@example.com'
        )
        
        response = self.client.get('/api/students/students/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)

    def test_get_student_by_id(self):
        """Test retrieving a specific student via API."""
        student = Student.objects.create(
            student_id='R00111111',
            first_name='John',
            last_name='Doe',
            personal_email='john@example.com'
        )
        
        response = self.client.get(f'/api/students/students/{student.student_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['student_id'], 'R00111111')
        self.assertEqual(response.data['first_name'], 'John')

    def test_update_student_not_allowed(self):
        """Test updating a student is not allowed (GET-only endpoint)."""
        student = Student.objects.create(
            student_id='R00111111',
            first_name='John',
            last_name='Doe',
            personal_email='john@example.com'
        )
        
        data = {
            'student_id': 'R00111111',
            'first_name': 'Johnny',
            'last_name': 'Doe',
            'personal_email': 'johnny@example.com'
        }
        response = self.client.put(f'/api/students/students/{student.student_id}/', data)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        student.refresh_from_db()
        self.assertEqual(student.first_name, 'John')

    def test_post_with_invalid_payload_not_allowed(self):
        """Test POST is blocked regardless of payload (GET-only endpoint)."""
        data = {
            'student_id': 'R00111111',
            'first_name': 'John',
            'last_name': 'Doe'
        }
        response = self.client.post('/api/students/students/', data)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


