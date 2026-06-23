from django.core.management.base import BaseCommand
from accounts.models import Role


class Command(BaseCommand):
    help = 'Create default roles if they do not exist'

    def handle(self, *args, **options):
        roles = [
            {'name': 'ADMIN', 'description': 'Full system access for administrators'},
            {'name': 'LECTURER', 'description': 'Access to assigned courses and students, can submit grades'},
            {'name': 'STUDENT', 'description': 'Access to own academic records'},
        ]

        for role_data in roles:
            role, created = Role.objects.get_or_create(
                name=role_data['name'],
                defaults={'description': role_data['description']}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created role: {role.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Role already exists: {role.name}'))
