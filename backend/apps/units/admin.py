from django.contrib import admin
from .models import ConvergenceUnit, UnitPair


@admin.register(ConvergenceUnit)
class ConvergenceUnitAdmin(admin.ModelAdmin):
    list_display = ['abbr', 'name', 'color', 'member_name', 'order']
    ordering = ['order']


@admin.register(UnitPair)
class UnitPairAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'unit_a', 'unit_b']
