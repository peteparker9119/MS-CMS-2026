from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_MEETING          = 'meeting_scheduled'
    TYPE_ITEM             = 'item_created'
    TYPE_DEADLINE_CHANGED = 'deadline_changed'
    TYPE_CHOICES = [
        (TYPE_MEETING,          'Meeting Scheduled'),
        (TYPE_ITEM,             'Item Created'),
        (TYPE_DEADLINE_CHANGED, 'Deadline Changed'),
    ]
    ACTION_RSVP        = 'rsvp'
    ACTION_ACKNOWLEDGE = 'acknowledge'
    ACTION_CHOICES = [
        (ACTION_RSVP,        'RSVP'),
        (ACTION_ACKNOWLEDGE, 'Acknowledge'),
    ]
    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title       = models.CharField(max_length=200)
    message     = models.TextField()
    notif_type  = models.CharField(max_length=40, choices=TYPE_CHOICES)
    object_id   = models.PositiveIntegerField(null=True, blank=True)
    read        = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)
    # quick-reply fields
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES, blank=True, default='')
    action_data = models.JSONField(default=dict, blank=True)
    responded   = models.BooleanField(default=False)
    response    = models.CharField(max_length=40, blank=True, default='')

    class Meta:
        db_table = 'notifications_notification'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.notif_type} → {self.user}'
