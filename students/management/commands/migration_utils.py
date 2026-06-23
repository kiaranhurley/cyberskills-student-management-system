"""
Utility functions for data migration.
Shared utilities for normalizing data, processing grades, and converting term codes.
"""
import pandas as pd
from datetime import date
from typing import Tuple, Optional


def normalize_term_code(term_code_raw) -> str:
    """
    Normalize term code by removing trailing .0 if present.
    
    Examples:
        '202400.0' -> '202400'
        '20241' -> '20241'
        '' -> ''
    """
    if pd.isna(term_code_raw) or term_code_raw == '':
        return ''
    
    term_code = str(term_code_raw).strip()
    # Remove trailing .0 if present (but not trailing zeros that are part of the code)
    if term_code.endswith('.0'):
        term_code = term_code[:-2]
    
    return term_code


def term_code_to_date(term_code: str, date_type: str = 'start') -> Optional[date]:
    """
    Convert term code (YYYYSS format) to date.
    
    Format: 
        - 20241 = Semester 1 (Jan start)
        - 20242 = Semester 2 (Sep start)
        - 202400 = Full year (Jan start)
    
    Args:
        term_code: Term code string (e.g., '20241', '20242', '202400')
        date_type: 'start' for enrollment_date, 'end' for completion_date
    
    Returns:
        date object or None if term_code is invalid
    """
    if not term_code or term_code == '':
        return None
    
    try:
        # Handle 6-digit codes (e.g., 202400)
        if len(term_code) == 6:
            year = int(term_code[:4])
            # Full year term code
            if date_type == 'start':
                return date(year, 1, 15)  # Mid-January start
            else:
                return date(year, 12, 31)  # End of year
        
        # Handle 5-digit codes (e.g., 20241, 20242)
        if len(term_code) >= 5:
            year = int(term_code[:4])
            semester = int(term_code[4:5]) if len(term_code) > 4 else 1
            
            if semester == 1:  # Semester 1
                if date_type == 'start':
                    return date(year, 1, 15)  # Mid-January start
                else:
                    return date(year, 6, 30)  # End of semester
            elif semester == 2:  # Semester 2
                if date_type == 'start':
                    return date(year, 9, 1)   # September start
                else:
                    return date(year, 12, 31)  # End of year
        
        return None
    except (ValueError, IndexError):
        return None


def normalize_student_id(student_id) -> str:
    """
    Standardize student ID format.
    
    Args:
        student_id: Student ID (can be string, number, etc.)
    
    Returns:
        Normalized student ID string
    """
    if pd.isna(student_id):
        return ''
    
    return str(student_id).strip().upper()


def normalize_module_code(module_code) -> str:
    """
    Standardize module/programme code format.
    
    Args:
        module_code: Module or programme code
    
    Returns:
        Normalized code string
    """
    if pd.isna(module_code):
        return ''
    
    return str(module_code).strip().upper()


def derive_semester_from_catalog_row(row) -> Optional[int]:
    """
    Derive semester (1 or 2) from MyBan Catalog Excel row.

    Uses in order:
    - BLK: 1 -> Semester 1, 0 -> Semester 2 (catalog uses 0/1)
    - BLOCK_DESC / BLOCK text: 'Part 1', 'S1', 'Semester 1', 'Y1' -> 1;
      'Part 2', 'S2', 'Semester 2', 'Y2' -> 2

    Returns:
        1, 2, or None if not determinable
    """
    try:
        blk = row.get('BLK')
        if blk is not None and not pd.isna(blk):
            b = int(float(blk))
            if b == 1:
                return 1
            if b == 0:
                return 2
    except (ValueError, TypeError):
        pass

    block_desc = str(row.get('BLOCK_DESC', '')).upper()
    block = str(row.get('BLOCK', '')).upper()
    combined = block_desc + ' ' + block

    if any(x in combined for x in ('PART 1', 'SEMESTER 1', '_Y1', 'S1 ', ' S1', 'Y1 ')):
        return 1
    if any(x in combined for x in ('PART 2', 'SEMESTER 2', '_Y2', 'S2 ', ' S2', 'Y2 ')):
        return 2

    return None


def map_enrollment_status(excel_status) -> str:
    """
    Map Excel enrollment status values to Django STATUS_CHOICES.

    Maps:
        - 'Registered', 'Courses Assigned' -> 'ACTIVE'
        - 'Completed' -> 'COMPLETED'
        - 'Withdrawn' -> 'WITHDRAWN'

    Args:
        excel_status: Status value from Excel file

    Returns:
        Django status choice ('ACTIVE', 'COMPLETED', 'WITHDRAWN')
        Defaults to 'ACTIVE' if no mapping found
    """
    if pd.isna(excel_status):
        return 'ACTIVE'
    
    status_str = str(excel_status).strip().upper()
    
    STATUS_MAPPING = {
        'REGISTERED': 'ACTIVE',
        'COURSES ASSIGNED': 'ACTIVE',
        'ACTIVE': 'ACTIVE',
        'COMPLETED': 'COMPLETED',
        'WITHDRAWN': 'WITHDRAWN',
        'WITHDRAW': 'WITHDRAWN',
    }
    
    return STATUS_MAPPING.get(status_str, 'ACTIVE')


def process_grade(grade_val) -> Tuple[str, str, Optional[float]]:
    """
    Process grade value and return raw, processed, and numeric grades.
    
    Handles:
        - NaN values
        - Trailing '^' characters
        - '39P' pattern -> PASS
        - Numeric grades: >= 40 -> PASS, < 40 -> FAIL
        - Extracts numeric value for numeric_grade field
    
    Args:
        grade_val: Grade value from Excel (can be string, number, NaN)
    
    Returns:
        Tuple of (raw_grade, processed_grade, numeric_grade)
        - raw_grade: Original grade as string
        - processed_grade: 'PASS', 'FAIL', or 'COMPENSATORY_PASS'
        - numeric_grade: Numeric value if available, None otherwise
    """
    # Handle NaN
    if pd.isna(grade_val):
        return ('', 'FAIL', None)
    
    grade_str = str(grade_val).strip()
    raw_grade = grade_str
    
    # Remove trailing '^' if present
    if grade_str.endswith('^'):
        grade_str = grade_str[:-1]
        raw_grade = grade_str
    
    # Handle "39P" pattern -> PASS
    if grade_str.upper().endswith('P') and len(grade_str) > 1:
        num_part = grade_str[:-1]
        try:
            numeric_value = float(num_part)
            # Check if it's compensatory pass (between 35-39)
            if 35 <= numeric_value < 40:
                return (raw_grade, 'COMPENSATORY_PASS', numeric_value)
            else:
                return (raw_grade, 'PASS', numeric_value)
        except ValueError:
            pass
    
    # Try to parse as numeric grade
    try:
        numeric_grade = float(grade_str)
        
        # Determine processed grade based on numeric value
        if numeric_grade >= 40:
            processed_grade = 'PASS'
        elif numeric_grade >= 35:
            processed_grade = 'COMPENSATORY_PASS'
        else:
            processed_grade = 'FAIL'
        
        return (raw_grade, processed_grade, numeric_grade)
    except ValueError:
        # Non-numeric grade (e.g., 'PASS', 'FAIL', 'EXEMPT')
        grade_upper = grade_str.upper()
        if grade_upper in ['PASS', 'P']:
            return (raw_grade, 'PASS', None)
        elif grade_upper in ['FAIL', 'F']:
            return (raw_grade, 'FAIL', None)
        else:
            # Unknown grade format, default to FAIL
            return (raw_grade, 'FAIL', None)
