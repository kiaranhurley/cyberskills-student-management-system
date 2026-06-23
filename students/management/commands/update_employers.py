"""
Django management command to update student employer information from Excel files.
"""
import os
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from students.models import Student


class Command(BaseCommand):
    help = 'Update student employer information from Excel file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to employer Excel file',
            default='data/All_applicant_details_2024_2025.xlsx'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving to database',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        file_path = options['file']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))

        if not os.path.exists(file_path):
            raise CommandError(f'File not found: {file_path}')

        self.stdout.write(f'Loading employer data from: {file_path}')

        try:
            # Read Excel file
            # Try common sheet names
            sheet_names = ['Applicants', 'Sheet1', 0]
            
            df = None
            for sheet_name in sheet_names:
                try:
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    self.stdout.write(f'  Reading sheet: {sheet_name if isinstance(sheet_name, str) else "first sheet"}')
                    break
                except (ValueError, KeyError):
                    continue

            if df is None:
                raise CommandError('Could not read Excel file')

            updated_count = 0
            not_found_count = 0
            errors = []

            with transaction.atomic():
                for _, row in df.iterrows():
                    try:
                        # Get email from various possible column names
                        email = None
                        email_columns = [
                            'df.Email.Address',
                            'Email.Address',
                            'Email',
                            'EMAIL',
                            'email',
                            'df.Email',
                        ]
                        
                        for col in email_columns:
                            if col in row and pd.notna(row[col]):
                                email = str(row[col]).strip()
                                if email and email.lower() not in ['nan', 'none', '']:
                                    break

                        if not email:
                            continue

                        # Get employer from various possible column names
                        employer = None
                        employer_columns = [
                            'Employer',
                            'df.Employer',
                            'EMPLOYER',
                            'employer',
                        ]
                        
                        for col in employer_columns:
                            if col in row and pd.notna(row[col]):
                                employer_val = str(row[col]).strip()
                                if employer_val and employer_val.lower() not in ['nan', 'none', '0', '']:
                                    employer = employer_val
                                    break

                        if not employer:
                            continue

                        # Find student by email (check both personal_email and student_email)
                        try:
                            student = Student.objects.filter(
                                personal_email=email
                            ).first() or Student.objects.filter(
                                student_email=email
                            ).first()

                            if student:
                                if student.employer != employer:
                                    if not dry_run:
                                        student.employer = employer
                                        student.save()
                                    updated_count += 1
                            else:
                                not_found_count += 1
                                self.stdout.write(self.style.WARNING(
                                    f'  Student not found for email: {email}'
                                ))

                        except Exception as e:
                            errors.append(f'Email {email}: {str(e)}')

                    except Exception as e:
                        errors.append(f'Row {_}: {str(e)}')
                        continue

                if dry_run:
                    self.stdout.write(self.style.WARNING('\nDRY RUN - Rolling back changes'))
                    transaction.set_rollback(True)
                    return

            # Report results
            self.stdout.write(self.style.SUCCESS(
                f'\nMigration Summary:\n'
                f'  Students updated: {updated_count}\n'
                f'  Students not found: {not_found_count}'
            ))

            if errors:
                self.stdout.write(self.style.WARNING(f'\nErrors encountered: {len(errors)}'))
                for error in errors[:10]:
                    self.stdout.write(self.style.WARNING(f'  - {error}'))
                if len(errors) > 10:
                    self.stdout.write(self.style.WARNING(f'  ... and {len(errors) - 10} more errors'))

        except transaction.TransactionManagementError:
            # Dry run rollback - this is expected
            pass
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error loading employers: {e}'))
            raise CommandError(f'Migration failed: {e}')
