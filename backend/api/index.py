"""
Vercel Python serverless entry point.
Routes all requests through Django's WSGI application.
"""
import os
import sys

# Add the backend root to the path so Django can find cms/settings.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms.settings')

from cms.wsgi import application  # noqa: E402

# Vercel expects a callable named 'handler' or the module-level WSGI app
handler = application
