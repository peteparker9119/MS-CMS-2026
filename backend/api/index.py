"""
Vercel Python serverless entry point.

Vercel's filesystem is read-only except for /tmp.
We copy the seeded db.sqlite3 into /tmp on first run so Django
can perform writes (token issuance, etc.) within the request lifecycle.
"""
import os
import sys
import shutil
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── SQLite → /tmp copy (Vercel read-only filesystem workaround) ──────────────
_REPO_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db.sqlite3')
_TMP_DB  = '/tmp/cms_db.sqlite3'

if os.environ.get('VERCEL') and not os.path.exists(_TMP_DB):
    shutil.copy2(_REPO_DB, _TMP_DB)

# Point Django at the writable copy
if os.environ.get('VERCEL'):
    os.environ['DJANGO_SQLITE_PATH'] = _TMP_DB

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cms.settings')

_startup_error = None
try:
    from cms.wsgi import application as _django_app
except Exception:
    _startup_error = traceback.format_exc()
    _django_app = None


def application(environ, start_response):
    if _startup_error:
        body = f"Django startup error:\n{_startup_error}".encode()
        start_response('500 Internal Server Error', [
            ('Content-Type', 'text/plain'),
            ('Content-Length', str(len(body))),
        ])
        return [body]
    return _django_app(environ, start_response)


handler = application
