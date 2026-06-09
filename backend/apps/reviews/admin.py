from django.contrib import admin
from .models import ReviewTemplate, ReviewCriterion, ReviewEntry, ReviewScore


class ReviewCriterionInline(admin.TabularInline):
    model = ReviewCriterion
    extra = 1


@admin.register(ReviewTemplate)
class ReviewTemplateAdmin(admin.ModelAdmin):
    list_display = ['title', 'unit', 'frequency', 'active', 'created_at']
    list_filter = ['frequency', 'active', 'unit']
    inlines = [ReviewCriterionInline]


class ReviewScoreInline(admin.TabularInline):
    model = ReviewScore
    extra = 0


@admin.register(ReviewEntry)
class ReviewEntryAdmin(admin.ModelAdmin):
    list_display = ['template', 'reviewer', 'reviewee', 'unit', 'date']
    list_filter = ['template', 'unit']
    inlines = [ReviewScoreInline]
