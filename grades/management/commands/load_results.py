"""
Django management command to load student results/grades from Excel files.
"""
import os
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from students.models import Student
from courses.models import Module
from grades.models import StudentResult
from students.management.commands.migration_utils import (
    normalize_term_code,
    normalize_student_id,
    normalize_module_code,
    term_code_to_date,
    process_grade,
)


class Command(BaseCommand):
    help = 'Load student results/grades from Excel files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to results Excel file',
            default='data/Cyberskills Students With Results Details Report_all_years_april_2024.xlsx'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving to database',
        )
        parser.add_argument(
            '--skip-missing-modules',
            action='store_true',
            help='Skip results if module does not exist',
        )
        parser.add_argument(
            '--create-missing-modules',
            action='store_true',
            help='Create placeholder modules if they do not exist',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        file_path = options['file']
        skip_missing_modules = options['skip_missing_modules']
        create_missing_modules = options['create_missing_modules']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))

        if not os.path.exists(file_path):
            raise CommandError(f'File not found: {file_path}')

        self.stdout.write(f'Loading results from: {file_path}')

        try:
            # Read Excel file
            # Try common sheet names
            sheet_names = [
                'Cyberskills Students With Resul',
                'Cyberskills Students With Results',
                'Results',
                'Sheet1',
            ]
            
            df = None
            for sheet_name in sheet_names:
                try:
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    self.stdout.write(f'  Reading sheet: {sheet_name}')
                    break
                except (ValueError, KeyError):
                    continue

            if df is None:
                # Try reading first sheet
                df = pd.read_excel(file_path, sheet_name=0)

            results_created = 0
            errors = []
            missing_modules = set()

            with transaction.atomic():
                for _, row in df.iterrows():
                    try:
                        # Get student
                        student_id = normalize_student_id(row.get('STUDENT_ID', ''))
                        if not student_id:
                            continue

                        try:
                            student = Student.objects.get(student_id=student_id)
                        except Student.DoesNotExist:
                            errors.append(f'Student {student_id} not found')
                            continue

                        # Get module - try by code first, then by description
                        module_code = normalize_module_code(row.get('MODULE_CODE', ''))
                        module_desc = str(row.get('MODULE_DESC', '')).strip()

                        module = None
                        if module_code:
                            try:
                                module = Module.objects.get(module_code=module_code)
                            except Module.DoesNotExist:
                                pass

                        # If not found by code, try by description
                        if not module and module_desc:
                            try:
                                module = Module.objects.get(module_name__icontains=module_desc[:50])
                            except (Module.DoesNotExist, Module.MultipleObjectsReturned):
                                pass

                        # Handle missing module
                        if not module:
                            if create_missing_modules and module_code:
                                # Create placeholder module
                                module, _ = Module.objects.get_or_create(
                                    module_code=module_code,
                                    defaults={
                                        'module_name': module_desc or module_code,
                                        'description': f'Auto-created from results import',
                                    }
                                )
                                self.stdout.write(self.style.WARNING(
                                    f'  Created placeholder module: {module_code}'
                                ))
                            elif skip_missing_modules:
                                missing_modules.add(module_code or module_desc)
                                continue
                            else:
                                errors.append(f'Module not found: {module_code or module_desc}')
                                continue

                        # Normalize term_code
                        term_code = normalize_term_code(row.get('TERM_CODE', ''))
                        if not term_code:
                            continue

                        # Process grade
                        raw_grade, processed_grade, numeric_grade = process_grade(row.get('GRADE'))

                        # Derive recorded_date from term_code (end of semester)
                        recorded_date = term_code_to_date(term_code, 'end')
                        if not recorded_date:
                            recorded_date = term_code_to_date(term_code, 'start')
                        if not recorded_date:
                            # Fallback to a reasonable date
                            from datetime import date
                            recorded_date = date.today()

                        # Create or update result
                        # Note: StudentResult doesn't have unique constraint on (student, module, term_code)
                        # So we'll create new records (or use update_or_create if needed)
                        result, created = StudentResult.objects.get_or_create(
                            student=student,
                            module=module,
                            term_code=term_code,
                            defaults={
                                'raw_grade': raw_grade,
                                'processed_grade': processed_grade,
                                'numeric_grade': numeric_grade,
                                'recorded_date': recorded_date,
                            }
                        )

                        if created and not dry_run:
                            results_created += 1

                    except Exception as e:
                        errors.append(f'Row {_}: {str(e)}')
                        self.stdout.write(self.style.ERROR(f'  Error processing row: {e}'))
                        continue

                if dry_run:
                    self.stdout.write(self.style.WARNING('\nDRY RUN - Rolling back changes'))
                    transaction.set_rollback(True)
                    return

            # Report results
            self.stdout.write(self.style.SUCCESS(
                f'\nMigration Summary:\n'
                f'  Results created: {results_created}'
            ))

            if missing_modules:
                self.stdout.write(self.style.WARNING(
                    f'\nSkipped {len(missing_modules)} results due to missing modules'
                ))
                for mod in list(missing_modules)[:10]:
                    self.stdout.write(self.style.WARNING(f'  - {mod}'))

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
            self.stdout.write(self.style.ERROR(f'Error loading results: {e}'))
            raise CommandError(f'Migration failed: {e}')
