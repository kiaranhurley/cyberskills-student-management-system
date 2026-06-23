"""
Django management command to load student data from Excel/CSV files.
"""
import os
from collections import Counter, defaultdict
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError
from django.db import transaction
from students.models import Student
from enrollments.models import StudentProgram, StudentModule
from courses.models import Programme, Module, ProgrammeModuleAssociation
from students.management.commands.migration_utils import (
    normalize_term_code,
    normalize_student_id,
    normalize_module_code,
    term_code_to_date,
    map_enrollment_status,
)


class Command(BaseCommand):
    help = 'Load student data from Excel or CSV files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to student data file (Excel or CSV)',
            default='data/Allterms_Cyberskills Students With Contact Details Report.xlsx'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving to database',
        )
        parser.add_argument(
            '--skip-missing-programmes',
            action='store_true',
            help='Skip student programs if programme does not exist',
        )
        parser.add_argument(
            '--skip-missing-modules',
            action='store_true',
            help='Skip student modules if module does not exist',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        file_path = options['file']
        skip_missing_programmes = options['skip_missing_programmes']
        skip_missing_modules = options['skip_missing_modules']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))

        if not os.path.exists(file_path):
            raise CommandError(f'File not found: {file_path}')

        self.stdout.write(f'Loading students from: {file_path}')

        try:
            # Read file (supports both Excel and CSV)
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)

            students_created = 0
            students_updated = 0
            programs_created = 0
            modules_created = 0
            programs_inferred = 0
            errors = []

            with transaction.atomic():
                def infer_programme_for_modules(module_codes):
                    code_sets = []
                    counts = Counter()
                    for module_code in module_codes:
                        p_codes = set(
                            ProgrammeModuleAssociation.objects.filter(module__module_code=module_code)
                            .values_list('programme__programme_code', flat=True)
                            .distinct()
                        )
                        if not p_codes:
                            continue
                        code_sets.append(p_codes)
                        counts.update(p_codes)

                    if not code_sets:
                        return None

                    intersection = set.intersection(*code_sets)
                    if intersection:
                        return sorted(intersection)[0]

                    # Fallback: use most frequent programme across module associations
                    if counts:
                        return counts.most_common(1)[0][0]
                    return None

                # Group by student_id to process each student once
                for student_id, group in df.groupby('STUDENT_ID'):
                    try:
                        student_id = normalize_student_id(student_id)
                        if not student_id:
                            continue

                        first_row = group.iloc[0]

                        # Extract name components
                        first_name = str(first_row.get('FIRST_NAME', '')).strip()
                        last_name = str(first_row.get('LAST_NAME', '')).strip()
                        
                        # Fallback: try to split NAME field if FIRST_NAME/LAST_NAME not available
                        if not first_name and not last_name:
                            name = str(first_row.get('NAME', '')).strip()
                            if name:
                                name_parts = name.split(' ', 1)
                                first_name = name_parts[0] if len(name_parts) > 0 else ''
                                last_name = name_parts[1] if len(name_parts) > 1 else ''

                        # Extract emails
                        personal_email = str(first_row.get('PERSONAL_EMAIL', '')).strip() or None
                        student_email = str(first_row.get('STUDENT_EMAIL', '')).strip() or None
                        
                        # Clean up email values
                        if personal_email and personal_email.lower() in ['nan', 'none', '']:
                            personal_email = None
                        if student_email and student_email.lower() in ['nan', 'none', '']:
                            student_email = None

                        # Create or update Student
                        student, created = Student.objects.update_or_create(
                            student_id=student_id,
                            defaults={
                                'first_name': first_name or 'Unknown',
                                'last_name': last_name or 'Unknown',
                                'personal_email': personal_email or '',
                                'student_email': student_email or '',
                            }
                        )

                        # Validate student (triggers clean() method)
                        try:
                            student.full_clean()
                            if not dry_run:
                                student.save()
                        except ValidationError as e:
                            # Try to fix: if no emails, use placeholder
                            if not student.personal_email and not student.student_email:
                                student.personal_email = f'{student_id}@placeholder.local'
                                student.student_email = ''
                                try:
                                    student.full_clean()
                                    if not dry_run:
                                        student.save()
                                    self.stdout.write(self.style.WARNING(
                                        f'  Student {student_id}: Added placeholder email (no email provided)'
                                    ))
                                except ValidationError:
                                    errors.append(f'Student {student_id}: Cannot create without email')
                                    continue
                            else:
                                errors.append(f'Student {student_id}: Validation error - {e}')
                                continue

                        if created:
                            students_created += 1
                        else:
                            students_updated += 1

                        # Process enrollments for this student
                        term_module_codes = defaultdict(set)
                        term_statuses = {}

                        for _, row in group.iterrows():
                            # Normalize term_code
                            term_code = normalize_term_code(row.get('TERM_CODE', ''))
                            if not term_code:
                                continue

                            # Derive enrollment date from term_code
                            enrollment_date = term_code_to_date(term_code, 'start')
                            if not enrollment_date:
                                enrollment_date = term_code_to_date('202400', 'start')  # Fallback

                            module_code = normalize_module_code(row.get('MODULE_CODE', ''))
                            programme_code = normalize_module_code(row.get('PROGRAM', ''))

                            programme = None
                            if programme_code:
                                try:
                                    programme = Programme.objects.get(programme_code=programme_code)
                                except Programme.DoesNotExist:
                                    programme = None

                            # Legacy-style linkage support:
                            # If programme is missing but module exists in exactly one curated programme,
                            # infer that programme so student_modules and student_programs stay aligned by term.
                            if not programme and module_code:
                                inferred_codes = list(
                                    ProgrammeModuleAssociation.objects.filter(module__module_code=module_code)
                                    .values_list('programme__programme_code', flat=True)
                                    .distinct()
                                )
                                if len(inferred_codes) == 1:
                                    try:
                                        programme = Programme.objects.get(programme_code=inferred_codes[0])
                                        programs_inferred += 1
                                    except Programme.DoesNotExist:
                                        programme = None

                            enroll_status = map_enrollment_status(row.get('ENROL_STATUS', ''))
                            if programme:
                                program, created = StudentProgram.objects.get_or_create(
                                    student=student,
                                    programme=programme,
                                    term_code=term_code,
                                    defaults={
                                        'enroll_status': enroll_status,
                                        'enrollment_date': enrollment_date,
                                    }
                                )
                                if created and not dry_run:
                                    programs_created += 1
                            elif programme_code:
                                if skip_missing_programmes:
                                    self.stdout.write(self.style.WARNING(
                                        f'  Skipping program {programme_code} for student {student_id} (programme not found)'
                                    ))
                                else:
                                    errors.append(f'Student {student_id}: Programme {programme_code} not found')

                            # Process StudentModule
                            if module_code:
                                try:
                                    module = Module.objects.get(module_code=module_code)
                                    module_status = map_enrollment_status(row.get('CRN_REG_STATUS', row.get('ENROL_STATUS', '')))
                                    
                                    module_enrollment, created = StudentModule.objects.get_or_create(
                                        student=student,
                                        module=module,
                                        term_code=term_code,
                                        defaults={
                                            'enroll_status': module_status,
                                            'enrollment_date': enrollment_date,
                                        }
                                    )

                                    if created and not dry_run:
                                        modules_created += 1
                                    term_module_codes[term_code].add(module_code)
                                    term_statuses.setdefault(term_code, module_status)
                                except Module.DoesNotExist:
                                    if skip_missing_modules:
                                        self.stdout.write(self.style.WARNING(
                                            f'  Skipping module {module_code} for student {student_id} (module not found)'
                                        ))
                                    else:
                                        errors.append(f'Student {student_id}: Module {module_code} not found')

                        # Second pass to mimic legacy linkage:
                        # ensure a student+term programme row exists where modules exist.
                        for term_code, module_codes in term_module_codes.items():
                            has_program = StudentProgram.objects.filter(student=student, term_code=term_code).exists()
                            if has_program:
                                continue
                            inferred_programme_code = infer_programme_for_modules(module_codes)
                            if not inferred_programme_code:
                                continue
                            try:
                                inferred_programme = Programme.objects.get(programme_code=inferred_programme_code)
                            except Programme.DoesNotExist:
                                continue

                            program, created = StudentProgram.objects.get_or_create(
                                student=student,
                                programme=inferred_programme,
                                term_code=term_code,
                                defaults={
                                    'enroll_status': term_statuses.get(term_code, 'ACTIVE'),
                                    'enrollment_date': term_code_to_date(term_code, 'start') or enrollment_date,
                                },
                            )
                            if created:
                                programs_inferred += 1
                                if not dry_run:
                                    programs_created += 1

                    except Exception as e:
                        errors.append(f'Student {student_id}: {str(e)}')
                        self.stdout.write(self.style.ERROR(f'  Error processing student {student_id}: {e}'))
                        continue

                if dry_run:
                    self.stdout.write(self.style.WARNING('\nDRY RUN - Rolling back changes'))
                    transaction.set_rollback(True)
                    return

            # Report results
            self.stdout.write(self.style.SUCCESS(
                f'\nMigration Summary:\n'
                f'  Students created: {students_created}\n'
                f'  Students updated: {students_updated}\n'
                f'  Program enrollments created: {programs_created}\n'
                f'  Module enrollments created: {modules_created}\n'
                f'  Program enrollments inferred from module associations: {programs_inferred}'
            ))

            if errors:
                self.stdout.write(self.style.WARNING(f'\nErrors encountered: {len(errors)}'))
                for error in errors[:10]:  # Show first 10 errors
                    self.stdout.write(self.style.WARNING(f'  - {error}'))
                if len(errors) > 10:
                    self.stdout.write(self.style.WARNING(f'  ... and {len(errors) - 10} more errors'))

        except transaction.TransactionManagementError:
            # Dry run rollback - this is expected
            pass
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error loading students: {e}'))
            raise CommandError(f'Migration failed: {e}')
