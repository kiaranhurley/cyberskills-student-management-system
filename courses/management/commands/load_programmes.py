"""Load programmes/modules/associations from curated CSVs (no scraping)."""
from decimal import Decimal, InvalidOperation
import os

import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from courses.models import Module, Programme, ProgrammeModuleAssociation


def clean_text(value) -> str:
    if value is None:
        return ''
    text = str(value).strip()
    if text.lower() in {'nan', 'none'}:
        return ''
    return text.replace('_x000D_', '').strip()


def parse_credits(value):
    text = clean_text(value)
    if not text:
        return None
    text = text.lower().replace('credits', '').strip()
    try:
        return int(float(text))
    except (TypeError, ValueError):
        return None


def parse_fee(value):
    text = clean_text(value)
    if not text:
        return None
    normalized = text.replace('€', '').replace(',', '')
    normalized = normalized.replace('EU', '').strip()
    try:
        return Decimal(normalized)
    except (InvalidOperation, ValueError):
        return None


def derive_semester_from_block(block: str):
    text = clean_text(block).upper()
    if '_Y1' in text or 'SEM1' in text or 'S1' in text:
        return 1
    if '_Y2' in text or 'SEM2' in text or 'S2' in text:
        return 2
    return None


def read_csv_robust(path: str) -> pd.DataFrame:
    """Read CSV with practical encoding fallback for exported files."""
    for encoding in ('utf-8-sig', 'cp1252'):
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    # Let pandas raise a useful exception on final attempt
    return pd.read_csv(path)


class Command(BaseCommand):
    help = 'Load programmes/modules/associations from CSV exports and prune irrelevant records'

    def add_arguments(self, parser):
        parser.add_argument('--programs-file', type=str, default='data/programs.csv')
        parser.add_argument('--modules-file', type=str, default='data/modules.csv')
        parser.add_argument('--associations-file', type=str, default='data/program_module_associations.csv')
        parser.add_argument(
            '--prune-irrelevant',
            action='store_true',
            default=True,
            help='Remove records not present in association-backed curated data (default: enabled)',
        )
        parser.add_argument(
            '--no-prune-irrelevant',
            action='store_false',
            dest='prune_irrelevant',
            help='Do not remove irrelevant programmes/modules/associations',
        )
        parser.add_argument('--dry-run', action='store_true', help='Preview changes without saving')
        parser.add_argument(
            '--strict-prune',
            action='store_true',
            help='Delete non-curated programmes/modules even when referenced by student data',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        prune_irrelevant = options['prune_irrelevant']
        strict_prune = options['strict_prune']
        programs_file = options['programs_file']
        modules_file = options['modules_file']
        associations_file = options['associations_file']

        for fp in [programs_file, modules_file, associations_file]:
            if not os.path.exists(fp):
                raise CommandError(f'File not found: {fp}')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))

        programmes_created = modules_created = associations_created = 0
        programmes_updated = modules_updated = associations_updated = 0
        associations_deleted = programmes_deleted = modules_deleted = 0

        try:
            df_programs = read_csv_robust(programs_file)
            df_modules = read_csv_robust(modules_file)
            df_assoc = read_csv_robust(associations_file)

            required_program_cols = {'program_code', 'program_name'}
            required_module_cols = {'module_code', 'module_name'}
            required_assoc_cols = {'program_code', 'module_code'}

            if not required_program_cols.issubset(df_programs.columns):
                raise CommandError(f'programs.csv missing required columns: {required_program_cols}')
            if not required_module_cols.issubset(df_modules.columns):
                raise CommandError(f'modules.csv missing required columns: {required_module_cols}')
            if not required_assoc_cols.issubset(df_assoc.columns):
                raise CommandError(f'program_module_associations.csv missing required columns: {required_assoc_cols}')

            curated_program_codes = {clean_text(v) for v in df_assoc['program_code'].tolist() if clean_text(v)}
            curated_module_codes = {clean_text(v) for v in df_assoc['module_code'].tolist() if clean_text(v)}
            curated_pairs = {
                (clean_text(r.get('program_code')), clean_text(r.get('module_code')))
                for _, r in df_assoc.iterrows()
                if clean_text(r.get('program_code')) and clean_text(r.get('module_code'))
            }

            with transaction.atomic():
                for _, row in df_programs.iterrows():
                    code = clean_text(row.get('program_code'))
                    if not code or code not in curated_program_codes:
                        continue
                    defaults = {
                        'programme_name': clean_text(row.get('program_name')) or code,
                        'credits': parse_credits(row.get('credits')),
                        'fee': parse_fee(row.get('fee')),
                        'lecturer_name': clean_text(row.get('lecturer')),
                        'lecturer_email': clean_text(row.get('lecturer_contact')),
                    }
                    obj, created = Programme.objects.update_or_create(programme_code=code, defaults=defaults)
                    if created:
                        programmes_created += 1
                    else:
                        programmes_updated += 1

                for _, row in df_modules.iterrows():
                    code = clean_text(row.get('module_code'))
                    if not code or code not in curated_module_codes:
                        continue
                    defaults = {
                        'module_name': clean_text(row.get('module_name')) or code,
                        'credits': parse_credits(row.get('credits')),
                        'fee': parse_fee(row.get('fee')),
                        'lecturer_name': clean_text(row.get('lecturer')),
                        'lecturer_email': clean_text(row.get('lecturer_contact')),
                    }
                    obj, created = Module.objects.update_or_create(module_code=code, defaults=defaults)
                    if created:
                        modules_created += 1
                    else:
                        modules_updated += 1

                for _, row in df_assoc.iterrows():
                    p_code = clean_text(row.get('program_code'))
                    m_code = clean_text(row.get('module_code'))
                    if not p_code or not m_code:
                        continue

                    try:
                        programme_obj = Programme.objects.get(programme_code=p_code)
                        module_obj = Module.objects.get(module_code=m_code)
                    except (Programme.DoesNotExist, Module.DoesNotExist):
                        self.stdout.write(
                            self.style.WARNING(
                                f'Skipping association {p_code} -> {m_code}: missing programme/module record'
                            )
                        )
                        continue

                    block = clean_text(row.get('block'))
                    semester = derive_semester_from_block(block)
                    assoc, created = ProgrammeModuleAssociation.objects.update_or_create(
                        programme=programme_obj,
                        module=module_obj,
                        defaults={'semester': semester, 'block': block},
                    )
                    if created:
                        associations_created += 1
                    else:
                        associations_updated += 1

                if prune_irrelevant:
                    assoc_qs = ProgrammeModuleAssociation.objects.select_related('programme', 'module')
                    for assoc in assoc_qs:
                        pair = (assoc.programme.programme_code, assoc.module.module_code)
                        if pair not in curated_pairs:
                            assoc.delete()
                            associations_deleted += 1

                    for prog in Programme.objects.exclude(programme_code__in=curated_program_codes):
                        has_student_refs = prog.enrollments.exists()
                        if has_student_refs and not strict_prune:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'Keeping non-curated programme {prog.programme_code} (referenced by student enrollments)'
                                )
                            )
                            continue
                        prog.delete()
                        programmes_deleted += 1

                    for mod in Module.objects.exclude(module_code__in=curated_module_codes):
                        has_student_refs = mod.enrollments.exists() or mod.results.exists()
                        if has_student_refs and not strict_prune:
                            self.stdout.write(
                                self.style.WARNING(
                                    f'Keeping non-curated module {mod.module_code} (referenced by student data)'
                                )
                            )
                            continue
                        mod.delete()
                        modules_deleted += 1

                if dry_run:
                    self.stdout.write(self.style.WARNING('DRY RUN - Rolling back changes'))
                    transaction.set_rollback(True)

            self.stdout.write(
                self.style.SUCCESS(
                    '\nLoad complete:\n'
                    f'  Programmes created/updated: {programmes_created}/{programmes_updated}\n'
                    f'  Modules created/updated: {modules_created}/{modules_updated}\n'
                    f'  Associations created/updated: {associations_created}/{associations_updated}\n'
                    f'  Associations deleted: {associations_deleted}\n'
                    f'  Programmes deleted: {programmes_deleted}\n'
                    f'  Modules deleted: {modules_deleted}\n'
                    f'  Prune irrelevant: {prune_irrelevant}\n'
                    f'  Strict prune: {strict_prune}'
                )
            )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error loading curated programme/module data: {e}'))
            raise CommandError(f'Load failed: {e}')
