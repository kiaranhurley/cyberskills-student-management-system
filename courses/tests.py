from django.test import TestCase
from .models import Programme, Module, ProgrammeModuleAssociation


class ProgrammeModelTest(TestCase):
    """Test Programme model."""
    
    def setUp(self):
        self.programme = Programme.objects.create(
            programme_code='CS101',
            programme_name='Computer Science Fundamentals',
            credits=60
        )

    def test_programme_creation(self):
        """Test programme can be created."""
        self.assertEqual(self.programme.programme_code, 'CS101')
        self.assertEqual(self.programme.programme_name, 'Computer Science Fundamentals')

    def test_programme_str(self):
        """Test programme string representation."""
        self.assertEqual(str(self.programme), 'CS101 - Computer Science Fundamentals')


class ModuleModelTest(TestCase):
    """Test Module model."""
    
    def setUp(self):
        self.module = Module.objects.create(
            module_code='DB101',
            module_name='Database Fundamentals',
            credits=5
        )

    def test_module_creation(self):
        """Test module can be created."""
        self.assertEqual(self.module.module_code, 'DB101')
        self.assertEqual(self.module.module_name, 'Database Fundamentals')

    def test_module_str(self):
        """Test module string representation."""
        self.assertEqual(str(self.module), 'DB101 - Database Fundamentals')


class ProgrammeModuleAssociationTest(TestCase):
    """Test ProgrammeModuleAssociation model."""
    
    def setUp(self):
        self.programme = Programme.objects.create(
            programme_code='CS101',
            programme_name='Computer Science Fundamentals'
        )
        self.module = Module.objects.create(
            module_code='DB101',
            module_name='Database Fundamentals'
        )
        self.association = ProgrammeModuleAssociation.objects.create(
            programme=self.programme,
            module=self.module,
            semester=1,
        )

    def test_association_creation(self):
        """Test programme-module association can be created."""
        self.assertEqual(self.association.programme, self.programme)
        self.assertEqual(self.association.module, self.module)

    def test_association_str(self):
        """Test association string representation."""
        self.assertIn('CS101', str(self.association))
        self.assertIn('DB101', str(self.association))
