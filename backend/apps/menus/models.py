from django.conf import settings
from django.db import models


class CustomMenu(models.Model):
    ICON_CHOICES = [
        ('grid',     'Grid'),
        ('list',     'List'),
        ('document', 'Document'),
        ('chart',    'Chart'),
        ('folder',   'Folder'),
        ('star',     'Star'),
        ('settings', 'Settings'),
        ('users',    'Users'),
        ('calendar', 'Calendar'),
        ('tag',      'Tag'),
    ]
    ROLE_CHOICES = [
        ('all',   'All Users'),
        ('admin', 'Admin Only'),
        ('poc',   'TL Only'),
    ]

    name        = models.CharField(max_length=80)
    slug        = models.SlugField(max_length=80, unique=True)
    icon        = models.CharField(max_length=30, choices=ICON_CHOICES, default='list')
    description = models.CharField(max_length=200, blank=True)
    access      = models.CharField(max_length=10, choices=ROLE_CHOICES, default='all')
    is_active   = models.BooleanField(default=True)
    order       = models.PositiveSmallIntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class MenuField(models.Model):
    TYPE_CHOICES = [
        ('text',     'Text'),
        ('number',   'Number'),
        ('date',     'Date'),
        ('email',    'Email'),
        ('phone',    'Phone'),
        ('select',   'Dropdown'),
        ('checkbox', 'Checkbox'),
        ('textarea', 'Long Text'),
        ('file',     'File Upload'),
    ]

    menu        = models.ForeignKey(CustomMenu, on_delete=models.CASCADE, related_name='fields')
    label       = models.CharField(max_length=80)
    field_key   = models.SlugField(max_length=80)
    field_type  = models.CharField(max_length=20, choices=TYPE_CHOICES, default='text')
    placeholder = models.CharField(max_length=120, blank=True)
    options     = models.JSONField(default=list, blank=True)   # for select type
    required    = models.BooleanField(default=False)
    order       = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']
        unique_together = [('menu', 'field_key')]

    def __str__(self):
        return f'{self.menu.name} / {self.label}'


class MenuEntry(models.Model):
    """Stores a single form submission for a CustomMenu."""
    menu         = models.ForeignKey(CustomMenu, on_delete=models.CASCADE, related_name='entries')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='menu_entries',
    )
    data         = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f'{self.menu.name} — entry {self.pk}'
