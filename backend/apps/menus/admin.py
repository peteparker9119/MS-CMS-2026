from django.contrib import admin
from .models import CustomMenu, MenuField

class MenuFieldInline(admin.TabularInline):
    model = MenuField
    extra = 0

@admin.register(CustomMenu)
class CustomMenuAdmin(admin.ModelAdmin):
    list_display  = ['name', 'slug', 'icon', 'access', 'is_active', 'order']
    inlines       = [MenuFieldInline]

@admin.register(MenuField)
class MenuFieldAdmin(admin.ModelAdmin):
    list_display = ['menu', 'label', 'field_type', 'required', 'order']
