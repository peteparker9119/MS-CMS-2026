from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_SUPER_ADMIN = 'super_admin'
    ROLE_ADMIN       = 'admin'
    ROLE_POC         = 'poc'
    ROLE_TEAM        = 'team'
    ROLE_CHOICES = [
        (ROLE_SUPER_ADMIN, 'Super Admin'),
        (ROLE_ADMIN,       'Admin'),
        (ROLE_POC,         'Unit POC'),
        (ROLE_TEAM,        'Team Member'),
    ]

    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default=ROLE_TEAM)
    unit = models.ForeignKey(
        'units.ConvergenceUnit',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='poc_users',
        help_text='Set for POC and Team users',
    )
    is_team_lead = models.BooleanField(default=False)
    menu_permissions = models.JSONField(default=list, blank=True)
    whatsapp_number = models.CharField(
        max_length=20, blank=True, default='',
        help_text='E.164 without +, e.g. 919876543210'
    )

    class Meta:
        db_table = 'accounts_user'

    def __str__(self):
        return f'{self.username} ({self.get_role_display()})'

    @property
    def is_super_admin(self):
        return self.role == self.ROLE_SUPER_ADMIN

    @property
    def is_admin(self):
        return self.role in (self.ROLE_SUPER_ADMIN, self.ROLE_ADMIN)

    @property
    def is_poc(self):
        return self.role == self.ROLE_POC

    @property
    def is_team(self):
        return self.role == self.ROLE_TEAM
