from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_ADMIN = 'admin'
    ROLE_POC   = 'poc'
    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_POC,   'Unit POC'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_POC)
    unit = models.ForeignKey(
        'units.ConvergenceUnit',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='poc_users',
        help_text='Only set for POC users',
    )
    is_team_lead = models.BooleanField(default=False)
    menu_permissions = models.JSONField(default=list, blank=True)  # e.g. ['dashboard','planner']
    whatsapp_number = models.CharField(
        max_length=20, blank=True, default='',
        help_text='E.164 without +, e.g. 919876543210'
    )

    class Meta:
        db_table = 'accounts_user'

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_admin(self):
        return self.role == self.ROLE_ADMIN

    @property
    def is_poc(self):
        return self.role == self.ROLE_POC
