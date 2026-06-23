from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .dashboard_views import dashboard_summary, enrollment_terms, reports_data
from .views import StudentProgramViewSet, StudentModuleViewSet

router = DefaultRouter()
router.register(r'student-programs', StudentProgramViewSet)
router.register(r'student-modules', StudentModuleViewSet)

app_name = 'enrollments'

urlpatterns = [
    path('dashboard-summary/', dashboard_summary, name='dashboard-summary'),
    path('enrollment-terms/', enrollment_terms, name='enrollment-terms'),
    path('reports/', reports_data, name='reports'),
    path('', include(router.urls)),
]
