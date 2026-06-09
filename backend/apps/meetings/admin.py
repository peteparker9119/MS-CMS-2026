from django.contrib import admin
from .models import Meeting, MeetingMinutes, ActionPoint, ActionPointComment, MeetingNotHeld


class MeetingMinutesInline(admin.StackedInline):
    model = MeetingMinutes
    extra = 0


class MeetingNotHeldInline(admin.StackedInline):
    model = MeetingNotHeld
    extra = 0


@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    list_display = ['pair', 'date', 'time', 'status', 'mtype', 'recorded_at']
    list_filter = ['status', 'mtype', 'pair__unit_a', 'pair__unit_b']
    inlines = [MeetingMinutesInline, MeetingNotHeldInline]


class ActionPointInline(admin.TabularInline):
    model = ActionPoint
    extra = 0


@admin.register(MeetingMinutes)
class MeetingMinutesAdmin(admin.ModelAdmin):
    list_display = ['meeting', 'source', 'uploaded_at']
    inlines = [ActionPointInline]


@admin.register(ActionPoint)
class ActionPointAdmin(admin.ModelAdmin):
    list_display = ['aid', 'text', 'done', 'minutes']
    list_filter = ['done']
