"""
Administrator dashboard aggregates: derived from enrollments and student records.
"""
from __future__ import annotations

from typing import Optional

from django.db.models import Count, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse

from accounts.permissions import IsAdministrator
from students.models import Student
from grades.models import StudentResult
from courses.models import Programme

from .models import StudentProgram, StudentModule


def _term_sort_key(term: str) -> tuple:
    """Order term codes for 'latest' selection (length then lexical)."""
    return (len(term or ''), term or '')


def _latest_active_term_code() -> Optional[str]:
    """Most recent term code among active pathway or module enrollments."""
    terms = set()
    terms.update(
        StudentProgram.objects.filter(enroll_status='ACTIVE').values_list('term_code', flat=True).distinct()
    )
    terms.update(
        StudentModule.objects.filter(enroll_status='ACTIVE').values_list('term_code', flat=True).distinct()
    )
    terms.discard('')
    if not terms:
        return None
    return max(terms, key=_term_sort_key)


def _active_student_ids_for_term(term: str) -> set[str]:
    ids = set(
        StudentProgram.objects.filter(enroll_status='ACTIVE', term_code=term).values_list(
            'student_id', flat=True
        )
    )
    ids.update(
        StudentModule.objects.filter(enroll_status='ACTIVE', term_code=term).values_list(
            'student_id', flat=True
        )
    )
    return ids


def _returning_students_count(current_term: str) -> int:
    """
    Students with at least one active enrollment in the current term who also have
    any pathway or module enrollment recorded in a different term.
    """
    active_now = _active_student_ids_for_term(current_term)
    if not active_now:
        return 0
    prior_prog = set(
        StudentProgram.objects.exclude(term_code=current_term).values_list('student_id', flat=True).distinct()
    )
    prior_mod = set(
        StudentModule.objects.exclude(term_code=current_term).values_list('student_id', flat=True).distinct()
    )
    with_prior = prior_prog | prior_mod
    return len(active_now & with_prior)


@extend_schema(
    summary='Distinct enrolment term codes',
    responses={200: OpenApiResponse(description='Sorted term codes (newest first by length then value)')},
    tags=['enrollments'],
)
@api_view(['GET'])
@permission_classes([IsAdministrator])
def enrollment_terms(request):
    """List distinct term codes from pathway and module enrolments (administrators only)."""
    terms = set()
    terms.update(StudentProgram.objects.values_list('term_code', flat=True).distinct())
    terms.update(StudentModule.objects.values_list('term_code', flat=True).distinct())
    terms.discard('')
    sorted_terms = sorted(terms, key=_term_sort_key, reverse=True)
    return Response({'terms': sorted_terms})


@extend_schema(
    summary='Administrator dashboard summary',
    description=(
        'Aggregated metrics for the admin dashboard. '
        'Optional query parameter term_code selects the term; otherwise the latest term among active enrolments is used.'
    ),
    responses={
        200: OpenApiResponse(description='Dashboard metrics'),
        403: OpenApiResponse(description='Administrator access required'),
    },
    tags=['enrollments'],
)
@api_view(['GET'])
@permission_classes([IsAdministrator])
def dashboard_summary(request):
    """Return KPIs and series data for the administrator dashboard."""
    requested = (request.query_params.get('term_code') or '').strip()
    if requested:
        current_term = requested
    else:
        current_term = _latest_active_term_code()
    active_students = len(_active_student_ids_for_term(current_term)) if current_term else 0
    returning_students = _returning_students_count(current_term) if current_term else 0

    enrollments_by_programme = []
    most_popular = None
    if current_term:
        rows = (
            StudentProgram.objects.filter(enroll_status='ACTIVE', term_code=current_term)
            .values('programme__programme_code', 'programme__programme_name')
            .annotate(enrollment_count=Count('enrollment_id'))
            .order_by('-enrollment_count', 'programme__programme_name')
        )
        enrollments_by_programme = [
            {
                'programme_code': r['programme__programme_code'],
                'programme_name': r['programme__programme_name'],
                'count': r['enrollment_count'],
            }
            for r in rows
        ]
        if enrollments_by_programme:
            top = enrollments_by_programme[0]
            most_popular = {
                'programme_code': top['programme_code'],
                'programme_name': top['programme_name'],
                'active_enrollments': top['count'],
            }

    top_employers = list(
        Student.objects.exclude(employer='')
        .values('employer')
        .annotate(student_count=Count('student_id', distinct=True))
        .order_by('-student_count', 'employer')[:5]
    )
    top_employers = [
        {'employer': r['employer'], 'student_count': r['student_count']} for r in top_employers
    ]

    return Response(
        {
            'current_term_code': current_term,
            'active_students_current_term': active_students,
            'returning_students_current_term': returning_students,
            'enrollments_by_programme': enrollments_by_programme,
            'most_popular_programme': most_popular,
            'top_employers': top_employers,
        },
        status=status.HTTP_200_OK,
    )


@extend_schema(
    summary='Reports data',
    description='Aggregated reports data for admin: enrollment trends, grade distribution, completion rates.',
    responses={200: OpenApiResponse(description='Reports metrics')},
    tags=['enrollments'],
)
@api_view(['GET'])
@permission_classes([IsAdministrator])
def reports_data(request):
    """Return aggregated data for the reports page."""
    term_from    = (request.query_params.get('term_from') or '').strip()
    term_to      = (request.query_params.get('term_to') or '').strip()
    programme_id = (request.query_params.get('programme_id') or '').strip()

    mod_qs  = StudentModule.objects.all()
    prog_qs = StudentProgram.objects.all()
    res_qs  = StudentResult.objects.all()

    if term_from:
        mod_qs  = mod_qs.filter(term_code__gte=term_from)
        prog_qs = prog_qs.filter(term_code__gte=term_from)
        res_qs  = res_qs.filter(term_code__gte=term_from)
    if term_to:
        mod_qs  = mod_qs.filter(term_code__lte=term_to)
        prog_qs = prog_qs.filter(term_code__lte=term_to)
        res_qs  = res_qs.filter(term_code__lte=term_to)
    if programme_id:
        prog_qs = prog_qs.filter(programme__programme_code=programme_id)

    # Enrollment trend by term (module enrollments)
    enrollment_by_term = list(
        mod_qs
        .values('term_code')
        .annotate(count=Count('enrollment_id'))
        .order_by('term_code')
    )

    # Programme enrollment trend by term
    program_enrollment_by_term = list(
        prog_qs
        .values('term_code')
        .annotate(count=Count('enrollment_id'))
        .order_by('term_code')
    )

    # Grade distribution overall
    grade_distribution = list(
        res_qs
        .values('processed_grade')
        .annotate(count=Count('result_id'))
        .order_by('processed_grade')
    )

    # Grade distribution by module
    grade_by_module = list(
        res_qs
        .values('module__module_code', 'module__module_name', 'processed_grade')
        .annotate(count=Count('result_id'))
        .order_by('module__module_code', 'processed_grade')
    )

    # Programme completion rates
    programme_completion = list(
        prog_qs
        .values('programme__programme_code', 'programme__programme_name', 'enroll_status')
        .annotate(count=Count('enrollment_id'))
        .order_by('programme__programme_code', 'enroll_status')
    )

    # Total counts — total_students is never filtered
    total_students = Student.objects.count()
    total_enrollments = prog_qs.count()
    total_module_enrollments = mod_qs.count()
    total_grades = res_qs.count()
    pass_count = res_qs.filter(
        processed_grade__in=['PASS', 'COMPENSATORY_PASS']
    ).count()

    return Response({
        'totals': {
            'students': total_students,
            'programme_enrollments': total_enrollments,
            'module_enrollments': total_module_enrollments,
            'grades_recorded': total_grades,
            'pass_count': pass_count,
        },
        'module_enrollment_by_term': enrollment_by_term,
        'programme_enrollment_by_term': program_enrollment_by_term,
        'grade_distribution': grade_distribution,
        'grade_by_module': grade_by_module,
        'programme_completion': programme_completion,
    }, status=status.HTTP_200_OK)
