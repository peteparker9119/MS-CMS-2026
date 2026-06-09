from django.db import models
from django.conf import settings


class GanttTask(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    unit = models.ForeignKey(
        'units.ConvergenceUnit',
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='gantt_assigned_tasks',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    milestone = models.BooleanField(default=False)
    parent = models.ForeignKey(
        'self',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='subtasks',
    )
    color = models.CharField(max_length=20, blank=True)
    progress = models.PositiveSmallIntegerField(default=0)
    academic_year = models.CharField(max_length=9)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='gantt_tasks',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'gantt_gantttask'
        ordering = ['start_date']

    def __str__(self):
        return self.title
