"""
Unit tests for migration utility functions.
"""
import pytest
import pandas as pd
from datetime import date
from students.management.commands.migration_utils import (
    normalize_term_code,
    term_code_to_date,
    normalize_student_id,
    normalize_module_code,
    derive_semester_from_catalog_row,
    map_enrollment_status,
    process_grade,
)


class TestTermCodeNormalization:
    """Test term code normalization functions."""

    def test_normalize_term_code_with_trailing_zero(self):
        """Test removing trailing .0 from term codes."""
        assert normalize_term_code('202400.0') == '202400'
        assert normalize_term_code('20241.0') == '20241'

    def test_normalize_term_code_empty(self):
        """Test handling empty values."""
        assert normalize_term_code('') == ''
        assert normalize_term_code(None) == ''
        assert normalize_term_code(pd.NA) == ''

    def test_normalize_term_code_already_normalized(self):
        """Test already normalized codes unchanged."""
        assert normalize_term_code('20241') == '20241'
        assert normalize_term_code('202400') == '202400'

    def test_normalize_term_code_whitespace(self):
        """Test whitespace handling."""
        assert normalize_term_code(' 20241 ') == '20241'


class TestDeriveSemesterFromCatalogRow:
    """Test semester derivation from catalog row."""

    def test_blk_one_returns_semester_1(self):
        assert derive_semester_from_catalog_row({'BLK': 1}) == 1

    def test_blk_zero_returns_semester_2(self):
        assert derive_semester_from_catalog_row({'BLK': 0}) == 2

    def test_block_desc_part_1_returns_1(self):
        assert derive_semester_from_catalog_row({'BLOCK_DESC': 'Part 1', 'BLOCK': ''}) == 1

    def test_block_desc_semester_2_returns_2(self):
        assert derive_semester_from_catalog_row({'BLOCK_DESC': 'Semester 2', 'BLOCK': ''}) == 2

    def test_block_y1_returns_1(self):
        assert derive_semester_from_catalog_row({'BLOCK': 'AACER_8_Y1', 'BLOCK_DESC': ''}) == 1

    def test_block_y2_returns_2(self):
        assert derive_semester_from_catalog_row({'BLOCK': 'AACER_8_Y2', 'BLOCK_DESC': ''}) == 2

    def test_empty_returns_none(self):
        assert derive_semester_from_catalog_row({}) is None
        assert derive_semester_from_catalog_row({'BLOCK': 'XYZ', 'BLOCK_DESC': 'Other'}) is None


class TestTermCodeToDate:
    """Test term code to date conversion."""

    def test_semester_1_start(self):
        """Test Semester 1 start date."""
        result = term_code_to_date('20241', 'start')
        assert result == date(2024, 1, 15)

    def test_semester_2_start(self):
        """Test Semester 2 start date."""
        result = term_code_to_date('20242', 'start')
        assert result == date(2024, 9, 1)

    def test_semester_1_end(self):
        """Test Semester 1 end date."""
        result = term_code_to_date('20241', 'end')
        assert result == date(2024, 6, 30)

    def test_semester_2_end(self):
        """Test Semester 2 end date."""
        result = term_code_to_date('20242', 'end')
        assert result == date(2024, 12, 31)

    def test_full_year_start(self):
        """Test full year term code start."""
        result = term_code_to_date('202400', 'start')
        assert result == date(2024, 1, 15)

    def test_full_year_end(self):
        """Test full year term code end."""
        result = term_code_to_date('202400', 'end')
        assert result == date(2024, 12, 31)

    def test_invalid_term_code(self):
        """Test invalid term codes return None."""
        assert term_code_to_date('invalid') is None
        assert term_code_to_date('') is None
        assert term_code_to_date('123') is None


class TestGradeProcessing:
    """Test grade processing functions."""

    def test_numeric_pass(self):
        """Test numeric grade >= 40 returns PASS."""
        raw, processed, numeric = process_grade(85)
        assert raw == '85'
        assert processed == 'PASS'
        assert numeric == 85.0

    def test_numeric_fail(self):
        """Test numeric grade < 35 returns FAIL."""
        raw, processed, numeric = process_grade(30)
        assert processed == 'FAIL'
        assert numeric == 30.0

    def test_compensatory_pass(self):
        """Test grade 35-39 returns COMPENSATORY_PASS."""
        raw, processed, numeric = process_grade(37)
        assert processed == 'COMPENSATORY_PASS'
        assert numeric == 37.0

    def test_39p_pattern(self):
        """Test '39P' pattern handling."""
        raw, processed, numeric = process_grade('39P')
        assert raw == '39P'
        assert processed == 'COMPENSATORY_PASS'
        assert numeric == 39.0

    def test_grade_with_caret(self):
        """Test trailing '^' removal."""
        raw, processed, numeric = process_grade('85^')
        assert raw == '85'
        assert processed == 'PASS'
        assert numeric == 85.0

    def test_grade_nan(self):
        """Test NaN values."""
        raw, processed, numeric = process_grade(pd.NA)
        assert raw == ''
        assert processed == 'FAIL'
        assert numeric is None

    def test_grade_pass_string(self):
        """Test string 'PASS'."""
        raw, processed, numeric = process_grade('PASS')
        assert processed == 'PASS'
        assert numeric is None

    def test_grade_fail_string(self):
        """Test string 'FAIL'."""
        raw, processed, numeric = process_grade('FAIL')
        assert processed == 'FAIL'
        assert numeric is None


class TestStatusMapping:
    """Test enrollment status mapping."""

    def test_registered_to_active(self):
        """Test Registered maps to ACTIVE."""
        assert map_enrollment_status('Registered') == 'ACTIVE'
        assert map_enrollment_status('REGISTERED') == 'ACTIVE'

    def test_courses_assigned_to_active(self):
        """Test Courses Assigned maps to ACTIVE."""
        assert map_enrollment_status('Courses Assigned') == 'ACTIVE'

    def test_completed(self):
        """Test Completed maps correctly."""
        assert map_enrollment_status('Completed') == 'COMPLETED'

    def test_withdrawn(self):
        """Test Withdrawn maps correctly."""
        assert map_enrollment_status('Withdrawn') == 'WITHDRAWN'
        assert map_enrollment_status('Withdraw') == 'WITHDRAWN'

    def test_unknown_status_defaults(self):
        """Test unknown status defaults to ACTIVE."""
        assert map_enrollment_status('Unknown Status') == 'ACTIVE'
        assert map_enrollment_status('') == 'ACTIVE'
        assert map_enrollment_status(None) == 'ACTIVE'


class TestCodeNormalization:
    """Test code normalization functions."""

    def test_normalize_student_id(self):
        """Test student ID normalization."""
        assert normalize_student_id('R00241655') == 'R00241655'
        assert normalize_student_id('r00241655') == 'R00241655'
        assert normalize_student_id('  R00241655  ') == 'R00241655'

    def test_normalize_module_code(self):
        """Test module code normalization."""
        assert normalize_module_code('CYBR8001') == 'CYBR8001'
        assert normalize_module_code('cybr8001') == 'CYBR8001'
        assert normalize_module_code('  cybr8001  ') == 'CYBR8001'

    def test_normalize_empty_codes(self):
        """Test empty code handling."""
        assert normalize_student_id('') == ''
        assert normalize_student_id(None) == ''
        assert normalize_module_code('') == ''
        assert normalize_module_code(None) == ''
