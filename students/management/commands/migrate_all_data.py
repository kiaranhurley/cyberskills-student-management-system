"""
Django management command to run complete data migration workflow.
Executes all migration commands in the correct order.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = 'Run complete data migration workflow (programmes -> students -> results -> employers -> validation)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving to database',
        )
        parser.add_argument(
            '--skip-programmes',
            action='store_true',
            help='Skip loading programmes/modules',
        )
        parser.add_argument(
            '--skip-students',
            action='store_true',
            help='Skip loading students',
        )
        parser.add_argument(
            '--skip-results',
            action='store_true',
            help='Skip loading results',
        )
        parser.add_argument(
            '--skip-employers',
            action='store_true',
            help='Skip updating employers',
        )
        parser.add_argument(
            '--skip-validation',
            action='store_true',
            help='Skip validation step',
        )
        parser.add_argument(
            '--programmes-file',
            type=str,
            help='Path to programmes Excel file',
            default='data/MyBan Catalog.xlsx',
        )
        parser.add_argument(
            '--students-file',
            type=str,
            help='Path to students Excel/CSV file',
            default='data/Allterms_Cyberskills Students With Contact Details Report.xlsx',
        )
        parser.add_argument(
            '--results-file',
            type=str,
            help='Path to results Excel file',
            default='data/Cyberskills Students With Results Details Report_all_years_april_2024.xlsx',
        )
        parser.add_argument(
            '--employers-file',
            type=str,
            help='Path to employers Excel file',
            default='data/All_applicant_details_2024_2025.xlsx',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        skip_programmes = options['skip_programmes']
        skip_students = options['skip_students']
        skip_results = options['skip_results']
        skip_employers = options['skip_employers']
        skip_validation = options['skip_validation']

        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Complete Data Migration Workflow'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN MODE - No changes will be saved\n'))

        errors = []

        try:
            # Step 1: Load Programmes and Modules (must be first for ForeignKeys)
            if not skip_programmes:
                self.stdout.write(self.style.SUCCESS('\n[1/5] Loading Programmes and Modules...'))
                self.stdout.write('-' * 60)
                try:
                    call_command(
                        'load_programmes',
                        file=options['programmes_file'],
                        dry_run=dry_run,
                    )
                except Exception as e:
                    error_msg = f'Failed to load programmes: {e}'
                    errors.append(error_msg)
                    self.stdout.write(self.style.ERROR(f'  ERROR: {error_msg}'))
                    if not dry_run:
                        raise CommandError(error_msg)
            else:
                self.stdout.write(self.style.WARNING('\n[1/5] Skipping Programmes and Modules'))

            # Step 2: Load Students and Enrollments
            if not skip_students:
                self.stdout.write(self.style.SUCCESS('\n[2/5] Loading Students and Enrollments...'))
                self.stdout.write('-' * 60)
                try:
                    call_command(
                        'load_students',
                        file=options['students_file'],
                        dry_run=dry_run,
                        skip_missing_programmes=True,
                        skip_missing_modules=True,
                    )
                except Exception as e:
                    error_msg = f'Failed to load students: {e}'
                    errors.append(error_msg)
                    self.stdout.write(self.style.ERROR(f'  ERROR: {error_msg}'))
                    if not dry_run:
                        raise CommandError(error_msg)
            else:
                self.stdout.write(self.style.WARNING('\n[2/5] Skipping Students'))

            # Step 3: Load Results
            if not skip_results:
                self.stdout.write(self.style.SUCCESS('\n[3/5] Loading Results...'))
                self.stdout.write('-' * 60)
                try:
                    call_command(
                        'load_results',
                        file=options['results_file'],
                        dry_run=dry_run,
                        skip_missing_modules=True,
                    )
                except Exception as e:
                    error_msg = f'Failed to load results: {e}'
                    errors.append(error_msg)
                    self.stdout.write(self.style.ERROR(f'  ERROR: {error_msg}'))
                    if not dry_run:
                        raise CommandError(error_msg)
            else:
                self.stdout.write(self.style.WARNING('\n[3/5] Skipping Results'))

            # Step 4: Update Employers
            if not skip_employers:
                self.stdout.write(self.style.SUCCESS('\n[4/5] Updating Employers...'))
                self.stdout.write('-' * 60)
                try:
                    call_command(
                        'update_employers',
                        file=options['employers_file'],
                        dry_run=dry_run,
                    )
                except Exception as e:
                    error_msg = f'Failed to update employers: {e}'
                    errors.append(error_msg)
                    self.stdout.write(self.style.ERROR(f'  ERROR: {error_msg}'))
                    # Don't fail on employer updates - they're not critical
            else:
                self.stdout.write(self.style.WARNING('\n[4/5] Skipping Employers'))

            # Step 5: Validate Migration
            if not skip_validation:
                self.stdout.write(self.style.SUCCESS('\n[5/5] Validating Migration...'))
                self.stdout.write('-' * 60)
                try:
                    call_command('validate_migration', detailed=True)
                except Exception as e:
                    error_msg = f'Validation encountered errors: {e}'
                    errors.append(error_msg)
                    self.stdout.write(self.style.WARNING(f'  WARNING: {error_msg}'))
            else:
                self.stdout.write(self.style.WARNING('\n[5/5] Skipping Validation'))

            # Final Summary
            self.stdout.write('\n' + self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS('Migration Workflow Complete'))
            self.stdout.write(self.style.SUCCESS('=' * 60))

            if errors:
                self.stdout.write(self.style.WARNING(f'\nCompleted with {len(errors)} error(s):'))
                for error in errors:
                    self.stdout.write(self.style.WARNING(f'  - {error}'))
            else:
                self.stdout.write(self.style.SUCCESS('\nAll steps completed successfully!'))

        except CommandError as e:
            self.stdout.write(self.style.ERROR(f'\nMigration failed: {e}'))
            raise
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nUnexpected error: {e}'))
            raise CommandError(f'Migration workflow failed: {e}')
