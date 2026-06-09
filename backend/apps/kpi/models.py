from django.db import models
from django.conf import settings


class KPIDefinition(models.Model):
    FREQUENCY_DAILY = 'daily'
    FREQUENCY_WEEKLY = 'weekly'
    FREQUENCY_MONTHLY = 'monthly'
    FREQUENCY_CHOICES = [
        (FREQUENCY_DAILY, 'Daily'),
        (FREQUENCY_WEEKLY, 'Weekly'),
        (FREQUENCY_MONTHLY, 'Monthly'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    metric_unit = models.CharField(max_length=50)
    target_value = models.FloatField()
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default=FREQUENCY_DAILY)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='kpis',
        on_delete=models.CASCADE,
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='kpis_assigned',
        on_delete=models.CASCADE,
    )
    unit = models.ForeignKey(
        'units.ConvergenceUnit',
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kpi_kpidefinition'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class KPIEntry(models.Model):
    kpi = models.ForeignKey(KPIDefinition, related_name='entries', on_delete=models.CASCADE)
    value = models.FloatField()
    date = models.DateField()
    notes = models.TextField(blank=True)
    entered_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kpi_kpientry'
        unique_together = [('kpi', 'date')]
        ordering = ['-date']

    def __str__(self):
        return f'{self.kpi} — {self.date}: {self.value}'
