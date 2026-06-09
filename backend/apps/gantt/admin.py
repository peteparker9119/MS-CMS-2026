from django.contrib import admin
from .models import GanttTask


@admin.register(GanttTask)
class GanttTaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'unit', 'assigned_to', 'start_date', 'end_date', 'progress', 'academic_year', 'milestone']
    list_filter = ['academic_year', 'milestone', 'unit']
    search_fields = ['title']
