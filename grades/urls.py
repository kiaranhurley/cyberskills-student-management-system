from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentResultViewSet

router = DefaultRouter()
router.register(r'student-results', StudentResultViewSet)

app_name = 'grades'

urlpatterns = [
    path('', include(router.urls)),
]
