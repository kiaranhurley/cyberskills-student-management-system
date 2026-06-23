from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('users', views.UserViewSet, basename='users')
router.register('audit-logs', views.AuditLogViewSet, basename='audit-logs')

app_name = 'accounts'

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('profile/', views.profile, name='profile'),
    path('roles/', views.roles_list, name='roles'),
    path('my-assignments/', views.my_assignments, name='my-assignments'),
    path('', include(router.urls)),
]
