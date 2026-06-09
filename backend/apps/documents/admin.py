from django.contrib import admin
from .models import DOLetter


@admin.register(DOLetter)
class DOLetterAdmin(admin.ModelAdmin):
    list_display = ['title', 'reference_number', 'date', 'uploaded_by', 'visible_to_all', 'uploaded_at']
    list_filter = ['visible_to_all', 'date']
    search_fields = ['title', 'reference_number']
    filter_horizontal = ['units']
