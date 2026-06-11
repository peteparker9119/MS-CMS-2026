import os
from django.apps import AppConfig


class DocumentsConfig(AppConfig):
    name = 'apps.documents'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        # Avoid double-start on dev runserver (which spawns a reloader child)
        if os.environ.get('RUN_MAIN') != 'true':
            from .scheduler import start
            start()
