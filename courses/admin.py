from django.contrib import admin
from .models import Programme, Module, ProgrammeModuleAssociation


@admin.register(Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    list_display = ['programme_code', 'programme_name', 'credits', 'fee', 'created_at']
    list_filter = ['created_at']
    search_fields = ['programme_code', 'programme_name']


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['module_code', 'module_name', 'credits', 'fee', 'created_at']
    list_filter = ['created_at']
    search_fields = ['module_code', 'module_name']


@admin.register(ProgrammeModuleAssociation)
class ProgrammeModuleAssociationAdmin(admin.ModelAdmin):
    list_display = ['programme', 'module', 'semester', 'block']
    list_filter = ['semester']
    search_fields = ['programme__programme_code', 'module__module_code']
