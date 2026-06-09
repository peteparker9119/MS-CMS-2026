from django.db import models
from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver


class Item(models.Model):
    TYPE_SUPPORT = 'support'
    TYPE_REQUEST = 'request'
    TYPE_ALERT = 'alert'
    TYPE_EMERGENCY = 'emergency'
    TYPE_NEED = 'need'
    TYPE_FUND = 'fund'
    TYPE_INFRA = 'infra'
    TYPE_SCHOOL = 'school'
    TYPE_STUDENT = 'student'

    TYPE_CHOICES = [
        (TYPE_SUPPORT,   'Support'),
        (TYPE_REQUEST,   'Request'),
        (TYPE_ALERT,     'Alert'),
        (TYPE_EMERGENCY, 'Emergency'),
        (TYPE_NEED,      'Need'),
        (TYPE_FUND,      'Fund'),
        (TYPE_INFRA,     'Infra'),
        (TYPE_SCHOOL,    'School'),
        (TYPE_STUDENT,   'Student'),
    ]

    TYPE_CODES = {
        TYPE_SUPPORT:   'SU',
        TYPE_REQUEST:   'RQ',
        TYPE_ALERT:     'AL',
        TYPE_EMERGENCY: 'EM',
        TYPE_NEED:      'NE',
        TYPE_FUND:      'FU',
        TYPE_INFRA:     'IN',
        TYPE_SCHOOL:    'SC',
        TYPE_STUDENT:   'ST',
    }

    TYPE_COLORS = {
        TYPE_SUPPORT:   '#378ADD',
        TYPE_REQUEST:   '#7F77DD',
        TYPE_ALERT:     '#E0A21C',
        TYPE_EMERGENCY: '#D85A30',
        TYPE_NEED:      '#1D9E75',
        TYPE_FUND:      '#16A085',
        TYPE_INFRA:     '#8E7CC3',
        TYPE_SCHOOL:    '#D4537E',
        TYPE_STUDENT:   '#C0392B',
    }

    PRIO_NORMAL = 'Normal'
    PRIO_HIGH = 'High'
    PRIO_CRITICAL = 'Critical'
    PRIO_CHOICES = [
        (PRIO_NORMAL, 'Normal'),
        (PRIO_HIGH, 'High'),
        (PRIO_CRITICAL, 'Critical'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_OPEN = 'open'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_OPEN, 'Open'),
        (STATUS_CLOSED, 'Closed'),
    ]

    item_id = models.CharField(max_length=20, unique=True, blank=True)
    type = models.CharField(max_length=15, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=PRIO_CHOICES, default=PRIO_NORMAL)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    raiser = models.ForeignKey('units.ConvergenceUnit', on_delete=models.CASCADE, related_name='raised_items')
    targets = models.ManyToManyField('units.ConvergenceUnit', related_name='received_items')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_items'
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_items',
    )
    sla_start         = models.DateField(null=True, blank=True)
    sla_end           = models.DateField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'items_item'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.item_id}: {self.title}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


@receiver(pre_save, sender=Item)
def set_item_id(sender, instance, **kwargs):
    if not instance.item_id:
        code = Item.TYPE_CODES.get(instance.type, 'IT')
        last = Item.objects.filter(item_id__startswith=code + '-').order_by('-id').first()
        if last:
            try:
                n = int(last.item_id.split('-')[1]) + 1
            except (IndexError, ValueError):
                n = 1
        else:
            n = 1
        instance.item_id = f'{code}-{n:03d}'


class ItemActionItem(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='action_items')
    aid = models.CharField(max_length=20)
    text = models.TextField()
    done = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'items_itemactionitem'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f'{self.aid}: {self.text[:60]}'


def _next_item_aid():
    last = ItemActionItem.objects.order_by('-id').first()
    n = (last.id if last else 0) + 1
    return f'AI-{n:03d}'


class SLAHistory(models.Model):
    item       = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='sla_history')
    old_start  = models.DateField(null=True, blank=True)
    old_end    = models.DateField(null=True, blank=True)
    new_start  = models.DateField(null=True, blank=True)
    new_end    = models.DateField(null=True, blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='sla_changes',
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    note       = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'items_slahistory'
        ordering = ['-changed_at']

    def __str__(self):
        return f'SLA change for {self.item.item_id} at {self.changed_at}'
