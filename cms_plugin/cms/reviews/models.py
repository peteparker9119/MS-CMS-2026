from django.db import models
from django.conf import settings
from cms.units.models import ConvergenceUnit


class ReviewTemplate(models.Model):
    FREQUENCY_WEEKLY = 'weekly'
    FREQUENCY_MONTHLY = 'monthly'
    FREQUENCY_QUARTERLY = 'quarterly'
    FREQUENCY_CHOICES = [
        (FREQUENCY_WEEKLY, 'Weekly'),
        (FREQUENCY_MONTHLY, 'Monthly'),
        (FREQUENCY_QUARTERLY, 'Quarterly'),
    ]

    title = models.CharField(max_length=200)
    unit = models.ForeignKey(
        ConvergenceUnit,
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    description = models.TextField(blank=True)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews_reviewtemplate'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ReviewCriterion(models.Model):
    template = models.ForeignKey(ReviewTemplate, related_name='criteria', on_delete=models.CASCADE)
    label = models.CharField(max_length=200)
    max_score = models.PositiveSmallIntegerField(default=10)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'reviews_reviewcriterion'
        managed = False
        ordering = ['order']

    def __str__(self):
        return f'{self.template} — {self.label}'


class ReviewEntry(models.Model):
    template = models.ForeignKey(ReviewTemplate, related_name='entries', on_delete=models.CASCADE)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='reviews_given',
        on_delete=models.CASCADE,
    )
    reviewee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        related_name='reviews_received',
        on_delete=models.SET_NULL,
    )
    unit = models.ForeignKey(
        ConvergenceUnit,
        null=True, blank=True,
        on_delete=models.SET_NULL,
    )
    date = models.DateField()
    overall_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews_reviewentry'
        managed = False
        ordering = ['-date']

    def __str__(self):
        return f'{self.template} — {self.date}'


class ReviewScore(models.Model):
    entry = models.ForeignKey(ReviewEntry, related_name='scores', on_delete=models.CASCADE)
    criterion = models.ForeignKey(ReviewCriterion, on_delete=models.CASCADE)
    score = models.FloatField()
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'reviews_reviewscore'
        managed = False

    def __str__(self):
        return f'{self.entry} — {self.criterion.label}: {self.score}'
