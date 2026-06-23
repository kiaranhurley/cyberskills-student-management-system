from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProgrammeViewSet, ModuleViewSet, ProgrammeModuleAssociationViewSet

router = DefaultRouter()
router.register(r'programmes', ProgrammeViewSet)
router.register(r'modules', ModuleViewSet)
router.register(r'programme-module-associations', ProgrammeModuleAssociationViewSet)

app_name = 'courses'

urlpatterns = [
    path('', include(router.urls)),
]
