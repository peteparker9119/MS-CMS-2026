from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CMSUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'role', 'unit', 'is_active']
    list_filter = ['role', 'is_active']
    fieldsets = UserAdmin.fieldsets + (
        ('CMS', {'fields': ('role', 'unit')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('CMS', {'fields': ('role', 'unit')}),
    )
