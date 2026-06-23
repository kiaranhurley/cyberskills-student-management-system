"""
Django management command to validate data migration integrity.
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from students.models import Student
from enrollments.models import StudentProgram, StudentModule
from grades.models import StudentResult
from courses.models import Programme, Module


class Command(BaseCommand):
    help = 'Validate data migration integrity and check for issues'

    def add_arguments(self, parser):
        parser.add_argument(
            '--detailed',
            action='store_true',
            help='Show detailed validation report',
        )

    def handle(self, *args, **options):
        detailed = options['detailed']
        
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Data Migration Validation Report'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        issues = []
        warnings = []

        # 1. Check for StudentProgram records with invalid ForeignKeys
        orphaned_programs = []
        for sp in StudentProgram.objects.all()[:1000]:  # Sample check
            try:
                _ = sp.programme.programme_code
                _ = sp.student.student_id
            except (Programme.DoesNotExist, Student.DoesNotExist, AttributeError):
                orphaned_programs.append(sp)
        
        if orphaned_programs:
            issues.append(f'StudentProgram records with invalid ForeignKeys: {len(orphaned_programs)}')
            if detailed:
                for sp in orphaned_programs[:10]:
                    issues.append(f'  - StudentProgram ID {sp.enrollment_id}')

        # 2. Check for StudentModule records with invalid ForeignKeys
        orphaned_modules = []
        for sm in StudentModule.objects.all()[:1000]:  # Sample check
            try:
                _ = sm.module.module_code
                _ = sm.student.student_id
            except (Module.DoesNotExist, Student.DoesNotExist, AttributeError):
                orphaned_modules.append(sm)
        
        if orphaned_modules:
            issues.append(f'StudentModule records with invalid ForeignKeys: {len(orphaned_modules)}')
            if detailed:
                for sm in orphaned_modules[:10]:
                    issues.append(f'  - StudentModule ID {sm.enrollment_id}')

        # 3. Check for StudentResult records with invalid ForeignKeys
        orphaned_results = []
        for sr in StudentResult.objects.all()[:1000]:  # Sample check
            try:
                _ = sr.module.module_code
                _ = sr.student.student_id
            except (Module.DoesNotExist, Student.DoesNotExist, AttributeError):
                orphaned_results.append(sr)
        
        if orphaned_results:
            issues.append(f'StudentResult records with invalid ForeignKeys: {len(orphaned_results)}')
            if detailed:
                for sr in orphaned_results[:10]:
                    issues.append(f'  - StudentResult ID {sr.result_id}')

        # 4. Check for students without email
        students_no_email = Student.objects.filter(
            personal_email='',
            student_email=''
        )
        if students_no_email.exists():
            warnings.append(f'Students without email: {students_no_email.count()}')
            if detailed:
                for student in students_no_email[:10]:
                    warnings.append(f'  - {student.student_id}: {student.first_name} {student.last_name}')

        # 5. Check for duplicate student IDs (should not happen due to unique constraint)
        # This is more of a sanity check
        student_ids = Student.objects.values_list('student_id', flat=True).distinct()
        total_students = Student.objects.count()
        if len(student_ids) != total_students:
            issues.append(f'Potential duplicate student IDs detected')

        # 6. Check for invalid term codes
        invalid_term_codes = StudentProgram.objects.exclude(
            term_code__regex=r'^\d{5,6}$'
        )
        if invalid_term_codes.exists():
            warnings.append(f'StudentProgram records with invalid term codes: {invalid_term_codes.count()}')
            if detailed:
                for sp in invalid_term_codes[:10]:
                    warnings.append(f'  - Student {sp.student.student_id}, Term: {sp.term_code}')

        # 7. Check for students with enrollments but no basic info
        students_missing_info = Student.objects.filter(
            Q(first_name='Unknown') | Q(last_name='Unknown')
        )
        if students_missing_info.exists():
            warnings.append(f'Students with missing name information: {students_missing_info.count()}')

        # 8. Check for programmes/modules without enrollments (informational)
        programmes_no_enrollments = Programme.objects.filter(enrollments__isnull=True).distinct()
        modules_no_enrollments = Module.objects.filter(enrollments__isnull=True).distinct()
        
        if detailed:
            self.stdout.write('\n' + self.style.WARNING('Informational:'))
            self.stdout.write(f'  Programmes without enrollments: {programmes_no_enrollments.count()}')
            self.stdout.write(f'  Modules without enrollments: {modules_no_enrollments.count()}')

        # 9. Check for missing enrollment dates
        programs_no_date = StudentProgram.objects.filter(enrollment_date__isnull=True)
        modules_no_date = StudentModule.objects.filter(enrollment_date__isnull=True)
        if programs_no_date.exists() or modules_no_date.exists():
            issues.append(f'Enrollments missing dates: Programs={programs_no_date.count()}, Modules={modules_no_date.count()}')

        # 10. Check for results without recorded_date
        results_no_date = StudentResult.objects.filter(recorded_date__isnull=True)
        if results_no_date.exists():
            issues.append(f'Results missing recorded_date: {results_no_date.count()}')

        # Summary statistics
        self.stdout.write('\n' + self.style.SUCCESS('Summary Statistics:'))
        self.stdout.write(f'  Total Students: {Student.objects.count()}')
        self.stdout.write(f'  Total Programmes: {Programme.objects.count()}')
        self.stdout.write(f'  Total Modules: {Module.objects.count()}')
        self.stdout.write(f'  Total Program Enrollments: {StudentProgram.objects.count()}')
        self.stdout.write(f'  Total Module Enrollments: {StudentModule.objects.count()}')
        self.stdout.write(f'  Total Results: {StudentResult.objects.count()}')

        # Report issues
        if issues:
            self.stdout.write('\n' + self.style.ERROR('ISSUES FOUND:'))
            for issue in issues:
                self.stdout.write(self.style.ERROR(f'  - {issue}'))
        else:
            self.stdout.write('\n' + self.style.SUCCESS('No critical issues found!'))

        # Report warnings
        if warnings:
            self.stdout.write('\n' + self.style.WARNING('WARNINGS:'))
            for warning in warnings:
                self.stdout.write(self.style.WARNING(f'  - {warning}'))
        else:
            self.stdout.write('\n' + self.style.SUCCESS('No warnings!'))

        # Overall status
        self.stdout.write('\n' + '=' * 60)
        if issues:
            self.stdout.write(self.style.ERROR('VALIDATION STATUS: FAILED'))
            self.stdout.write(self.style.ERROR('Please review and fix the issues above.'))
        elif warnings:
            self.stdout.write(self.style.WARNING('VALIDATION STATUS: PASSED WITH WARNINGS'))
        else:
            self.stdout.write(self.style.SUCCESS('VALIDATION STATUS: PASSED'))
        self.stdout.write('=' * 60)
