from django.contrib import admin
from .models import KPIDefinition, KPIEntry


@admin.register(KPIDefinition)
class KPIDefinitionAdmin(admin.ModelAdmin):
    list_display = ['title', 'assigned_to', 'unit', 'frequency', 'target_value', 'metric_unit', 'active']
    list_filter = ['frequency', 'active', 'unit']
    search_fields = ['title']


@admin.register(KPIEntry)
class KPIEntryAdmin(admin.ModelAdmin):
    list_display = ['kpi', 'value', 'date', 'entered_by', 'created_at']
    list_filter = ['date']
