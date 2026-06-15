import logging
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.db import connection, OperationalError
from django.http import JsonResponse

logger = logging.getLogger('cms')


def health_check(request):
    """EC-05: liveness probe — verifies DB reachable."""
    try:
        connection.ensure_connection()
        return JsonResponse({'status': 'ok', 'db': 'connected'})
    except OperationalError as exc:
        logger.critical('EC-05 health check failed: %s', exc)
        return JsonResponse({'status': 'error', 'db': 'unreachable'}, status=503)


urlpatterns = [
    path('api/health/', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/', include('apps.units.urls')),
    path('api/', include('apps.meetings.urls')),
    path('api/', include('apps.items.urls')),
    path('api/', include('apps.worklog.urls')),
    path('api/', include('apps.kpi.urls')),
    path('api/', include('apps.gantt.urls')),
    path('api/', include('apps.reviews.urls')),
    path('api/', include('apps.documents.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.menus.urls')),
    path('api/', include('apps.taskboard.urls')),
]

# Serve media only in development — in production, delegate to nginx / object storage
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
