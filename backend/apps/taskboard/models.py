from django.db import models
from django.conf import settings


class Task(models.Model):
    """A task column in the board — shared across all assignees."""
    title       = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order       = models.PositiveSmallIntegerField(default=0)
    created_by  = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='tb_created_tasks')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'taskboard_task'
        ordering = ['order', 'created_at']

    def __str__(self):
        return self.title


class TaskAssignment(models.Model):
    STATUS_PENDING     = 'pending'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_COMPLETED   = 'completed'
    STATUS_BLOCKED     = 'blocked'
    STATUS_CHOICES = [
        ('pending',     'Pending'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
        ('blocked',     'Blocked'),
    ]

    task        = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                    related_name='task_assignments')
    start_date  = models.DateField(null=True, blank=True)
    deadline    = models.DateField(null=True, blank=True)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_by  = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='created_task_assignments')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'taskboard_assignment'
        unique_together = ['task', 'assigned_to']

    def __str__(self):
        return f'{self.task} → {self.assigned_to}'


class TaskActivity(models.Model):
    TYPE_ACTION  = 'action'
    TYPE_SUPPORT = 'support'
    TYPE_COMMENT = 'comment'
    TYPE_CLOSE   = 'close'
    TYPE_CHOICES = [
        ('action',  'Action Taken'),
        ('support', 'Support Given'),
        ('comment', 'Comment'),
        ('close',   'Closed'),
    ]

    assignment    = models.ForeignKey(TaskAssignment, on_delete=models.CASCADE,
                                      related_name='activities')
    text          = models.TextField()
    activity_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    support_needed = models.BooleanField(default=False)
    created_by    = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name='task_activities')
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'taskboard_activity'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.activity_type} on {self.assignment}'
