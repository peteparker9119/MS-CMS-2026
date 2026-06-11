from django.db import models
from django.conf import settings


def do_letter_upload_path(instance, filename):
    return f'do_letters/{instance.date.year}/{filename}'


class DOLetter(models.Model):
    title = models.CharField(max_length=300)
    reference_number = models.CharField(max_length=100, blank=True)
    tracking_number = models.CharField(max_length=30, unique=True, blank=True)
    date = models.DateField()
    file = models.FileField(upload_to=do_letter_upload_path)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    units = models.ManyToManyField(
        'units.ConvergenceUnit',
        blank=True,
        related_name='do_letters',
    )
    visible_to_all = models.BooleanField(default=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'documents_doletter'
        ordering = ['-date']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.tracking_number:
            from apps.units.models import ConvergenceUnit
            unit_abbr = 'GEN'
            if hasattr(self, 'uploaded_by') and self.uploaded_by_id:
                user = self.uploaded_by
                if hasattr(user, 'unit') and user.unit:
                    unit_abbr = user.unit.abbr.upper()
            last = DOLetter.objects.filter(
                tracking_number__startswith=f'{unit_abbr}-DOL-'
            ).order_by('-tracking_number').first()
            if last and last.tracking_number:
                try:
                    seq = int(last.tracking_number.split('-')[-1]) + 1
                except ValueError:
                    seq = 1
            else:
                seq = 1
            self.tracking_number = f'{unit_abbr}-DOL-{seq:03d}'
        super().save(*args, **kwargs)


class DOLetterCompliance(models.Model):
    unit = models.ForeignKey(
        'units.ConvergenceUnit', on_delete=models.CASCADE, related_name='do_compliance'
    )
    year = models.PositiveSmallIntegerField()
    month = models.PositiveSmallIntegerField()
    is_compliant = models.BooleanField(default=False)
    checked_at = models.DateTimeField(auto_now=True)
    notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'documents_dolettercompliance'
        unique_together = [('unit', 'year', 'month')]
        ordering = ['-year', '-month', 'unit__order']
