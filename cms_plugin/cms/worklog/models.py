from django.db import models
from django.conf import settings
from cms.units.models import ConvergenceUnit


class WorkTask(models.Model):
    STATUS_TODO = 'todo'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_DONE = 'done'
    STATUS_CHOICES = [
        (STATUS_TODO, 'To Do'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_DONE, 'Done'),
    ]

    PRIORITY_NORMAL = 'normal'
    PRIORITY_HIGH = 'high'
    PRIORITY_CRITICAL = 'critical'
    PRIORITY_CHOICES = [
        (PRIORITY_NORMAL, 'Normal'),
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_CRITICAL, 'Critical'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='assigned_tasks',
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='created_tasks',
        on_delete=models.CASCADE,
    )
    unit = models.ForeignKey(
        ConvergenceUnit,
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    deadline = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_TODO)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    hours_taken = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'worklog_worktask'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class WorkEntry(models.Model):
    task = models.ForeignKey(WorkTask, related_name='entries', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    description = models.TextField()
    work_hours = models.DecimalField(max_digits=4, decimal_places=1)
    date = models.DateField(auto_now_add=True)
    logged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'worklog_workentry'
        managed = False
        ordering = ['-logged_at']

    def __str__(self):
        return f'{self.user} — {self.task} ({self.work_hours}h)'


class WorkComment(models.Model):
    task = models.ForeignKey(WorkTask, related_name='comments', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'worklog_workcomment'
        managed = False
        ordering = ['created_at']

    def __str__(self):
        return f'Comment by {self.user} on {self.task}'
