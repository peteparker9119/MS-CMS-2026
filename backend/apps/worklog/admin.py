from django.contrib import admin
from .models import WorkTask, WorkEntry, WorkComment


@admin.register(WorkTask)
class WorkTaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'assigned_to', 'unit', 'status', 'priority', 'deadline', 'created_at']
    list_filter = ['status', 'priority', 'unit']
    search_fields = ['title', 'description']


@admin.register(WorkEntry)
class WorkEntryAdmin(admin.ModelAdmin):
    list_display = ['task', 'user', 'work_hours', 'date', 'logged_at']
    list_filter = ['date']


@admin.register(WorkComment)
class WorkCommentAdmin(admin.ModelAdmin):
    list_display = ['task', 'user', 'created_at']
