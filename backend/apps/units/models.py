from django.db import models


class ConvergenceUnit(models.Model):
    slug = models.SlugField(unique=True)
    abbr = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#1A1A1F')
    member_name = models.CharField(max_length=100, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'units_convergenceunit'
        ordering = ['order']

    def __str__(self):
        return self.name


class UnitPair(models.Model):
    unit_a = models.ForeignKey(ConvergenceUnit, on_delete=models.CASCADE, related_name='pairs_as_a')
    unit_b = models.ForeignKey(ConvergenceUnit, on_delete=models.CASCADE, related_name='pairs_as_b')

    class Meta:
        db_table = 'units_unitpair'
        unique_together = [('unit_a', 'unit_b')]
        ordering = ['unit_a__order', 'unit_b__order']

    def __str__(self):
        return f'{self.unit_a.abbr} × {self.unit_b.abbr}'

    def involves(self, unit_slug):
        return self.unit_a.slug == unit_slug or self.unit_b.slug == unit_slug
