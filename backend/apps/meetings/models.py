from django.db import models
from django.conf import settings


class Meeting(models.Model):
    STATUS_SCHEDULED = 'scheduled'
    STATUS_CONDUCTED = 'conducted'
    STATUS_POSTPONED = 'postponed'
    STATUS_MISSED = 'missed'
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_CONDUCTED, 'Conducted'),
        (STATUS_POSTPONED, 'Postponed'),
        (STATUS_MISSED, 'Missed'),
    ]

    TYPE_INPERSON = 'In-person'
    TYPE_ONLINE = 'Online'
    TYPE_CHOICES = [
        (TYPE_INPERSON, 'In-person'),
        (TYPE_ONLINE, 'Online'),
    ]

    pair = models.ForeignKey('units.UnitPair', on_delete=models.CASCADE, related_name='meetings')
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    mtype = models.CharField(max_length=15, choices=TYPE_CHOICES, default=TYPE_INPERSON)
    agenda = models.TextField(blank=True)
    notify_units = models.ManyToManyField('units.ConvergenceUnit', blank=True, related_name='notified_meetings')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_meetings'
    )
    deadline = models.DateTimeField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meetings_meeting'
        ordering = ['-date', '-recorded_at']

    def __str__(self):
        return f'{self.pair} — {self.date} ({self.status})'


class MeetingMinutes(models.Model):
    SOURCE_WRITTEN = 'written'
    SOURCE_UPLOAD = 'upload'
    SOURCE_CHOICES = [
        (SOURCE_WRITTEN, 'Written'),
        (SOURCE_UPLOAD, 'Uploaded'),
    ]

    meeting = models.OneToOneField(Meeting, on_delete=models.CASCADE, related_name='minutes')
    attendees = models.CharField(max_length=100, blank=True)
    summary = models.TextField(blank=True)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default=SOURCE_WRITTEN)
    filename = models.CharField(max_length=255, blank=True)
    uploaded_file = models.FileField(upload_to='mom_uploads/', null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='filed_minutes'
    )

    class Meta:
        db_table = 'meetings_meetingminutes'

    def __str__(self):
        return f'MoM — {self.meeting}'


class ActionPoint(models.Model):
    minutes = models.ForeignKey(MeetingMinutes, on_delete=models.CASCADE, related_name='action_points')
    aid = models.CharField(max_length=20)           # e.g. "AI-001"
    text = models.TextField()
    done = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'meetings_actionpoint'
        ordering = ['order']

    def __str__(self):
        return f'{self.aid}: {self.text[:60]}'


class ActionPointComment(models.Model):
    action_point = models.ForeignKey(ActionPoint, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='ap_comments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'meetings_actionpointcomment'
        ordering = ['created_at']

    def __str__(self):
        return f'Comment on {self.action_point.aid}'


class MeetingNotHeld(models.Model):
    STATUS_POSTPONED = 'postponed'
    STATUS_MISSED = 'missed'
    STATUS_CHOICES = [
        (STATUS_POSTPONED, 'Postponed'),
        (STATUS_MISSED, 'Missed'),
    ]

    meeting = models.OneToOneField(Meeting, on_delete=models.CASCADE, related_name='not_held')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_POSTPONED)
    reason = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='not_held_records'
    )

    class Meta:
        db_table = 'meetings_meetingnotheld'

    def __str__(self):
        return f'{self.status} — {self.meeting}'
